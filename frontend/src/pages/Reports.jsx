import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { PositionNotesModal } from '../components/documents/PositionNotesModal';
import { reportService } from '../services/reportService';
import { columnService } from '../services/columnService';
import { aiService } from '../services/aiService';
import { positionService } from '../services/positionService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useSidePanelStore } from '../stores/useSidePanelStore';
import {
  formatPercent,
  formatRelativeTime,
  getProfitLossClass
} from '../utils/formatters';

// Tab icons
const TabIcons = {
  operations: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  decisions: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  columns: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  )
};

export function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openDocument, openColumnEditor } = useSidePanelStore();

  // Tab state from URL
  const activeTab = searchParams.get('tab') || 'operations';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Data states
  const [positions, setPositions] = useState([]);
  const [decisionNotes, setDecisionNotes] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Position notes modal (운용보고서 탭에서 사용)
  const [showPositionNotes, setShowPositionNotes] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [positionNotes, setPositionNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [generatingReportId, setGeneratingReportId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'operations') {
        const data = await reportService.getPositionsForReport({ limit: 50 });
        setPositions(data.positions || []);
      } else if (activeTab === 'decisions') {
        const data = await reportService.getDecisionNotes({ limit: 50 });
        setDecisionNotes(data.notes || []);
      } else {
        const data = await columnService.getColumns({ limit: 50 });
        setColumns(data.columns || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Position click - show notes modal
  const handlePositionClick = async (position) => {
    setSelectedPosition(position);
    setShowPositionNotes(true);
    setLoadingNotes(true);
    try {
      const data = await positionService.getDecisionNotes(position.id);
      setPositionNotes(data || []);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setPositionNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Note click from position modal - open side panel
  const handleNoteClick = (note) => {
    setShowPositionNotes(false);
    openDocument(note, 'decision-note', fetchData);
  };

  // Decision note click - open side panel
  const handleDecisionNoteClick = (note) => {
    openDocument(note, 'decision-note', fetchData);
  };

  // Column click - open side panel
  const handleColumnClick = async (column) => {
    try {
      const data = await columnService.getColumn(column.id);
      openDocument(data, 'column', fetchData);
    } catch (error) {
      console.error('Failed to fetch column:', error);
    }
  };

  const handleGenerateReport = async (positionId) => {
    setGeneratingReportId(positionId);
    try {
      const result = await aiService.generateOperationReport(positionId);
      if (result.data?.content) {
        toast.success('운용보고서가 생성되었습니다');
        // Refresh notes for this position
        const data = await positionService.getDecisionNotes(positionId);
        setPositionNotes(data || []);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'AI 보고서 생성에 실패했습니다');
    } finally {
      setGeneratingReportId(null);
    }
  };

  const handleDeleteColumn = async (columnId) => {
    if (!confirm('정말 이 칼럼을 삭제하시겠습니까?')) return;
    try {
      await columnService.deleteColumn(columnId);
      fetchData();
      toast.success('칼럼이 삭제되었습니다');
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다');
    }
  };

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const tabs = [
    { id: 'operations', label: '운용보고서', icon: TabIcons.operations },
    { id: 'decisions', label: '의사결정서', icon: TabIcons.decisions },
    { id: 'columns', label: '칼럼', icon: TabIcons.columns }
  ];

  const renderEmptyState = (message, subMessage, icon) => (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4 shadow-inner">
        {icon}
      </div>
      <p className="text-gray-600 dark:text-gray-300 font-medium text-center">{message}</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 text-center max-w-md">{subMessage}</p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>불러오는 중...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            문서
          </h1>
        </div>
        {activeTab === 'columns' && (
          <Button onClick={() => openColumnEditor(null, fetchData)} className="gap-2 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">칼럼 작성</span>
            <span className="sm:hidden">작성</span>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-lg shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
            }`}
          >
            <span className={`shrink-0 ${activeTab === tab.id ? 'text-primary-500' : ''}`}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div>
          {loading ? renderLoading() : positions.length === 0 ? (
            renderEmptyState(
              '포지션이 없습니다',
              '포지션을 개설하면 여기에서 운용보고서를 관리할 수 있습니다',
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {positions.map((position) => (
                <button
                  key={position.id}
                  onClick={() => handlePositionClick(position)}
                  className="group text-left min-w-0"
                >
                  <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5">
                    {/* Status indicator */}
                    <div className="absolute top-4 right-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        position.status === 'open'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ring-1 ring-emerald-600/20'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 ring-1 ring-gray-500/20'
                      }`}>
                        {position.status === 'open' ? '보유중' : '종료'}
                      </span>
                    </div>

                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg leading-tight pr-20 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {position.ticker_name || position.ticker}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
                        {position.ticker} · {position.market}
                      </p>
                    </div>

                    {/* Profit/Loss */}
                    {position.profit_rate != null && (
                      <div className={`text-2xl font-bold mb-4 ${getProfitLossClass(position.profit_rate)}`}>
                        {position.profit_rate >= 0 ? '+' : ''}{formatPercent(position.profit_rate)}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm mb-4 overflow-hidden">
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>토론 {position.discussion_count}개</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>노트 {position.note_count}개</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100 dark:border-gray-700 overflow-hidden">
                      {(position.requester || position.opener) ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap truncate">
                          요청: {position.requester?.full_name || position.opener?.full_name}
                        </span>
                      ) : (
                        <span />
                      )}

                      {position.has_data && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 whitespace-nowrap shrink-0">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          데이터 있음
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decision Notes Tab */}
      {activeTab === 'decisions' && (
        <div>
          {loading ? renderLoading() : decisionNotes.length === 0 ? (
            renderEmptyState(
              '작성된 의사결정서가 없습니다',
              '포지션 상세에서 AI 의사결정서를 생성하거나 직접 작성할 수 있습니다',
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )
          ) : (
            <div className="space-y-3">
              {decisionNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleDecisionNoteClick(note)}
                  className="group block w-full text-left"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                          {note.title}
                        </h3>
                        {note.position && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              note.position.status === 'open'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {note.position.ticker_name || note.position.ticker}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              {note.position.ticker} · {note.position.market}
                            </span>
                          </div>
                        )}
                        {note.content && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 line-clamp-2">
                            {note.content}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {formatRelativeTime(note.created_at)}
                        </span>
                        {note.author && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {note.author.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Columns Tab */}
      {activeTab === 'columns' && (
        <div>
          {loading ? renderLoading() : columns.length === 0 ? (
            renderEmptyState(
              '아직 작성된 칼럼이 없습니다',
              '팀원 누구나 자유롭게 칼럼을 작성할 수 있습니다. 시장 분석, 투자 아이디어 등을 공유해보세요.',
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            )
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {columns.map((column) => (
                <button
                  key={column.id}
                  onClick={() => handleColumnClick(column)}
                  className="group text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                        {column.title}
                      </h3>
                      {column.is_verified && (
                        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20" title="검증됨">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
                      {formatRelativeTime(column.created_at)}
                    </span>
                  </div>

                  {column.author && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-medium">
                        {column.author.full_name?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {column.author.full_name}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Position Notes Modal (운용보고서 탭용) */}
      <PositionNotesModal
        isOpen={showPositionNotes}
        onClose={() => {
          setShowPositionNotes(false);
          setSelectedPosition(null);
          setPositionNotes([]);
        }}
        position={selectedPosition}
        notes={positionNotes}
        onNoteClick={handleNoteClick}
        onGenerateReport={handleGenerateReport}
        isGenerating={generatingReportId === selectedPosition?.id}
      />
    </div>
  );
}
