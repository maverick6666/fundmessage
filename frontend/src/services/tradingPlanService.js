import api from './api';

export const tradingPlanService = {
  async getPlans(positionId) {
    const response = await api.get(`/positions/${positionId}/plans`);
    return response.data.data;
  },

  async createPlan(positionId, data) {
    const response = await api.post(`/positions/${positionId}/plans`, data);
    return response.data.data;
  },

  async submitPlan(positionId, planId) {
    const response = await api.post(`/positions/${positionId}/plans/${planId}/submit`);
    return response.data.data;
  },

  async getPlan(positionId, planId) {
    const response = await api.get(`/positions/${positionId}/plans/${planId}`);
    return response.data.data;
  },

  async deletePlan(positionId, planId) {
    const response = await api.delete(`/positions/${positionId}/plans/${planId}`);
    return response.data;
  }
};
