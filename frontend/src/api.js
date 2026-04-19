import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080' // Убедись, что порт совпадает с бэкендом
});

// Автоматически подставляем токен, если он есть
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;