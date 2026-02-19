import api from './api';

// ────────────────────────────────────────────────
// 목업 데이터 (백엔드 연동 전까지 사용)
// ────────────────────────────────────────────────
const USE_MOCK = true;

const MOCK_INDICES = [
  {
    id: 'kospi',
    name: '코스피',
    market: 'KOSPI',
    value: 2687.45,
    change: 23.18,
    changePct: 0.87,
    volume: '8.2억주',
    tradingValue: '12.4조',
    advancers: 524,
    decliners: 341,
    unchanged: 72,
  },
  {
    id: 'kosdaq',
    name: '코스닥',
    market: 'KOSDAQ',
    value: 878.32,
    change: -5.61,
    changePct: -0.63,
    volume: '14.1억주',
    tradingValue: '8.7조',
    advancers: 612,
    decliners: 798,
    unchanged: 134,
  },
  {
    id: 'nasdaq',
    name: 'NASDAQ',
    market: 'NASDAQ',
    value: 20041.26,
    change: 152.38,
    changePct: 0.77,
    volume: '6.8B',
    tradingValue: '$312B',
    advancers: 1823,
    decliners: 1241,
    unchanged: 189,
  },
  {
    id: 'btc',
    name: 'BTC',
    market: 'CRYPTO',
    value: 97842.50,
    change: 1283.40,
    changePct: 1.33,
    volume: '$48.2B',
    tradingValue: '$48.2B',
    advancers: 0,
    decliners: 0,
    unchanged: 0,
  },
];

const MOCK_BRIEFINGS = {
  kospi: {
    summary: '코스피가 외국인 매수세에 힘입어 2,687선을 회복했습니다. 반도체·2차전지 대형주가 강세를 보였으며, 삼성전자(+1.8%)와 SK하이닉스(+2.4%)가 지수 상승을 주도했습니다. 반면 화학·건설 업종은 약세를 보이며 차별화된 장세가 이어졌습니다.',
    topSectors: [
      { name: '반도체', change: 2.14 },
      { name: '2차전지', change: 1.87 },
      { name: '바이오', change: 0.92 },
    ],
    bottomSectors: [
      { name: '건설', change: -1.23 },
      { name: '화학', change: -0.95 },
      { name: '유틸리티', change: -0.41 },
    ],
  },
  kosdaq: {
    summary: '코스닥은 개인 매도세에 하락 마감했습니다. AI·로봇 관련 중소형주가 차익실현 매물에 눌린 반면, 제약·바이오 섹터는 신약 임상 소식에 강세를 보였습니다. 외국인은 소폭 순매수를 기록했습니다.',
    topSectors: [
      { name: '제약/바이오', change: 1.52 },
      { name: '엔터', change: 0.88 },
      { name: '게임', change: 0.34 },
    ],
    bottomSectors: [
      { name: 'AI/로봇', change: -2.15 },
      { name: '소프트웨어', change: -1.33 },
      { name: '디스플레이', change: -0.78 },
    ],
  },
  nasdaq: {
    summary: 'NASDAQ이 기술주 반등에 힘입어 상승 마감했습니다. NVIDIA(+3.2%)와 Apple(+1.1%)이 강세를 보였고, Fed 의사록 공개 이후 금리 인하 기대감이 시장을 지지했습니다. Mag7 전반적으로 양호한 흐름을 보였습니다.',
    topSectors: [
      { name: 'Semiconductors', change: 2.87 },
      { name: 'Software', change: 1.45 },
      { name: 'Cloud', change: 1.12 },
    ],
    bottomSectors: [
      { name: 'EV', change: -1.55 },
      { name: 'Biotech', change: -0.89 },
      { name: 'Fintech', change: -0.34 },
    ],
  },
  btc: {
    summary: '비트코인이 $97,800대를 회복하며 강세 흐름을 이어갔습니다. 기관 투자자 유입이 지속되고 있으며, ETF 순유입이 $420M을 기록했습니다. 이더리움(+2.1%)과 솔라나(+4.3%)도 동반 상승했습니다.',
    topSectors: [
      { name: 'L1', change: 3.21 },
      { name: 'DeFi', change: 2.45 },
      { name: 'AI tokens', change: 1.89 },
    ],
    bottomSectors: [
      { name: 'Meme', change: -3.12 },
      { name: 'Gaming', change: -1.45 },
      { name: 'NFT', change: -0.98 },
    ],
  },
};

