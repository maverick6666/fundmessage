import api from './api';

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, refresh_token, user } = response.data.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    this.cacheUser(user);

    return user;
  },

  async sendVerification(email) {
    const response = await api.post('/auth/send-verification', { email });
    return response.data;
  },

  async verifyCode(email, code) {
    const response = await api.post('/auth/verify-code', { email, code });
    return response.data;
  },

  async signup(userData) {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  },

  async register(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data.data.user;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('cached_user');
  },

  async getCurrentUser() {
    const response = await api.get('/users/me');
    const userData = response.data.data;
    this.cacheUser(userData);
    return userData;
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  getToken() {
    return localStorage.getItem('access_token');
  },

  cacheUser(userData) {
    try {
      localStorage.setItem('cached_user', JSON.stringify(userData));
    } catch (e) {
      // localStorage full or unavailable
    }
  },

  getCachedUser() {
    try {
      const cached = localStorage.getItem('cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  }
};
