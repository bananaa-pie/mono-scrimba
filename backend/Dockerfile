FROM golang:1.25-alpine

# Ставим зависимости
RUN apk add --no-cache docker-cli git

WORKDIR /app

# Устанавливаем Air (утилита для горячей перезагрузки)
RUN go install github.com/air-verse/air@latest

# Кэшируем зависимости
COPY go.mod go.sum ./
ENV GOTOOLCHAIN=local
RUN go mod download

# Мы убрали COPY . . и RUN go build. 
# Код теперь будет попадать в контейнер напрямую с твоего компа!

# Запускаем Air
CMD ["air"]