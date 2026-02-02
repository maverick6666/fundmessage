import api from './api';

export const positionService = {
  async getPositions({ status, ticker, opened_by, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (ticker) params.append('ticker', ticker);
    if (opened_by) params.append('opened_by', opened_by);
    params.append('page', page);
    params.append('limit', limit);

    const response = await api.get(`/positions?${params.toString()}`);
    return response.data.data;
  },

  async getPosition(id) {
    const response = await api.get(`/positions/${id}`);
    return response.data.data;
  },

  async updatePosition(id, data) {
    const response = await api.patch(`/positions/${id}`, data);
    return response.data.data;
  },

  async closePosition(id, data) {
    const response = await api.post(`/positions/${id}/close`, data);
    return response.data.data;
  },

  // 포지션 정보 확인 (팀장용)
  async confirmPositionInfo(id, data) {
    const response = await api.post(`/positions/${id}/confirm`, data);
    return response.data.data;
  },

  // 계획 항목 완료 상태 토글 (팀장용)
  async togglePlanItem(id, planType, index, completed) {
    const response = await api.post(`/positions/${id}/toggle-plan`, {
      plan_type: planType,
      index,
      completed
    });
    return response.data.data;
  },

  // 팀 설정
  async getTeamSettings() {
    const response = await api.get('/positions/settings/team');
    return response.data.data;
  },

  async updateTeamSettings(data) {
    const response = await api.put('/positions/settings/team', data);
    return response.data.data;
  }
};
