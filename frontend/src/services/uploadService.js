import api from './api';

export const uploadService = {
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/uploads/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getDiskUsage() {
    const response = await api.get('/uploads/disk-usage');
    return response.data.data;
  }
};
