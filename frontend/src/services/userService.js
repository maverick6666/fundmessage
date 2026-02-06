import api from './api';

export const userService = {
  // 팀원 목록 조회 (모든 인증된 사용자 접근 가능)
  async getTeamMembers() {
    const response = await api.get('/users/team-members');
    return response.data.data;
  },

  // 사용자 목록 조회 (관리자/팀장만)
  async getUsers({ role, is_active } = {}) {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (is_active !== undefined) params.append('is_active', is_active);

    const url = params.toString() ? `/users?${params.toString()}` : '/users';
    const response = await api.get(url);
    return response.data.data;
  },

  async getPendingUsers() {
    const response = await api.get('/users/pending');
    return response.data.data;
  },

  async getUser(id) {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  },

  async approveUser(id) {
    const response = await api.post(`/users/${id}/approve`);
    return response.data;
  },

  async deactivateUser(id) {
    const response = await api.post(`/users/${id}/deactivate`);
    return response.data;
  },

  async updateUserRole(id, role) {
    const response = await api.patch(`/users/${id}/role`, { role });
    return response.data;
  },

  async deleteUser(id) {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  async transferManager(id) {
    const response = await api.post(`/users/${id}/transfer-manager`);
    return response.data;
  }
};
