import api from './api';

export const aiService = {
  async getStatus() {
    const response = await api.get('/ai/status');
    return response.data.data;
  },

  async generateDecisionNote(sessionIds, positionId = null) {
    const response = await api.post('/ai/generate-decision-note', {
      session_ids: sessionIds,
      position_id: positionId
    });
    return response.data;
  }
};
