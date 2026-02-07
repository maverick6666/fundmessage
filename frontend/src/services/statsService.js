import api from './api';

export const statsService = {
  async getUserStats(userId) {
    const response = await api.get(`/stats/users/${userId}`);
    return response.data.data;
  },

  async getTeamStats({ start_date, end_date } = {}) {
    const params = new URLSearchParams();
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);

    const response = await api.get(`/stats/team?${params.toString()}`);
    return response.data.data;
  },

  async getExchangeRate() {
    const response = await api.get('/stats/exchange-rate');
    return response.data.data;
  },

  async getTeamRanking() {
    const response = await api.get('/stats/team-ranking');
    return response.data.data;
  },

  async getAssetHistory(period = '1m') {
    const response = await api.get(`/stats/asset-history?period=${period}`);
    return response.data.data;
  }
};
