import axios from 'axios'

// Set VITE_API_URL in frontend/.env for production, e.g. https://yourdomain.com
console.log(import.meta.env);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

console.log("API_URL =", API_URL);

export const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tapcoin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const adminApi = axios.create({ baseURL: API_URL })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('tapcoin_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default API_URL
