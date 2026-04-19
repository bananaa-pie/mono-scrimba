package main

import (
	"bytes"
	"context"
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

var jwtKey []byte

// Функция init автоматически запускается перед main()
func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "fallback_secret_key" // Если забудем указать в Docker
	}
	jwtKey = []byte(secret)
}

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
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT")
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
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict) // 409 статус
		json.NewEncoder(w).Encode(map[string]string{"error": "Пользователь с таким именем уже существует!"})
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
	if strings.TrimSpace(input.Title) == "" {
		http.Error(w, "Название курса не может быть пустым", http.StatusBadRequest)
		return
	}

	tokenString := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	claims := &Claims{}
	jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) { return jwtKey, nil })

	var user db.User
	db.DB.Where("username = ?", claims.Username).First(&user)

	if user.ID == 0 {
		http.Error(w, "Пользователь не найден (возможно, база была сброшена). Пожалуйста, перезайдите.", http.StatusUnauthorized)
		return
	}

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

	// Создаем временный файл
	tmpDir, _ := os.MkdirTemp("", "code-*")
	defer os.RemoveAll(tmpDir)
	filePath := filepath.Join(tmpDir, "main.go")
	os.WriteFile(filePath, []byte(req.Code), 0644)

	// Защита от бесконечных циклов (5 секунд)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "go", "run", filePath)
	out, _ := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"output": "Ошибка: превышено время выполнения (Timeout 5s). У вас бесконечный цикл?"})
		return
	}

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
	apiURL := "https://openrouter.ai/api/v1/chat/completions"

	systemPrompt := "Ты — опытный Go-разработчик и ментор. Помогай студенту с кодом, объясняй ошибки."
	userPrompt := fmt.Sprintf("Контекст кода:\n%s\n\nВопрос: %s", req.Code, req.Message)

	payload, _ := json.Marshal(map[string]interface{}{
		// Используем Mistral - она одна из самых стабильных бесплатных на OpenRouter
		"model": "nvidia/nemotron-3-nano-30b-a3b:free",
		"messages": []map[string]interface{}{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"stream": false,
	})

	aiReq, _ := http.NewRequest("POST", apiURL, bytes.NewBuffer(payload))
	aiReq.Header.Set("Authorization", "Bearer "+hfToken)
	aiReq.Header.Set("Content-Type", "application/json")

	// --- ДОБАВЛЯЕМ ЭТИ ДВА ЗАГОЛОВКА ---
	// OpenRouter требует их, чтобы понимать, кто им шлет запросы.
	// Без них некоторые серверы просто отбрасывают бесплатные запросы!
	aiReq.Header.Set("HTTP-Referer", "http://localhost:3000")
	aiReq.Header.Set("X-Title", "ScrimbaGo")
	// -----------------------------------

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
			if strings.TrimSpace(title) == "" {
				http.Error(w, "Название урока не может быть пустым", http.StatusBadRequest)
				return
			}
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

func deleteLessonHandler(w http.ResponseWriter, r *http.Request) {
	// Извлекаем ID из пути /lessons/{id}
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 {
		http.Error(w, "ID не указан", http.StatusBadRequest)
		return
	}
	lessonID := pathParts[2]

	// Удаляем запись из базы навсегда (Unscoped)
	if err := db.DB.Unscoped().Delete(&db.Lesson{}, lessonID).Error; err != nil {
		http.Error(w, "Ошибка при удалении: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

func deleteCourseHandler(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	courseID := pathParts[2]

	// Удаляем сам курс
	if err := db.DB.Unscoped().Delete(&db.Course{}, courseID).Error; err != nil {
		http.Error(w, "Failed to delete course", http.StatusInternalServerError)
		return
	}

	// Очищаем все уроки, которые были в этом курсе
	db.DB.Unscoped().Where("course_id = ?", courseID).Delete(&db.Lesson{})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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
		} else if r.Method == "DELETE" {
			authRoute(deleteCourseHandler)(w, r) // <-- ДОБАВИЛИ ЭТО
		}
	})

	// Вот эта строка отвечает за GET и POST уроков (скорее всего ты ее удалил)
	http.HandleFunc("/lessons", publicRoute(lessonsHandler))

	// А эта (которую мы добавили) отвечает за DELETE
	http.HandleFunc("/lessons/", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(&w)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.Method == "DELETE" {
			authRoute(deleteLessonHandler)(w, r)
		}
	})

	http.HandleFunc("/run", authRoute(runHandler))
	http.HandleFunc("/chat", authRoute(chatHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Backend started on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
