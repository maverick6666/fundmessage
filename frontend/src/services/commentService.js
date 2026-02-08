import api from './api';

export const commentService = {
  async getComments({ document_type, document_id, skip = 0, limit = 50 }) {
    const params = new URLSearchParams();
    params.append('document_type', document_type);
    params.append('document_id', document_id);
    params.append('skip', skip);
    params.append('limit', limit);

    const response = await api.get(`/comments?${params.toString()}`);
    return response.data.data;
  },

  async createComment({ document_type, document_id, content }) {
    const response = await api.post('/comments', {
      document_type,
      document_id,
      content,
    });
    return response.data;
  },

  async updateComment(commentId, content) {
    const response = await api.put(`/comments/${commentId}`, { content });
    return response.data;
  },

  async deleteComment(commentId) {
    const response = await api.delete(`/comments/${commentId}`);
    return response.data;
  },
};
