import { useState, useEffect, useCallback, useRef } from 'react';
import { newsdeskService } from '../services/newsdeskService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useSidePanelStore } from '../stores/useSidePanelStore';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/formatters';

// 키워드 버블 컴포넌트
function KeywordBubble({ keyword, count, sentimentScore, isSelected, onClick, index }) {
  // 크기 계산 (count 기반, 40-100px)
  const size = Math.max(48, Math.min(96, 40 + count * 4));

  // 감성 색상 (긍정: emerald, 중립: slate, 부정: rose)
  const getBubbleColor = () => {
    if (sentimentScore > 0.3) return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300';
    if (sentimentScore < -0.3) return 'bg-rose-500/20 border-rose-500/50 text-rose-700 dark:text-rose-300';
    return 'bg-slate-500/20 border-slate-500/50 text-slate-700 dark:text-slate-300';
  };

  const selectedStyle = isSelected
    ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-900 scale-110'
    : 'hover:scale-105';

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center justify-center rounded-full border-2
        transition-all duration-300 cursor-pointer font-medium
        ${getBubbleColor()} ${selectedStyle}
      `}
      style={{
        width: size,
        height: size,
        animationDelay: `${index * 100}ms`
      }}
    >
      <span className="text-xs text-center leading-tight px-1 line-clamp-2">
        {keyword}
      </span>
      <span className="absolute -bottom-1 -right-1 text-[10px] bg-white dark:bg-gray-800 px-1 rounded-full border">
        {count}
      </span>
    </button>
  );
}

// 감성 게이지 컴포넌트
function SentimentGauge({ sentiment, selectedKeyword }) {
  const positiveRatio = sentiment?.positive_ratio || 0.33;
  const negativeRatio = sentiment?.negative_ratio || 0.33;
  const neutralRatio = sentiment?.neutral_ratio || 0.34;

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          시장 감성
        </h3>
        {selectedKeyword && (
          <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
            {selectedKeyword}
          </span>
        )}
      </div>

      {/* 게이지 바 */}
      <div className="h-8 flex rounded overflow-hidden border border-gray-200 dark:border-gray-700">
        <div
          className="bg-gradient-to-r from-emerald-400 to-emerald-500 flex items-center justify-center transition-all duration-500"
          style={{ width: `${positiveRatio * 100}%` }}
        >
          {positiveRatio > 0.15 && (
            <span className="text-xs font-bold text-white">
              {Math.round(positiveRatio * 100)}%
            </span>
          )}
        </div>
        <div
          className="bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center transition-all duration-500"
          style={{ width: `${neutralRatio * 100}%` }}
        >
          {neutralRatio > 0.15 && (
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {Math.round(neutralRatio * 100)}%
            </span>
          )}
        </div>
        <div
          className="bg-gradient-to-r from-rose-400 to-rose-500 flex items-center justify-center transition-all duration-500"
          style={{ width: `${negativeRatio * 100}%` }}
        >
          {negativeRatio > 0.15 && (
            <span className="text-xs font-bold text-white">
              {Math.round(negativeRatio * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          호재
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          중립
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          악재
        </span>
      </div>
    </div>
  );
}

// 뉴스 카드 컴포넌트
function NewsCard({ card, type = 'news', onClick }) {
  const isColumn = type === 'column';

  const categoryColors = {
    '경제': 'bg-blue-500',
    '기업': 'bg-purple-500',
    '정책': 'bg-amber-500',
    '글로벌': 'bg-teal-500',
    '기술': 'bg-cyan-500',
    'default': 'bg-gray-500'
  };

  const categoryColor = categoryColors[card.category] || categoryColors.default;

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
    >
      <div className={`
        relative overflow-hidden bg-white dark:bg-gray-800
        border-2 border-black dark:border-gray-600
        hover:border-primary-500 dark:hover:border-primary-400
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg
      `}>
        {/* 상단 색상 바 */}
        <div className={`h-1 ${isColumn ? 'bg-gradient-to-r from-amber-500 to-orange-500' : categoryColor}`} />

        <div className="p-4">
          {/* 카테고리 & 시간 */}
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              isColumn ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {isColumn ? 'AI 칼럼' : card.category || 'NEWS'}
            </span>
            {card.source && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {card.source}
              </span>
            )}
          </div>

          {/* 제목 */}
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
            {card.title}
          </h3>

          {/* 요약 */}
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {card.summary}
          </p>
        </div>

        {/* 호버 시 화살표 표시 */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// 주목 종목 카드 컴포넌트
function TopStockCard({ stock, rank, onClick }) {
  const rankColors = ['bg-amber-500', 'bg-gray-400', 'bg-orange-600'];
  const rankBg = rankColors[rank - 1] || 'bg-gray-500';

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none"
    >
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 hover:border-primary-500 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
        {/* 순위 배지 */}
        <div className={`absolute top-0 left-0 ${rankBg} text-white text-xs font-bold px-2 py-1`}>
          #{rank}
        </div>

        <div className="p-4 pt-8">
          {/* 종목명 & 마켓 */}
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {stock.name}
            </h4>
            <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-400">
              {stock.market}
            </span>
          </div>

          {/* 티커 */}
          <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-3">
            {stock.ticker}
          </p>

          {/* 언급 횟수 */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${Math.min((stock.mention_count || 0) * 10, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {stock.mention_count || 0}회 언급
            </span>
          </div>

          {/* 이유 */}
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {stock.reason}
          </p>
        </div>
      </div>
    </button>
  );
}

// 벤치마크 차트 토글 컴포넌트 (추후 확장용)
function BenchmarkToggles({ selected, onChange }) {
  const benchmarks = [
    { id: 'kospi', label: '코스피', color: 'bg-red-500' },
    { id: 'nasdaq', label: '나스닥', color: 'bg-blue-500' },
    { id: 'sp500', label: 'S&P500', color: 'bg-green-500' },
    { id: 'fund', label: '우리팀', color: 'bg-purple-500' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {benchmarks.map((b) => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
            border-2 transition-all duration-200
            ${selected.includes(b.id)
              ? 'border-black dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }
          `}
        >
          <div className={`w-2 h-2 rounded-full ${b.color}`} />
          {b.label}
        </button>
      ))}
    </div>
  );
}