function generateHeatmapData(market) {
  const sectors = {
    KOSPI: {
      '반도체': [
        { ticker: '005930', name: '삼성전자', cap: 420, change: 1.82 },
        { ticker: '000660', name: 'SK하이닉스', cap: 148, change: 2.41 },
        { ticker: '042700', name: '한미반도체', cap: 12, change: 3.15 },
      ],
      '2차전지': [
        { ticker: '373220', name: 'LG에너지솔루션', cap: 95, change: 1.87 },
        { ticker: '006400', name: '삼성SDI', cap: 28, change: 0.92 },
        { ticker: '247540', name: '에코프로비엠', cap: 15, change: -0.45 },
      ],
      '바이오': [
        { ticker: '207940', name: '삼성바이오로직스', cap: 62, change: 0.55 },
        { ticker: '068270', name: '셀트리온', cap: 35, change: -0.23 },
        { ticker: '326030', name: 'SK바이오팜', cap: 11, change: 1.34 },
      ],
      '자동차': [
        { ticker: '005380', name: '현대차', cap: 55, change: -0.67 },
        { ticker: '000270', name: '기아', cap: 42, change: -0.35 },
        { ticker: '012330', name: '현대모비스', cap: 18, change: 0.12 },
      ],
      '금융': [
        { ticker: '055550', name: '신한지주', cap: 25, change: 0.88 },
        { ticker: '105560', name: 'KB금융', cap: 28, change: 0.64 },
        { ticker: '086790', name: '하나금융지주', cap: 15, change: 0.33 },
      ],
      '화학': [
        { ticker: '051910', name: 'LG화학', cap: 30, change: -1.23 },
        { ticker: '096770', name: 'SK이노베이션', cap: 14, change: -0.95 },
      ],
      '건설': [
        { ticker: '000720', name: '현대건설', cap: 8, change: -1.55 },
        { ticker: '047040', name: '대우건설', cap: 4, change: -0.87 },
      ],
      'IT': [
        { ticker: '035720', name: '카카오', cap: 18, change: 0.42 },
        { ticker: '035420', name: 'NAVER', cap: 40, change: -0.18 },
        { ticker: '263750', name: '펄어비스', cap: 5, change: 1.92 },
      ],
    },
    KOSDAQ: {
      '바이오': [
        { ticker: '196170', name: '알테오젠', cap: 22, change: 2.54 },
        { ticker: '145020', name: '휴젤', cap: 8, change: 1.12 },
        { ticker: '950160', name: '코오롱티슈진', cap: 4, change: -1.23 },
      ],
      'AI/로봇': [
        { ticker: '454910', name: '레인보우로보틱스', cap: 6, change: -2.87 },
        { ticker: '323990', name: '박셀바이오', cap: 3, change: -1.45 },
      ],
      '엔터': [
        { ticker: '352820', name: '하이브', cap: 10, change: 1.33 },
        { ticker: '041510', name: 'SM', cap: 5, change: 0.55 },
      ],
      '게임': [
        { ticker: '293490', name: '카카오게임즈', cap: 4, change: 0.67 },
        { ticker: '112040', name: '위메이드', cap: 3, change: -0.89 },
      ],
      '소프트웨어': [
        { ticker: '036570', name: '엔씨소프트', cap: 7, change: -0.34 },
        { ticker: '030520', name: '한글과컴퓨터', cap: 3, change: 0.22 },
      ],
    },
    NASDAQ: {
      'Mega Cap': [
        { ticker: 'AAPL', name: 'Apple', cap: 380, change: 1.12 },
        { ticker: 'MSFT', name: 'Microsoft', cap: 320, change: 0.87 },
        { ticker: 'NVDA', name: 'NVIDIA', cap: 340, change: 3.24 },
        { ticker: 'GOOG', name: 'Alphabet', cap: 220, change: 0.45 },
        { ticker: 'AMZN', name: 'Amazon', cap: 210, change: 0.93 },
        { ticker: 'META', name: 'Meta', cap: 170, change: 1.56 },
        { ticker: 'TSLA', name: 'Tesla', cap: 85, change: -1.23 },
      ],
      'Semiconductors': [
        { ticker: 'AMD', name: 'AMD', cap: 45, change: 2.45 },
        { ticker: 'AVGO', name: 'Broadcom', cap: 90, change: 1.87 },
        { ticker: 'QCOM', name: 'Qualcomm', cap: 28, change: 0.56 },
        { ticker: 'MU', name: 'Micron', cap: 15, change: 1.12 },
      ],
      'Software': [
        { ticker: 'CRM', name: 'Salesforce', cap: 32, change: 1.34 },
        { ticker: 'ADBE', name: 'Adobe', cap: 28, change: 0.78 },
        { ticker: 'NOW', name: 'ServiceNow', cap: 22, change: 1.92 },
      ],
      'Cloud': [
        { ticker: 'SNOW', name: 'Snowflake', cap: 12, change: 1.45 },
        { ticker: 'NET', name: 'Cloudflare', cap: 8, change: 0.67 },
        { ticker: 'DDOG', name: 'Datadog', cap: 6, change: 0.89 },
      ],
      'EV': [
        { ticker: 'RIVN', name: 'Rivian', cap: 8, change: -2.34 },
        { ticker: 'LCID', name: 'Lucid', cap: 4, change: -1.56 },
      ],
    },
    CRYPTO: {
      'Layer 1': [
        { ticker: 'BTC', name: 'Bitcoin', cap: 1920, change: 1.33 },
        { ticker: 'ETH', name: 'Ethereum', cap: 420, change: 2.12 },
        { ticker: 'SOL', name: 'Solana', cap: 95, change: 4.34 },
        { ticker: 'ADA', name: 'Cardano', cap: 22, change: 1.23 },
        { ticker: 'AVAX', name: 'Avalanche', cap: 14, change: 0.87 },
      ],
      'DeFi': [
        { ticker: 'UNI', name: 'Uniswap', cap: 8, change: 2.56 },
        { ticker: 'AAVE', name: 'Aave', cap: 5, change: 1.89 },
        { ticker: 'LDO', name: 'Lido', cap: 3, change: 0.45 },
      ],
      'AI Tokens': [
        { ticker: 'FET', name: 'Fetch.ai', cap: 4, change: 3.45 },
        { ticker: 'RNDR', name: 'Render', cap: 5, change: 1.23 },
        { ticker: 'TAO', name: 'Bittensor', cap: 6, change: -0.78 },
      ],
      'Meme': [
        { ticker: 'DOGE', name: 'Dogecoin', cap: 28, change: -2.34 },
        { ticker: 'SHIB', name: 'Shiba Inu', cap: 10, change: -3.12 },
        { ticker: 'PEPE', name: 'Pepe', cap: 5, change: -4.56 },
      ],
    },
  };
  return sectors[market] || {};
}

