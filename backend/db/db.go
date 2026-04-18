package db

import (
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

type User struct {
	gorm.Model
	Username string `gorm:"unique"`
	Password string
	Role     string `gorm:"default:student"`
}

// НОВАЯ ТАБЛИЦА: КУРС
type Course struct {
	gorm.Model
	Title       string
	Description string
	AuthorID    uint     // Кто создал курс (ID учителя)
	Author      User     `gorm:"foreignKey:AuthorID"` // Связь с таблицей User
	Lessons     []Lesson `gorm:"foreignKey:CourseID"` // Один курс имеет много уроков
}

// ОБНОВЛЕННАЯ ТАБЛИЦА: УРОК
type Lesson struct {
	gorm.Model
	CourseID    uint // <-- ДОБАВЛЕНО: К какому курсу относится
	Title       string
	AudioURL    string
	InitialCode string
	Timeline    []byte `gorm:"type:jsonb"`
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func InitDB() {
	dsn := os.Getenv("DB_URL")
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database: ", err)
	}

	// GORM автоматически создаст/обновит таблицы и настроит связи (Foreign Keys)
	DB.AutoMigrate(&User{}, &Course{}, &Lesson{})
}
