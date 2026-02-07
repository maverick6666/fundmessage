import api from './api';

export const reportService = {
  // 의사결정서가 있는 포지션 목록 (기존)
  async getReports({ skip = 0, limit = 20 } = {}) {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);

    const response = await api.get(`/reports?${params.toString()}`);
    return response.data.data;
  },

  // 운용보고서용 포지션 목록 (모든 포지션, 토론/노트 개수 포함)
  async getPositionsForReport({ skip = 0, limit = 50, status = null } = {}) {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);
    if (status) params.append('status', status);

    const response = await api.get(`/reports/positions?${params.toString()}`);
    return response.data.data;
  },

  // 운용보고서 목록 (note_type='report')
  async getOperationReports({ skip = 0, limit = 50 } = {}) {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);

    const response = await api.get(`/reports/operation-reports?${params.toString()}`);
    return response.data.data;
  },

  // 전체 의사결정서 목록 (note_type='decision')
  async getDecisionNotes({ skip = 0, limit = 50 } = {}) {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);

    const response = await api.get(`/reports/decision-notes?${params.toString()}`);
    return response.data.data;
  },

  async getPositionReport(positionId) {
    const response = await api.get(`/reports/position/${positionId}`);
    return response.data.data;
  }
};
