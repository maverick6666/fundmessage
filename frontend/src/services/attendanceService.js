import api from './api';

export const attendanceService = {
  async checkIn() {
    const response = await api.post('/attendance/check-in');
    return response.data;
  },

  async getMyAttendance(year, month) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);

    const url = params.toString() ? `/attendance/me?${params.toString()}` : '/attendance/me';
    const response = await api.get(url);
    return response.data.data;
  },

  async getMyStats() {
    const response = await api.get('/attendance/me/stats');
    return response.data.data;
  },

  async requestRecovery(columnId, date) {
    const response = await api.post('/attendance/recover', {
      column_id: columnId,
      date: date
    });
    return response.data;
  },

  async getPendingRecoveries() {
    const response = await api.get('/attendance/pending');
    return response.data.data;
  },

  async approveRecovery(attendanceId) {
    const response = await api.post(`/attendance/${attendanceId}/approve`);
    return response.data;
  },

  async rejectRecovery(attendanceId) {
    const response = await api.post(`/attendance/${attendanceId}/reject`);
    return response.data;
  },

  async getUserAttendance(userId, year, month) {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);

    const url = params.toString()
      ? `/attendance/user/${userId}?${params.toString()}`
      : `/attendance/user/${userId}`;
    const response = await api.get(url);
    return response.data.data;
  }
};
