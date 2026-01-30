import api from './api';

export const authService = {
  // 로그인
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, refresh_token, user } = response.data.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    return user;
  },

  // 회원가입 - 인증 코드 발송
  async sendVerification(email) {
    const response = await api.post('/auth/send-verification', { email });
    return response.data;
  },

  // 회원가입 - 인증 코드 확인
  async verifyCode(email, code) {
    const response = await api.post('/auth/verify-code', { email, code });
    return response.data;
  },

  // 회원가입 - 완료
  async signup(userData) {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  },

  // 관리자용 사용자 등록
  async register(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data.data.user;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  async getCurrentUser() {
    const response = await api.get('/users/me');
    return response.data.data;
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  getToken() {
    return localStorage.getItem('access_token');
  }
};
