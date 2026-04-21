import axios from 'axios';

// Теперь Axios сам понимает: 
// Если мы на Vercel — берет ссылку из настроек Vercel
// Если мы дома — берет localhost из файла .env
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://mono-scrimba.onrender.com'
});

// Перехватчик: автоматически прикрепляет токен авторизации к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Или как ты сохраняешь токен в AuthContext
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;