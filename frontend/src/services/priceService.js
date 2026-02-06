import api from './api';

export const priceService = {
  // 종목 검색 (종목명 또는 티커로 검색)
  async searchStocks(query, market = null, limit = 20) {
    const params = { q: query, limit };
    if (market) params.market = market;

    const response = await api.get('/prices/search', { params });
    return response.data;
  },

  // 단일 종목 시세 조회
  async getQuote(ticker, market) {
    const response = await api.get('/prices/quote', {
      params: { ticker, market }
    });
    return response.data.data;
  },

  // 종목 코드로 종목명과 현재가 조회
  async lookupTicker(ticker, market) {
    const response = await api.get('/prices/lookup', {
      params: { ticker, market }
    });
    return response.data;
  },

  // 열린 포지션들의 시세 및 평가 정보
  async getPositionsWithPrices() {
    const response = await api.get('/prices/positions');
    return response.data.data;
  },

  // 캔들(차트) 데이터 조회
  // before: Unix timestamp - 이 시간 이전의 과거 데이터 조회 (lazy loading용)
  async getCandles(ticker, market, timeframe = '1d', limit = 300, before = null) {
    const params = { ticker, market, timeframe, limit };
    if (before) {
      params.before = before;
    }
    const response = await api.get('/prices/candles', { params });
    return response.data;
  }
};
