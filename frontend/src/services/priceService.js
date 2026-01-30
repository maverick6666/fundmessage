import api from './api';

export const priceService = {
  // 단일 종목 시세 조회
  async getQuote(ticker, market) {
    const response = await api.get('/prices/quote', {
      params: { ticker, market }
    });
    return response.data.data;
  },

  // 열린 포지션들의 시세 및 평가 정보
  async getPositionsWithPrices() {
    const response = await api.get('/prices/positions');
    return response.data.data;
  }
};
