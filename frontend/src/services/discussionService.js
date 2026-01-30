import api from './api';

export const discussionService = {
  async getDiscussion(id) {
    const response = await api.get(`/discussions/${id}`);
    return response.data.data;
  },

  async getMessages(discussionId, { page = 1, limit = 50 } = {}) {
    const response = await api.get(`/discussions/${discussionId}/messages?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  async sendMessage(discussionId, content) {
    const response = await api.post(`/discussions/${discussionId}/messages`, { content });
    return response.data.data;
  },

  async closeDiscussion(id, summary = null) {
    const response = await api.post(`/discussions/${id}/close`, { summary });
    return response.data.data;
  },

  async exportDiscussion(id) {
    const response = await api.get(`/discussions/${id}/export`);
    return response.data;
  }
};
