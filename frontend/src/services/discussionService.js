import api from './api';

export const discussionService = {
  async getDiscussions({ status, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit);
    params.append('offset', offset);
    const response = await api.get(`/discussions?${params}`);
    return response.data.data;
  },

  async createDiscussion({ requestId, positionId, title }) {
    const response = await api.post('/discussions', {
      request_id: requestId || null,
      position_id: positionId || null,
      title
    });
    return response.data.data;
  },

  async getDiscussion(id) {
    const response = await api.get(`/discussions/${id}`);
    return response.data.data;
  },

  async getPositionDiscussions(positionId) {
    const response = await api.get(`/discussions/position/${positionId}`);
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

  async reopenDiscussion(id) {
    const response = await api.post(`/discussions/${id}/reopen`);
    return response.data.data;
  },

  async requestReopen(id) {
    const response = await api.post(`/discussions/${id}/request-reopen`);
    return response.data;
  },

  async exportDiscussion(id) {
    const response = await api.get(`/discussions/${id}/export`);
    return response.data;
  },

  async getSessions(id) {
    const response = await api.get(`/discussions/${id}/sessions`);
    return response.data.data;
  },

  async exportTxt(id, sessionNumbers = null) {
    const params = sessionNumbers ? `?sessions=${sessionNumbers.join(',')}` : '';
    const response = await api.get(`/discussions/${id}/export-txt${params}`);
    return response.data.data;
  },

  // 토론 삭제 (팀장/관리자)
  async deleteDiscussion(id) {
    const response = await api.delete(`/discussions/${id}`);
    return response.data;
  }
};