function generateOHLCV(basePrice = 83000, days = 30) {
  const data = [];
  let price = basePrice;
  for (let i = days; i >= 0; i--) {
    const change = (Math.random() - 0.48) * basePrice * 0.025;
    const open = Math.round(price);
    const close = Math.round(price + change);
    const high = Math.round(Math.max(open, close) + Math.random() * basePrice * 0.008);
    const low = Math.round(Math.min(open, close) - Math.random() * basePrice * 0.008);
    const volume = Math.floor(Math.random() * 20000000 + 5000000);
    data.push({ date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), open, high, low, close, volume });
    price = close;
  }
  return data;
}

const MOCK_AI_ANALYSIS = {
  '005930': {
    technical: '20일 이동평균선(82,100원) 위에서 안정적 지지 확인 중. 최근 5거래일 거래량 평균 대비 23% 증가, 매수세 강화. MACD 히스토그램 양전환, RSI(58) 과매수 진입 전으로 추가 상승 여력 있음. 볼린저밴드 상단(85,200원) 돌파 시도 가능.',
    signals: ['골든크로스 임박 (5/20MA)', '거래량 증가', 'MACD 양전환', 'RSI 중립(58)'],
  },
  NVDA: {
    technical: 'AI 수요 확대로 강한 상승 모멘텀 유지. 50일 이평선 위에서 견고한 지지. 다만 RSI(72) 과매수 근접으로 단기 숨고르기 가능.',
    signals: ['강한 상승 추세', '과매수 경계(RSI 72)', '50MA 지지'],
  },
  BTC: {
    technical: '$97,000 저항선 재차 돌파 시도 중. 기관 자금 유입 지속, ETF 순유입 양호. 4시간봉 상승 삼각 수렴 패턴 형성, 돌파 시 $100K 테스트 예상.',
    signals: ['상승 삼각 수렴', 'ETF 순유입 지속', '$100K 저항 테스트'],
  },
};

