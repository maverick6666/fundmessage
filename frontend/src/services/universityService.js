import api from './api';

export const universityService = {
  // 공개 - 활성 대학교 목록 (회원가입 시 사용)
  async getActiveUniversities() {
    const response = await api.get('/universities/active');
    return response.data.data;
  },

  // 관리자 - 전체 대학교 목록
  async getAllUniversities() {
    const response = await api.get('/universities');
    return response.data.data;
  },

  // 관리자 - 대학교 상세
  async getUniversity(id) {
    const response = await api.get(`/universities/${id}`);
    return response.data.data;
  },

  // 관리자 - 대학교 추가
  async createUniversity(data) {
    const response = await api.post('/universities', data);
    return response.data.data;
  },

  // 관리자 - 대학교 수정
  async updateUniversity(id, data) {
    const response = await api.put(`/universities/${id}`, data);
    return response.data.data;
  },

  // 관리자 - 대학교 비활성화
  async deleteUniversity(id) {
    const response = await api.delete(`/universities/${id}`);
    return response.data;
  },
};
