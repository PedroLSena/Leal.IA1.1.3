/**
 * Leal.ai - Cliente de API e Comunicação HTTP com Axios
 * Gerencia tokens JWT, renovação com refresh token e chamadas aos endpoints REST.
 */

import axios from 'axios';

// Determina baseURL adequada (Vite dev, backend local ou deploy em produção)
const VITE_API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_API_BASE_URL
  : '';

const API_BASE_URL = VITE_API_BASE_URL || (
  window.location.port === '5173'
    ? '/api'
    : (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
      ? 'http://localhost:3001/api'
      : '/api'
);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Chaves de armazenamento de tokens
const ACCESS_TOKEN_KEY = 'leal_access_token';
const REFRESH_TOKEN_KEY = 'leal_refresh_token';
const USER_KEY = 'leal_current_user';

export const TokenService = {
  getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getCurrentUser() {
    try {
      const user = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },
  setTokens(accessToken, refreshToken, user, rememberMe = true) {
    const storage = rememberMe ? localStorage : sessionStorage;
    if (accessToken) storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (user) storage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
};

// Interceptor para injetar Bearer Token em todas as requisições
apiClient.interceptors.request.use(
  (config) => {
    const token = TokenService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para renovação automática de token no caso de expiração (401)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = TokenService.getRefreshToken();
      if (!refreshToken) {
        TokenService.clearTokens();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        TokenService.setTokens(data.accessToken, data.refreshToken, null);
        apiClient.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);
        isRefreshing = false;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        TokenService.clearTokens();
        isRefreshing = false;
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

// Módulos de Chamadas da API

export const authAPI = {
  async login(email, password) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    if (data.success && data.accessToken) {
      TokenService.setTokens(data.accessToken, data.refreshToken, data.user);
    }
    return data;
  },
  async register(accountData) {
    const { data } = await apiClient.post('/auth/register', accountData);
    return data;
  },
  async logout() {
    const refreshToken = TokenService.getRefreshToken();
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      TokenService.clearTokens();
    }
  },
  async getMe() {
    const { data } = await apiClient.get('/auth/me');
    return data.user;
  }
};

export const accountsAPI = {
  async getAll(params = {}) {
    const { data } = await apiClient.get('/accounts', { params });
    return data.data || [];
  },
  async getById(id) {
    const { data } = await apiClient.get(`/accounts/${id}`);
    return data.data;
  },
  async create(accountData) {
    const { data } = await apiClient.post('/accounts', accountData);
    return data;
  },
  async updateStatus(id, status) {
    const { data } = await apiClient.patch(`/accounts/${id}/status`, { status });
    return data;
  },
  async delete(id) {
    const { data } = await apiClient.delete(`/accounts/${id}`);
    return data;
  },
  async getStats() {
    const { data } = await apiClient.get('/accounts/stats');
    return data.stats;
  }
};

export const hierarchyAPI = {
  async getDefinitions() {
    const { data } = await apiClient.get('/hierarchy/definitions');
    return data.data;
  },
  async getPermissions() {
    const { data } = await apiClient.get('/hierarchy/permissions');
    return data.data;
  },
  async getMatrix() {
    const { data } = await apiClient.get('/hierarchy/matrix');
    return data.data;
  }
};

export const riskAPI = {
  async analyze(payload) {
    const { data } = await apiClient.post('/risk/analyze', payload);
    return data;
  },
  async list() {
    const { data } = await apiClient.get('/risk');
    return data.data || [];
  },
  async getById(id) {
    const { data } = await apiClient.get(`/risk/${id}`);
    return data.data;
  },
  async updateStatus(id, status) {
    const { data } = await apiClient.patch(`/risk/${id}`, { status });
    return data;
  },
  async remove(id) {
    const { data } = await apiClient.delete(`/risk/${id}`);
    return data;
  }
};

export const contractsAPI = {
  async generate(payload) {
    const { data } = await apiClient.post('/contracts/generate', payload);
    return data;
  },
  async list() {
    const { data } = await apiClient.get('/contracts');
    return data.data || [];
  },
  async getById(id) {
    const { data } = await apiClient.get(`/contracts/${id}`);
    return data.data;
  },
  async update(id, payload) {
    const { data } = await apiClient.patch(`/contracts/${id}`, payload);
    return data;
  },
  async remove(id) {
    const { data } = await apiClient.delete(`/contracts/${id}`);
    return data;
  }
};

export const journeyAPI = {
  async analyze(records) {
    const { data } = await apiClient.post('/journey/analyze', { records });
    return data.data;
  },
  async listRecords(params = {}) {
    const { data } = await apiClient.get('/journey/records', { params });
    return data.data;
  },
  async createRecord(payload) {
    const { data } = await apiClient.post('/journey/records', payload);
    return data;
  },
  async removeRecord(id) {
    const { data } = await apiClient.delete(`/journey/records/${id}`);
    return data;
  }
};

export const billingAPI = {
  async plans() {
    const { data } = await apiClient.get('/billing/plans');
    return data.data || [];
  },
  async subscription() {
    const { data } = await apiClient.get('/billing/subscription');
    return data.data;
  },
  async updateSubscription(payload) {
    const { data } = await apiClient.patch('/billing/subscription', payload);
    return data;
  }
};

export default {
  apiClient,
  TokenService,
  authAPI,
  accountsAPI,
  hierarchyAPI,
  riskAPI,
  contractsAPI,
  journeyAPI,
  billingAPI
};
