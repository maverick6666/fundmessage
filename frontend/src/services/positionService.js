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
  },

  // 환전
  async exchangeCurrency({ fromCurrency, toCurrency, fromAmount, toAmount, exchangeRate, memo }) {
    const response = await api.post('/positions/settings/team/exchange', {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      from_amount: fromAmount,
      to_amount: toAmount,
      exchange_rate: exchangeRate,
      memo
    });
    return response.data;
  },

  // 수정 이력 조회
  async getAuditLogs(id) {
    const response = await api.get(`/positions/${id}/audit-logs`);
    return response.data.data;
  },

  // 매매 계획 수정
  async updatePlans(id, { buyPlan, takeProfitTargets, stopLossTargets }) {
    const response = await api.patch(`/positions/${id}/plans`, {
      buy_plan: buyPlan,
      take_profit_targets: takeProfitTargets,
      stop_loss_targets: stopLossTargets
    });
    return response.data.data;
  },

  // 토론 요청 (팀원 → 매니저)
  async requestDiscussion(id) {
    const response = await api.post(`/positions/${id}/request-discussion`);
    return response.data;
  },

  // 조기종료 요청 (팀원 → 매니저)
  async requestEarlyClose(id) {
    const response = await api.post(`/positions/${id}/request-early-close`);
    return response.data;
  },

  // 포지션 삭제 (팀장/관리자)
  async deletePosition(id) {
    const response = await api.delete(`/positions/${id}`);
    return response.data;
  }
};
