import api from './api';

export const requestService = {
  async getRequests({ status, request_type, requester_id, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (request_type) params.append('request_type', request_type);
    if (requester_id) params.append('requester_id', requester_id);
    params.append('page', page);
    params.append('limit', limit);

    const response = await api.get(`/requests?${params.toString()}`);
    return response.data.data;
  },

  async getRequest(id) {
    const response = await api.get(`/requests/${id}`);
    return response.data.data;
  },

  async createBuyRequest(data) {
    const response = await api.post('/requests/buy', data);
    return response.data.data.request;
  },

  async createSellRequest(data) {
    const response = await api.post('/requests/sell', data);
    return response.data.data.request;
  },

  async approveRequest(id, data) {
    const response = await api.post(`/requests/${id}/approve`, data);
    return response.data.data;
  },

  async rejectRequest(id, reason) {
    const response = await api.post(`/requests/${id}/reject`, { rejection_reason: reason });
    return response.data.data.request;
  },

  async startDiscussion(id, title, agenda) {
    const response = await api.post(`/requests/${id}/discuss`, { title, agenda });
    return response.data.data;
  },

  async requestDiscussion(id) {
    const response = await api.post(`/requests/${id}/request-discussion`);
    return response.data;
  },

  // 요청 삭제 (팀장/관리자)
  async deleteRequest(id) {
    const response = await api.delete(`/requests/${id}`);
    return response.data;
  }
};
