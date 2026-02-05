import api from './api';

export const decisionNoteService = {
  async getNotes(positionId) {
    const response = await api.get(`/positions/${positionId}/notes`);
    return response.data.data;
  },

  async createNote(positionId, { title, content }) {
    const response = await api.post(`/positions/${positionId}/notes`, { title, content });
    return response.data.data;
  },

  async updateNote(positionId, noteId, { title, content }) {
    const response = await api.patch(`/positions/${positionId}/notes/${noteId}`, { title, content });
    return response.data.data;
  },

  async deleteNote(positionId, noteId) {
    const response = await api.delete(`/positions/${positionId}/notes/${noteId}`);
    return response.data;
  }
};
