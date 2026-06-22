import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'fm_auth_token';
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);

export const saveToken = (token) => AsyncStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);

export const authAPI = {
  register: (data) => client.post('/api/auth/register', data),
  login: (firebaseIdToken) => client.post('/api/auth/login', { firebase_id_token: firebaseIdToken }),
};

export const choresAPI = {
  getAll: () => client.get('/api/chores'),
  create: (data) => client.post('/api/chores', data),
  update: (id, data) => client.put(`/api/chores/${id}`, data),
  complete: (id) => client.post(`/api/chores/${id}/complete`),
  delete: (id) => client.delete(`/api/chores/${id}`),
};

export const usersAPI = {
  getMe: () => client.get('/api/users/me'),
  getChildren: () => client.get('/api/users/children'),
  getUser: (id) => client.get(`/api/users/${id}`),
  updateUser: (id, data) => client.put(`/api/users/${id}`, data),
  getStats: (id) => client.get(`/api/users/${id}/stats`),
};

export const monitoringAPI = {
  getActivity: (childId, limit = 50) =>
    client.get(`/api/monitoring/${childId}/activity`, { params: { limit } }),
  logActivity: (childId, data) => client.post(`/api/monitoring/${childId}/activity`, data),
  blockContent: (childId, data) => client.post(`/api/monitoring/${childId}/block`, data),
  getBlocked: (childId) => client.get(`/api/monitoring/${childId}/blocked`),
};

export default client;
