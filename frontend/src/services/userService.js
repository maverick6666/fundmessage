import api from './api';

export const userService = {
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
