package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv" // <-- ИСПРАВЛЕНИЕ 1: Добавили библиотеку для конвертации чисел
	"strings"
	"time"

	"scrimba-back/db" // ВНИМАНИЕ: Убедись, что имя модуля совпадает с твоим go.mod

	"github.com/golang-jwt/jwt/v5"
)

var jwtKey = []byte("super_secret_diploma_key_2026")

type CodeRequest struct {
	Code string `json:"code"`
}

type ChatRequest struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func enableCORS(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	(*w).Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func publicRoute(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCORS(&w)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func authRoute(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCORS(&w)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		authHeader := r.Header.Get("Authorization")
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		if tokenString == "" {
			http.Error(w, "Unauthorized: Token missing", http.StatusUnauthorized)
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
			return
		}

		next(w, r)
	}
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var u db.User
	json.NewDecoder(r.Body).Decode(&u)

	if u.Role != "teacher" && u.Role != "student" {
		u.Role = "student"
	}

	hashed, _ := db.HashPassword(u.Password)
	u.Password = hashed

	if err := db.DB.Create(&u).Error; err != nil {
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var input db.User
	json.NewDecoder(r.Body).Decode(&input)

	var user db.User
	db.DB.Where("username = ?", input.Username).First(&user)

	if user.ID == 0 || !db.CheckPasswordHash(input.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		Username:         user.Username,
		Role:             user.Role,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(expirationTime)},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString(jwtKey)

	json.NewEncoder(w).Encode(map[string]string{"token": tokenString, "role": user.Role})
}

func getCoursesHandler(w http.ResponseWriter, r *http.Request) {
	var courses []db.Course
	db.DB.Preload("Author").Order("created_at desc").Find(&courses)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(courses)
}

func getCourseLessonsHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	courseID := pathParts[2]

	var lessons []db.Lesson
	db.DB.Where("course_id = ?", courseID).Order("created_at asc").Find(&lessons)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lessons)
}

func createCourseHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	tokenString := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	claims := &Claims{}
	jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) { return jwtKey, nil })

	var user db.User
	db.DB.Where("username = ?", claims.Username).First(&user)

	if user.Role != "teacher" {
		http.Error(w, "Only teachers can create courses", http.StatusForbidden)
		return
	}

	course := db.Course{
		Title:       input.Title,
		Description: input.Description,
		AuthorID:    user.ID,
	}

	db.DB.Create(&course)
	json.NewEncoder(w).Encode(course)
}

func runHandler(w http.ResponseWriter, r *http.Request) {
	var req CodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return
	}

	tmpDir, _ := os.MkdirTemp("", "code-*")
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "main.go")
	os.WriteFile(filePath, []byte(req.Code), 0644)

	cmd := exec.Command("go", "run", filePath)
	out, _ := cmd.CombinedOutput()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"output": string(out)})
}

func chatHandler(w http.ResponseWriter, r *http.Request) {
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	hfToken := os.Getenv("HF_TOKEN")
	apiURL := "https://router.huggingface.co/v1/chat/completions"

	systemPrompt := "Ты — опытный Go-разработчик и ментор. Помогай студенту с кодом, объясняй ошибки."
	userPrompt := fmt.Sprintf("Контекст кода:\n%s\n\nВопрос: %s", req.Code, req.Message)

	payload, _ := json.Marshal(map[string]interface{}{
		"model": "openai/gpt-oss-120b:fastest",
		"messages": []map[string]interface{}{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"stream": false,
	})

	aiReq, _ := http.NewRequest("POST", apiURL, bytes.NewBuffer(payload))
	aiReq.Header.Set("Authorization", "Bearer "+hfToken)
	aiReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(aiReq)
	if err != nil {
		http.Error(w, "AI Service Error", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	io.Copy(w, resp.Body)
}

func lessonsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(&w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == "GET" {
		var lessons []db.Lesson
		db.DB.Order("created_at desc").Find(&lessons)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(lessons)
		return
	}

	if r.Method == "POST" {
		authRoute(func(w http.ResponseWriter, r *http.Request) {
			err := r.ParseMultipartForm(10 << 20)
			if err != nil {
				http.Error(w, "Error parsing form", http.StatusBadRequest)
				return
			}

			title := r.FormValue("title")
			initialCode := r.FormValue("initial_code")
			timeline := r.FormValue("timeline")

			// --- ИСПРАВЛЕНИЕ 2: СЧИТЫВАЕМ ID КУРСА ---
			courseIDStr := r.FormValue("course_id")
			var courseID uint
			if courseIDStr != "" {
				parsedID, _ := strconv.ParseUint(courseIDStr, 10, 32)
				courseID = uint(parsedID)
			}

			file, _, err := r.FormFile("audio")
			var audioURL string
			if err == nil {
				defer file.Close()
				fileName := fmt.Sprintf("%d.webm", time.Now().UnixNano())
				filePath := filepath.Join("./uploads", fileName)
				dst, _ := os.Create(filePath)
				defer dst.Close()
				io.Copy(dst, file)
				audioURL = "/uploads/" + fileName
			}

			lesson := db.Lesson{
				CourseID:    courseID, // --- ИСПРАВЛЕНИЕ 3: ПРИВЯЗЫВАЕМ К БАЗЕ ---
				Title:       title,
				InitialCode: initialCode,
				Timeline:    []byte(timeline),
				AudioURL:    audioURL,
			}

			db.DB.Create(&lesson)
			json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		})(w, r)
	}
}

func main() {
	db.InitDB()
	os.MkdirAll("./uploads", os.ModePerm)

	fileServer := http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads")))
	http.HandleFunc("/uploads/", publicRoute(fileServer.ServeHTTP))

	http.HandleFunc("/register", publicRoute(registerHandler))
	http.HandleFunc("/login", publicRoute(loginHandler))

	http.HandleFunc("/courses", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(&w)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method == "GET" {
			getCoursesHandler(w, r)
		} else if r.Method == "POST" {
			authRoute(createCourseHandler)(w, r)
		}
	})

	http.HandleFunc("/courses/", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(&w)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if strings.HasSuffix(r.URL.Path, "/lessons") && r.Method == "GET" {
			getCourseLessonsHandler(w, r)
		}
	})

	http.HandleFunc("/lessons", publicRoute(lessonsHandler))

	http.HandleFunc("/run", authRoute(runHandler))
	http.HandleFunc("/chat", authRoute(chatHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Backend started on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
