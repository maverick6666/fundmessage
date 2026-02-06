import api from './api';

export const reportService = {
  async getReports({ skip = 0, limit = 20 } = {}) {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);

    const response = await api.get(`/reports?${params.toString()}`);
    return response.data.data;
  },

  async getPositionReport(positionId) {
    const response = await api.get(`/reports/position/${positionId}`);
    return response.data.data;
  }
};
