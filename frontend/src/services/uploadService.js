import api from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const uploadService = {
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/uploads/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // 상대 URL을 절대 URL로 변환
    const data = response.data.data;
    if (data.url && data.url.startsWith('/')) {
      data.url = `${API_URL}${data.url}`;
    }
    return data;
  },

  async getDiskUsage() {
    const response = await api.get('/uploads/disk-usage');
    return response.data.data;
  }
};
