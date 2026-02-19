import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { newsdeskService } from '../services/newsdeskService';
import { useTheme } from '../context/ThemeContext';
import { useSidePanelStore } from '../stores/useSidePanelStore';

// ────────────────────────────────────────────────
// 색상 유틸
// ────────────────────────────────────────────────
function changeColor(pct) {
  if (pct >= 3) return { bg: '#dc2626', text: '#fff' };
  if (pct >= 1.5) return { bg: '#ef4444', text: '#fff' };
  if (pct >= 0.5) return { bg: '#f87171', text: '#fff' };
  if (pct > 0) return { bg: '#fca5a5', text: '#1f2937' };
  if (pct === 0) return { bg: '#6b7280', text: '#fff' };
  if (pct > -0.5) return { bg: '#93c5fd', text: '#1f2937' };
  if (pct > -1.5) return { bg: '#60a5fa', text: '#fff' };
  if (pct > -3) return { bg: '#3b82f6', text: '#fff' };
  return { bg: '#2563eb', text: '#fff' };
}

function sentimentBadge(s) {
  if (s === 'positive') return { label: '긍정', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
  if (s === 'negative') return { label: '부정', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
  return { label: '중립', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
}

function formatNumber(n) {
  if (n == null) return '-';
  if (typeof n === 'string') return n;
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function formatChange(val, pct) {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${formatNumber(val)} (${sign}${pct?.toFixed(2)}%)`;
}

// ────────────────────────────────────────────────
// 지수 카드
// ────────────────────────────────────────────────
function IndexCard({ data, isActive, onClick, isDark }) {
  const isUp = data.change >= 0;
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 min-w-0 p-3 border-2 transition-all duration-200 text-left
        ${isActive
          ? isDark
            ? 'border-emerald-400 bg-emerald-900/20 shadow-lg shadow-emerald-500/10'
            : 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-200'
          : isDark
            ? 'border-gray-600 bg-gray-800/60 hover:border-gray-400'
            : 'border-gray-300 bg-white hover:border-gray-500'
        }
      `}
    >
      <div className={`text-xs font-medium mb-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {data.name}
      </div>
      <div className={`text-lg font-bold tabular-nums truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {formatNumber(data.value)}
      </div>
      <div className={`text-xs font-semibold tabular-nums mt-0.5 truncate ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
        {formatChange(data.change, data.changePct)}
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────
// 브리핑 패널
// ────────────────────────────────────────────────
function BriefingPanel({ briefing, index, isDark }) {
  if (!briefing) return null;
  return (
    <div className={`
      border-2 p-5 animate-in fade-in slide-in-from-top-2 duration-300
      ${isDark ? 'border-gray-600 bg-gray-800/80' : 'border-gray-300 bg-gray-50'}
    `}>
      <div className="flex items-start gap-6">
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-bold mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {index?.name} 증시 브리핑
          </h3>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {briefing.summary}
          </p>
        </div>
        <div className="flex gap-4 shrink-0">
          <div>
            <div className="text-xs font-bold text-red-500 mb-1.5">상승 업종</div>
            {briefing.topSectors?.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs py-0.5">
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{s.name}</span>
                <span className="text-red-500 font-semibold tabular-nums">+{s.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-bold text-blue-500 mb-1.5">하락 업종</div>
            {briefing.bottomSectors?.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs py-0.5">
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{s.name}</span>
                <span className="text-blue-500 font-semibold tabular-nums">{s.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {index && (
        <div className={`
          flex flex-wrap gap-x-6 gap-y-1 mt-3 pt-3 text-xs
          ${isDark ? 'border-t border-gray-700 text-gray-400' : 'border-t border-gray-200 text-gray-500'}
        `}>
          <span>거래량 {index.volume}</span>
          <span>거래대금 {index.tradingValue}</span>
          {index.advancers > 0 && (
            <>
              <span className="text-red-500">상승 {index.advancers}</span>
              <span className="text-blue-500">하락 {index.decliners}</span>
              <span>보합 {index.unchanged}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// 섹터 히트맵 (Finviz 스타일 — 로그 스케일)
// ────────────────────────────────────────────────
function SectorHeatmap({ data, onStockClick, isDark }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const sectors = useMemo(() => {
    const entries = Object.entries(data);
    return entries
      .map(([name, stocks]) => ({
        name,
        stocks: stocks.sort((a, b) => b.cap - a.cap),
        totalCap: stocks.reduce((s, st) => s + st.cap, 0),
        logCap: stocks.reduce((s, st) => s + Math.log(st.cap + 1), 0),
      }))
      .sort((a, b) => b.totalCap - a.totalCap);
  }, [data]);

  const logGrandTotal = useMemo(() => sectors.reduce((s, sec) => s + sec.logCap, 0), [sectors]);

  const layoutRects = useMemo(() => {
    if (dims.w === 0 || dims.h === 0 || logGrandTotal === 0) return [];
    const rects = [];
    let x = 0, remainW = dims.w;

    sectors.forEach((sector) => {
      const sectorW = Math.max(50, (sector.logCap / logGrandTotal) * dims.w);
      const actualW = Math.min(sectorW, remainW);
      if (actualW <= 0) return;

      let y = 0;
      sector.stocks.forEach((stock) => {
        const logCap = Math.log(stock.cap + 1);
        const stockH = Math.max(36, (logCap / sector.logCap) * dims.h);
        const actualH = Math.min(stockH, dims.h - y);
        if (actualH <= 0) return;
        rects.push({ ...stock, sector: sector.name, x, y, w: actualW, h: actualH });
        y += actualH;
      });
      x += actualW;
      remainW -= actualW;
    });
    return rects;
  }, [sectors, logGrandTotal, dims]);

  const sectorLabels = useMemo(() => {
    if (layoutRects.length === 0) return [];
    const map = {};
    layoutRects.forEach((r) => {
      if (!map[r.sector]) map[r.sector] = { x: r.x, y: r.y, w: r.w, name: r.sector };
    });
    return Object.values(map);
  }, [layoutRects]);

  return (
    <div className={`border-2 ${isDark ? 'border-gray-600' : 'border-gray-300'} overflow-hidden`}>
      <div ref={containerRef} className="relative w-full" style={{ height: '420px' }}>
        {layoutRects.map((r, i) => {
          const c = changeColor(r.change);
          const showName = r.w > 50 && r.h > 30;
          const showPct = r.w > 40 && r.h > 44;
          return (
            <div
              key={`${r.ticker}-${i}`}
              onClick={() => onStockClick(r)}
              className="absolute cursor-pointer transition-opacity hover:opacity-80 border border-black/10 flex flex-col items-center justify-center overflow-hidden"
              style={{
                left: r.x, top: r.y, width: r.w, height: r.h,
                backgroundColor: c.bg, color: c.text,
              }}
              title={`${r.name} (${r.ticker}) ${r.change >= 0 ? '+' : ''}${r.change.toFixed(2)}%`}
            >
              {showName && (
                <span className="text-[11px] font-bold leading-tight truncate px-1 max-w-full">
                  {r.w > 80 ? r.name : r.ticker}
                </span>
              )}
              {showPct && (
                <span className="text-[10px] font-semibold leading-tight tabular-nums">
                  {r.change >= 0 ? '+' : ''}{r.change.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
        {sectorLabels.map((s, i) => (
          <div key={i} className="absolute pointer-events-none" style={{ left: s.x + 3, top: s.y + 2 }}>
            <span className="text-[9px] font-bold text-white/70 drop-shadow-sm">{s.name}</span>
          </div>
        ))}
      </div>
      <div className={`
        flex items-center justify-center gap-2 py-2 text-[10px]
        ${isDark ? 'bg-gray-800 border-t border-gray-700 text-gray-400' : 'bg-gray-50 border-t border-gray-200 text-gray-500'}
      `}>
        {[
          { label: '-3%', bg: '#2563eb' },
          { label: '-1.5%', bg: '#60a5fa' },
          { label: '0%', bg: '#6b7280' },
          { label: '+1.5%', bg: '#f87171' },
          { label: '+3%', bg: '#dc2626' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-3 h-3 border border-black/10" style={{ backgroundColor: item.bg }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// 종목 상세 사이드 패널
// ────────────────────────────────────────────────
function StockDetailContent({ stock, isDark }) {
  const { closePanel } = useSidePanelStore();
  const [detail, setDetail] = useState(null);
  const [newsFilter, setNewsFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    newsdeskService.getStockDetail(stock.ticker, stock.name, stock.market)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [stock.ticker, stock.name, stock.market]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!detail) {
    return <div className="p-6 text-center text-gray-500">데이터를 불러올 수 없습니다.</div>;
  }

  const c = changeColor(stock.change);
  const sortedNews = [...(detail.news || [])].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const filteredNews = newsFilter === 'recent' ? sortedNews.filter(n => n.isNew) : sortedNews;

  // SVG 라인 차트
  const closes = (detail.ohlcv || []).map(d => d.close);
  const minY = closes.length > 0 ? Math.min(...closes) * 0.998 : 0;
  const maxY = closes.length > 0 ? Math.max(...closes) * 1.002 : 1;
  const CW = 400, CH = 100;
  const svgLine = closes.length > 1
    ? closes.map((y, i) => {
        const px = (i / (closes.length - 1)) * CW;
        const py = CH - ((y - minY) / (maxY - minY || 1)) * CH;
        return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
      }).join(' ')
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 + 닫기 */}
      <div className={`px-5 py-3 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 w-10 h-10 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: c.bg, color: c.text }}
          >
            {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(1)}%
          </div>
          <div className="min-w-0">
            <h2 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stock.name}
            </h2>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {stock.ticker} · {stock.sector || stock.market}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); closePanel(); }}
          className={`shrink-0 p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          title="닫기 (ESC)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 가격 차트 */}
        <section className={`px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>30일 가격 추이</h3>
            {closes.length > 0 && (
              <span className={`text-[10px] tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {formatNumber(closes[closes.length - 1])}
              </span>
            )}
          </div>
          {closes.length > 1 ? (
            <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" style={{ height: '100px' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id={`cg-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stock.change >= 0 ? '#ef4444' : '#3b82f6'} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={stock.change >= 0 ? '#ef4444' : '#3b82f6'} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={`${svgLine} L${CW},${CH} L0,${CH} Z`} fill={`url(#cg-${stock.ticker})`} />
              <path d={svgLine} fill="none" stroke={stock.change >= 0 ? '#ef4444' : '#3b82f6'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <div className={`h-24 flex items-center justify-center text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
              차트 데이터 대기 중
            </div>
          )}
        </section>

        {/* AI 기술적 분석 */}
        {detail.analysis && (
          <section className={`px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-xs font-bold mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              AI 기술적 분석
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {detail.analysis.technical}
            </p>
            {detail.analysis.signals?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {detail.analysis.signals.map((sig, i) => (
                  <span
                    key={i}
                    className={`px-2 py-0.5 text-[10px] font-medium
                      ${isDark
                        ? 'bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }
                    `}
                  >
                    {sig}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 종목 소개 */}
        {detail.profile && (
          <section className={`px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-xs font-bold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>종목 소개</h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {detail.profile.description}
            </p>
          </section>
        )}

        {/* 관련 뉴스 */}
        <section className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              관련 뉴스 ({filteredNews.length})
            </h3>
            <div className="flex gap-1">
              {['all', 'recent'].map((f) => (
                <button
                  key={f}
                  onClick={() => setNewsFilter(f)}
                  className={`px-2 py-0.5 text-[10px] font-medium border transition-colors
                    ${newsFilter === f
                      ? isDark
                        ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                        : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : isDark
                        ? 'border-gray-600 text-gray-400 hover:border-gray-400'
                        : 'border-gray-300 text-gray-500 hover:border-gray-500'
                    }
                  `}
                >
                  {f === 'all' ? '종합' : '최신'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredNews.length === 0 ? (
              <p className={`text-xs text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                해당 필터에 맞는 뉴스가 없습니다.
              </p>
            ) : (
              filteredNews.map((news) => {
                const badge = sentimentBadge(news.sentiment);
                const isExpanded = expandedId === news.id;
                return (
                  <div
                    key={news.id}
                    onClick={() => setExpandedId(isExpanded ? null : news.id)}
                    className={`p-3 border transition-all cursor-pointer
                      ${isExpanded
                        ? isDark
                          ? 'border-emerald-500/50 bg-gray-800'
                          : 'border-emerald-400 bg-emerald-50/30'
                        : isDark
                          ? 'border-gray-700 hover:border-gray-500 bg-gray-800/50'
                          : 'border-gray-200 hover:border-gray-400 bg-white'
                      }
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`
                        shrink-0 min-w-[26px] text-center px-1 py-0.5 text-[10px] font-bold tabular-nums
                        ${news.relevanceScore >= 100
                          ? 'bg-red-600 text-white'
                          : news.relevanceScore >= 80
                            ? 'bg-red-500 text-white'
                            : news.relevanceScore >= 60
                              ? 'bg-yellow-500 text-white'
                              : isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700'
                        }
                      `}>
                        {news.relevanceScore}
                      </span>
                      {news.isNew && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white">
                          NEW
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-semibold leading-snug ${isExpanded ? '' : 'line-clamp-1'} ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {news.title}
                        </h4>
                        {!isExpanded && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{news.source}</span>
                            <span className={`px-1 py-0 text-[9px] font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 ml-[34px]">
                        <p className={`text-[11px] leading-relaxed mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {news.summary}
                        </p>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>{news.source}</span>
                          <span className={isDark ? 'text-gray-600' : 'text-gray-300'}>·</span>
                          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                            {new Date(news.publishedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.cls}`}>{badge.label}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────
export function NewsDesk() {
  const { isCurrentThemeDark } = useTheme();
  const { openPanel } = useSidePanelStore();
  const isDark = isCurrentThemeDark;

  const [indices, setIndices] = useState([]);
  const [activeMarket, setActiveMarket] = useState(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [heatmapData, setHeatmapData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    newsdeskService.getMarketIndices()
      .then((data) => {
        setIndices(data);
        if (data.length > 0) setActiveMarket(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeMarket) return;
    const marketMap = { kospi: 'KOSPI', kosdaq: 'KOSDAQ', nasdaq: 'NASDAQ', btc: 'CRYPTO' };
    newsdeskService.getHeatmapData(marketMap[activeMarket] || 'KOSPI').then(setHeatmapData);
  }, [activeMarket]);

  const activeIndex = indices.find(i => i.id === activeMarket);

  const handleCardClick = useCallback((id) => {
    if (activeMarket === id && briefingOpen) {
      setBriefingOpen(false);
    } else {
      setActiveMarket(id);
      setBriefingOpen(true);
      newsdeskService.getMarketBriefing(id).then(setBriefing);
    }
  }, [activeMarket, briefingOpen]);

  const handleStockClick = useCallback((stock) => {
    const enriched = { ...stock, market: activeIndex?.name || activeMarket };
    openPanel({
      type: 'custom',
      data: { render: () => <StockDetailContent stock={enriched} isDark={isDark} /> },
    });
  }, [openPanel, isDark, activeIndex, activeMarket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>뉴스데스크 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4 min-w-0">
      <div className="flex items-center justify-between min-w-0">
        <h1 className={`text-xl font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>뉴스데스크</h1>
        <span className={`text-xs shrink-0 ml-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          마지막 업데이트: {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="flex gap-2">
        {indices.map((idx) => (
          <IndexCard
            key={idx.id}
            data={idx}
            isActive={activeMarket === idx.id}
            onClick={() => handleCardClick(idx.id)}
            isDark={isDark}
          />
        ))}
      </div>

      {briefingOpen && briefing && (
        <BriefingPanel briefing={briefing} index={activeIndex} isDark={isDark} />
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            섹터 히트맵 — {activeIndex?.name || ''}
          </h2>
          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            블록 크기: 시가총액 비중(log) · 색상: 등락률
          </span>
        </div>
        <SectorHeatmap
          data={heatmapData}
          onStockClick={handleStockClick}
          isDark={isDark}
        />
      </div>
    </div>
  );
}
