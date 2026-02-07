import api from './api';

export const newsdeskService = {
  /**
   * 오늘의 뉴스데스크 조회
   */
  async getTodayNewsDesk() {
    const response = await api.get('/newsdesk/today');
    return response.data.data;
  },

  /**
   * 특정 날짜의 뉴스데스크 조회
   * @param {string} date - YYYY-MM-DD 형식의 날짜
   */
  async getNewsDeskByDate(date) {
    const response = await api.get(`/newsdesk/${date}`);
    return response.data.data;
  },

  /**
   * 최근 N일간 뉴스데스크 목록 조회
   * @param {number} days - 조회할 일수 (기본값: 7)
   */
  async getNewsDeskHistory(days = 7) {
    const response = await api.get('/newsdesk/history', {
      params: { days }
    });
    return response.data.data;
  },

  /**
   * 뉴스데스크 생성 요청
   * @param {Object} options - 생성 옵션
   * @param {string} options.date - 생성할 날짜 (YYYY-MM-DD)
   * @param {boolean} options.force - 기존 데이터 덮어쓰기 여부
   */
  async generateNewsDesk(options = {}) {
    const response = await api.post('/newsdesk/generate', options);
    return response.data.data;
  },

  /**
   * 벤치마크 데이터 조회
   * @param {string} period - 기간 (1W, 1M, 3M, 6M, 1Y)
   */
  async getBenchmarkData(period = '1M') {
    const response = await api.get('/newsdesk/benchmarks', {
      params: { period }
    });
    return response.data.data;
  }
};
