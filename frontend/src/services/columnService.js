import api from './api';

export const columnService = {
  async getColumns({ skip = 0, limit = 20, author_id = null } = {}) {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);
    if (author_id) params.append('author_id', author_id);

    const response = await api.get(`/columns?${params.toString()}`);
    return response.data.data;
  },

  async getColumn(id) {
    const response = await api.get(`/columns/${id}`);
    return response.data.data;
  },

  async createColumn(data) {
    const response = await api.post('/columns', data);
    return response.data;
  },

  async updateColumn(id, data) {
    const response = await api.put(`/columns/${id}`, data);
    return response.data;
  },

  async deleteColumn(id) {
    const response = await api.delete(`/columns/${id}`);
    return response.data;
  }
};
