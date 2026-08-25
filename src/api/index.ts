import axios from 'axios';

// Create an instance of axios with default config
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://lacra-eudr-backend.onrender.com/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to add the auth token to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
