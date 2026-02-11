// 시장 옵션
export const MARKETS = [
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
  { value: 'NASDAQ', label: '나스닥' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'CRYPTO', label: '크립토' },
];

// 차트 타임프레임 옵션
export const TIMEFRAMES = [
  { value: '1d', label: '일봉' },
  { value: '1w', label: '주봉' },
  { value: '1M', label: '월봉' },
];

// 입력 제한값
export const MAX_PRICE = 1000000000000;
export const MAX_QUANTITY = 1000000000;
export const MAX_TARGETS = 4;

// UI 상수
export const SEARCH_DEBOUNCE_MS = 300;
export const PRICE_REFRESH_INTERVAL_MS = 60000;
export const CHART_CANDLE_LIMIT = 100;
