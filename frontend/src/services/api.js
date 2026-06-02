import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const register = (token, username, password) =>
  api.post('/auth/register', { token, username, password });

export const getMe = () => api.get('/auth/me');

export const createInvite = (expiresHours) =>
  api.post('/auth/invite', { expiresHours });

export const startDanmaku = (roomId) =>
  api.post('/danmaku/start', { roomId });

export const stopDanmaku = () =>
  api.post('/danmaku/stop');

export const silentUser = (data) =>
  api.post('/ban/silent', data);

export const unsilentUser = (data) =>
  api.post('/ban/unsilent', data);

export const getBanList = (roomId, page = 1) =>
  api.get('/ban/list', { params: { roomId, page } });

export const getBanLogs = (params) =>
  api.get('/ban/logs', { params });

export const getHistorySessions = (roomId) =>
  api.get(`/history/${roomId}/sessions`);

export const getHistoryData = (roomId, sessionId) =>
  api.get(`/history/${roomId}/${sessionId}`);

export const searchHistory = (params) =>
  api.get('/history/search', { params });

export const getUserTags = (uid) =>
  api.get(`/tags/${uid}`);

export const addUserTag = (uid, data) =>
  api.post(`/tags/${uid}`, data);

export const deleteUserTag = (tagId) =>
  api.delete(`/tags/${tagId}`);

export const getMods = () =>
  api.get('/mods');

export const deleteMod = (modId) =>
  api.delete(`/mods/${modId}`);

export const getInvites = () =>
  api.get('/mods/invites');