// 사이드 패널용 문서 뷰어
function NewsDetailPanel({ content, onClose }) {
  if (!content) return null;

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-bold dark:text-gray-100">
          {content.type === 'column' ? 'AI 칼럼' : content.type === 'stock' ? '종목 분석' : '뉴스 상세'}
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xl font-bold mb-4 dark:text-gray-100">{content.title}</h3>

        {content.source && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            출처: {content.source}
          </p>
        )}

        <div className="prose dark:prose-invert max-w-none">
          {content.content || content.summary}
        </div>

        {content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-4 text-primary-600 hover:text-primary-700 text-sm"
          >
            원문 보기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// 메인 뉴스데스크 컴포넌트
export function NewsDesk() {
  const { isManagerOrAdmin } = useAuth();
  const toast = useToast();
  const { isCurrentThemeDark } = useTheme();
  const { openPanel, closePanel } = useSidePanelStore();

  const [newsDesk, setNewsDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(['kospi', 'fund']);
  const [detailContent, setDetailContent] = useState(null);

  // 데이터 로드
  const fetchNewsDesk = useCallback(async () => {
    try {
      setLoading(true);
      const data = await newsdeskService.getTodayNewsDesk();
      setNewsDesk(data);
    } catch (error) {
      console.error('Failed to fetch newsdesk:', error);
      // 오늘 데이터가 없는 경우
      if (error.response?.status === 404) {
        setNewsDesk(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNewsDesk();
  }, [fetchNewsDesk]);

  // 뉴스데스크 생성
  const handleGenerate = async () => {
    try {
      setGenerating(true);
      toast.info('뉴스데스크를 생성하고 있습니다. 잠시만 기다려주세요...');
      await newsdeskService.generateNewsDesk({ force: false });
      toast.success('뉴스데스크가 생성되었습니다!');
      fetchNewsDesk();
    } catch (error) {
      toast.error(error.response?.data?.detail || '뉴스데스크 생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // 벤치마크 토글
  const handleBenchmarkToggle = (id) => {
    setSelectedBenchmarks(prev =>
      prev.includes(id)
        ? prev.filter(b => b !== id)
        : [...prev, id]
    );
  };

  // 키워드 클릭
  const handleKeywordClick = (keyword) => {
    setSelectedKeyword(prev => prev === keyword ? null : keyword);
    // TODO: 해당 키워드 관련 감성 데이터로 업데이트
  };

  // 뉴스/칼럼 클릭 → 사이드패널
  const handleCardClick = (card, type) => {
    setDetailContent({ ...card, type });
    openPanel({
      type: 'custom',
      data: {
        render: () => (
          <NewsDetailPanel
            content={{ ...card, type }}
            onClose={closePanel}
          />
        )
      }
    });
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-primary-500 rounded-full animate-spin" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">뉴스데스크 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 데이터 없음 상태
  if (!newsDesk || newsDesk.status === 'pending') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            뉴스데스크
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            오늘의 뉴스데스크가 아직 없습니다
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
            AI가 오늘의 뉴스를 분석하여 인사이트를 생성합니다.<br />
            매일 오전 6시에 자동으로 업데이트됩니다.
          </p>
          {isManagerOrAdmin() && (
            <Button onClick={handleGenerate} loading={generating} className="gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              지금 생성하기
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 메인 렌더링
  const columns = newsDesk.columns || [];
  const newsCards = newsDesk.news_cards || [];
  const keywords = newsDesk.keywords || [];
  const sentiment = newsDesk.sentiment || {};
  const topStocks = newsDesk.top_stocks || [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            뉴스데스크
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatDate(newsDesk.publish_date, 'yyyy년 M월 d일')} 뉴스 분석
          </p>
        </div>
        {isManagerOrAdmin() && (
          <Button
            variant="secondary"
            onClick={handleGenerate}
            loading={generating}
            className="gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </Button>
        )}
      </div>

      {/* 벤치마크 차트 영역 (플레이스홀더) */}
      <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
            벤치마크 비교
          </h2>
          <BenchmarkToggles selected={selectedBenchmarks} onChange={handleBenchmarkToggle} />
        </div>

        {/* 차트 플레이스홀더 */}
        <div className="h-48 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center justify-center text-gray-400 dark:text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className="text-sm">벤치마크 차트 (개발 예정)</p>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 - 2컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 왼쪽: 뉴스 카드 (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* AI 칼럼 */}
          {columns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </span>
                AI 칼럼
              </h2>
              {columns.map((col, idx) => (
                <NewsCard
                  key={idx}
                  card={col}
                  type="column"
                  onClick={() => handleCardClick(col, 'column')}
                />
              ))}
            </div>
          )}

          {/* 뉴스 카드 */}
          {newsCards.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9" />
                  </svg>
                </span>
                오늘의 주요 뉴스
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {newsCards.map((card, idx) => (
                  <NewsCard
                    key={idx}
                    card={card}
                    type="news"
                    onClick={() => handleCardClick(card, 'news')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 시각화 영역 (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* 키워드 버블 */}
          {keywords.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border-2 border-black dark:border-gray-600 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 mb-4">
                키워드 클라우드
              </h3>
              <div className="flex flex-wrap gap-3 justify-center py-4">
                {keywords.map((kw, idx) => (
                  <KeywordBubble
                    key={idx}
                    keyword={kw.keyword}
                    count={kw.count}
                    sentimentScore={kw.sentiment_score || 0}
                    isSelected={selectedKeyword === kw.keyword}
                    onClick={() => handleKeywordClick(kw.keyword)}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 감성 게이지 */}
          <SentimentGauge sentiment={sentiment} selectedKeyword={selectedKeyword} />
        </div>
      </div>

      {/* 주목 종목 TOP 3 */}
      {topStocks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-gradient-to-br from-orange-400 to-red-500 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
            </span>
            오늘의 주목 종목 TOP 3
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topStocks.slice(0, 3).map((stock, idx) => (
              <TopStockCard
                key={idx}
                stock={stock}
                rank={idx + 1}
                onClick={() => handleCardClick({ ...stock, title: stock.name }, 'stock')}
              />
            ))}
          </div>
        </div>
      )}

      {/* 생성 실패 상태 */}
      {newsDesk.status === 'failed' && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-800 dark:text-red-200 font-medium">
              뉴스데스크 생성에 실패했습니다
            </p>
          </div>
          {newsDesk.error_message && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">
              {newsDesk.error_message}
            </p>
          )}
          {isManagerOrAdmin() && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              loading={generating}
              className="mt-3"
            >
              다시 시도
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