const MOCK_PROFILES = {
  '005930': { description: '세계 최대 메모리 반도체 제조업체. DRAM·NAND, 시스템 반도체(파운드리·LSI), 스마트폰(갤럭시), 디스플레이. HBM 시장에서 AI 수요 수혜 중.' },
  '000660': { description: 'SK그룹 산하 메모리 반도체 전문기업. DRAM·NAND 세계 2위. HBM3E 양산으로 AI 데이터센터 공급 확대.' },
  NVDA: { description: 'GPU 및 AI 가속기 글로벌 선두. 데이터센터 AI 칩(H100, B200), 자율주행(DRIVE), 로보틱스(Jetson). AI 인프라 투자 최대 수혜주.' },
  AAPL: { description: '아이폰, 맥, 아이패드 프리미엄 하드웨어 + iOS 생태계. 서비스 매출(앱스토어, Apple Music, iCloud) 비중 확대 중.' },
  BTC: { description: '최초의 탈중앙화 디지털 자산. 2,100만개 발행 한도. 기관 투자자 디지털 골드 포지셔닝 + 현물 ETF 승인으로 전통 금융 편입 가속.' },
  ETH: { description: '스마트 컨트랙트 플랫폼 1위. PoS 전환 완료. DeFi, NFT, L2 생태계 기반 레이어. EIP-4844로 L2 수수료 대폭 절감.' },
};

function generateStockNews(ticker, name) {
  const now = Date.now();
  const DAY = 86400000;
  return [
    {
      id: 1,
      title: `${name}, 실적 서프라이즈에 목표가 상향 잇따라`,
      summary: `${name}이(가) 시장 예상을 뛰어넘는 실적을 발표했습니다. 매출과 영업이익 모두 컨센서스를 상회하며, 주요 증권사들이 목표가를 상향 조정했습니다. 4분기 매출은 전년 대비 +32% 성장하며 역대 최대치를 경신했습니다.`,
      source: '한국경제',
      publishedAt: new Date(now - DAY * 0.5).toISOString(),
      relevanceScore: 127,
      sentiment: 'positive',
      isNew: true,
    },
    {
      id: 2,
      title: `${name} 업종 글로벌 공급망 재편 수혜 — 수출 지표 호조`,
      summary: `미중 갈등 장기화에 따른 글로벌 공급망 재편이 가속화되면서, ${name}을(를) 포함한 국내 기업들이 반사 이익을 볼 것이라는 전망입니다. 이달 수출 실적 전년 대비 +18.3% 호조.`,
      source: '조선비즈',
      publishedAt: new Date(now - DAY * 8).toISOString(),
      relevanceScore: 112,
      sentiment: 'positive',
      isNew: false,
    },
    {
      id: 3,
      title: `"${name} 장기 성장 전망 밝아" — 외국인 순매수 지속`,
      summary: `외국인 투자자들이 ${name}에 대한 순매수를 이어가고 있습니다. 글로벌 수급 환경 개선과 함께 장기 성장성에 대한 기대감이 반영된 것으로 분석됩니다.`,
      source: '매일경제',
      publishedAt: new Date(now - DAY * 1).toISOString(),
      relevanceScore: 88,
      sentiment: 'positive',
      isNew: true,
    },
    {
      id: 4,
      title: `${name}, 신규 사업 진출로 사업 다각화 가속`,
      summary: `${name}이(가) AI·클라우드 분야 진출을 본격화하면서 기존 주력 사업 외 신성장 동력 확보에 나서고 있습니다.`,
      source: '서울경제',
      publishedAt: new Date(now - DAY * 5).toISOString(),
      relevanceScore: 65,
      sentiment: 'positive',
      isNew: false,
    },
    {
      id: 5,
      title: `"${name} 밸류에이션 부담" — 단기 조정 경계 시각`,
      summary: `최근 급등으로 밸류에이션 부담이 커졌다는 시각이 있습니다. PER이 업종 평균을 상회하면서 단기 조정 가능성에 대한 우려도 제기됩니다.`,
      source: '이데일리',
      publishedAt: new Date(now - DAY * 3).toISOString(),
      relevanceScore: 43,
      sentiment: 'negative',
      isNew: false,
    },
  ];
}

