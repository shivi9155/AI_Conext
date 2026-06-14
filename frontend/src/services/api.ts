import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  renameUser: (userId: string, username: string) =>
    api.put(`/auth/users/${userId}`, { username }),
  deleteUser: (userId: string) =>
    api.delete(`/auth/users/${userId}`),
};

export const groupService = {
  getAll: () => api.get('/groups'),
  getById: (groupId: string) => api.get(`/groups/${groupId}`),
  create: (name: string) => api.post('/groups', { name }),
  addMember: (groupId: string, username: string) =>
    api.post(`/groups/${groupId}/members`, { username }),
};

export const expenseService = {
  create: (groupId: string, description: string, amount: number, splitType: string, shares: any[], category?: string, notes?: string) =>
    api.post('/expenses', { groupId, description, amount, splitType, shares, category, notes }),
  getById: (expenseId: string) => api.get(`/expenses/${expenseId}`),
  delete: (expenseId: string) => api.delete(`/expenses/${expenseId}`),
  addComment: (expenseId: string, content: string) =>
    api.post(`/expenses/${expenseId}/comments`, { content }),
};

export const settlementService = {
  getBalances: (groupId: string) => api.get(`/settlements/balances/${groupId}`),
  settle: (groupId: string, fromUserId: string, toUserId: string, amount: number) =>
    api.post(`/settlements/${groupId}/settle`, { fromUserId, toUserId, amount }),
};

export default api;