const MOCK_STOCK_DETAIL = (ticker, name, market) => ({
  ticker,
  name,
  market,
  ohlcv: generateOHLCV(ticker === 'BTC' ? 97000 : ticker === 'ETH' ? 3200 : /^[A-Z]{1,5}$/.test(ticker) ? 180 : 83000),
  analysis: MOCK_AI_ANALYSIS[ticker] || {
    technical: '현재 주가는 단기 이동평균선 부근에서 횡보 중. 거래량 평균 수준 유지, 뚜렷한 방향성 없음. 볼린저밴드 폭 축소로 조만간 변동성 확대 예상.',
    signals: ['볼린저밴드 수축', '방향성 탐색 중'],
  },
  profile: MOCK_PROFILES[ticker] || {
    description: `${name}에 대한 AI 종목 프로필이 아직 생성되지 않았습니다. 다음 분석 사이클에서 자동 생성됩니다.`,
  },
  news: generateStockNews(ticker, name),
});

// ────────────────────────────────────────────────
// 서비스
// ────────────────────────────────────────────────
export const newsdeskService = {
  // ── v1 (하위호환, 추후 제거) ──
  async getTodayNewsDesk() {
    const response = await api.get('/newsdesk/today');
    return response.data.data;
  },
  async getNewsDeskByDate(date) {
    const response = await api.get(`/newsdesk/${date}`);
    return response.data.data;
  },
  async getNewsDeskHistory(days = 7) {
    const response = await api.get('/newsdesk/history', { params: { days } });
    return response.data.data;
  },
  async getBenchmarkData(period = '1M') {
    const response = await api.get('/newsdesk/benchmarks', { params: { period } });
    return response.data.data;
  },

  // ── v2 ──
  async getMarketIndices() {
    if (USE_MOCK) return MOCK_INDICES;
    const response = await api.get('/newsdesk/v2/market-summary');
    return response.data.data;
  },

  async getMarketBriefing(marketId) {
    if (USE_MOCK) return MOCK_BRIEFINGS[marketId] || null;
    const response = await api.get(`/newsdesk/v2/market-summary`, { params: { market: marketId } });
    return response.data.data;
  },

  async getHeatmapData(market) {
    if (USE_MOCK) return generateHeatmapData(market);
    const response = await api.get('/newsdesk/v2/stocks', { params: { market } });
    return response.data.data;
  },

  async getStockDetail(ticker, name, market) {
    if (USE_MOCK) return MOCK_STOCK_DETAIL(ticker, name, market);
    const response = await api.get(`/newsdesk/v2/stocks/${ticker}`);
    return response.data.data;
  },
};
