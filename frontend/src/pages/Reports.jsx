import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { reportService } from '../services/reportService';
import { columnService } from '../services/columnService';
import { decisionNoteService } from '../services/decisionNoteService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useSidePanelStore } from '../stores/useSidePanelStore';
import { formatRelativeTime } from '../utils/formatters';

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

// Document Card Component
function DocumentCard({ type, data, onClick }) {
  const isColumn = type === 'column';

  // Get badge info
  const getBadge = () => {
    if (isColumn) {
      return data.is_verified ? {
        text: '검증됨',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-500/30'
      } : null;
    }
    if (data.position?.status === 'open') {
      return {
        text: '보유중',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-500/30'
      };
    }
    return {
      text: '종료',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-400 ring-1 ring-gray-500/20'
    };
  };

  const badge = getBadge();

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xl"
    >
      <div
        className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-1"
        style={{ aspectRatio: '3/4' }}
      >
        {/* Title Section - Top 1/4 */}
        <div className="h-1/4 p-4 flex items-center border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-700/30 dark:to-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-tight line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {data.title}
          </h3>
        </div>

        {/* Content Section - Bottom 3/4 */}
        <div className="h-3/4 p-4 flex flex-col relative">
          {/* Badge - Top Right of Content Section */}
          {badge && (
            <div className="absolute top-3 right-3">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                {badge.text}
              </span>
            </div>
          )}

          {/* Content Details */}
          <div className="flex-1 flex flex-col justify-center">
            {isColumn ? (
              // Column: Author info
              <div className="space-y-2">
                {data.author && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
                      {data.author.full_name?.charAt(0) || '?'}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {data.author.full_name}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              // Decision/Report: Position info
              <div className="space-y-1.5">
                {data.position && (
                  <>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {data.position.ticker_name || data.position.ticker}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {data.position.ticker} · {data.position.market}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer - Time */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 mt-auto">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatRelativeTime(data.created_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openDocument, openColumnEditor } = useSidePanelStore();

  // Tab state from URL
  const activeTab = searchParams.get('tab') || 'operations';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Data states
  const [operationReports, setOperationReports] = useState([]);
  const [decisionNotes, setDecisionNotes] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [deleteColumnId, setDeleteColumnId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'operations') {
        const data = await reportService.getOperationReports({ limit: 50 });
        setOperationReports(data.notes || []);
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

  // Note click - fetch full content then open side panel
  const handleNoteClick = async (note) => {
    if (!note.position?.id) {
      openDocument(note, 'decision-note', fetchData);
      return;
    }
    try {
      const fullNote = await decisionNoteService.getNote(note.position.id, note.id);
      openDocument(fullNote, 'decision-note', fetchData);
    } catch (error) {
      console.error('Failed to fetch full note:', error);
      openDocument(note, 'decision-note', fetchData);
    }
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

  const handleDeleteColumn = async () => {
    if (!deleteColumnId) return;
    try {
      await columnService.deleteColumn(deleteColumnId);
      setDeleteColumnId(null);
      fetchData();
      toast.success('칼럼이 삭제되었습니다');
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다');
    }
  };

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

  // Gallery grid classes
  const gridClasses = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";

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

      {/* Operations Tab - 운용보고서 */}
      {activeTab === 'operations' && (
        <div>
          {loading ? renderLoading() : operationReports.length === 0 ? (
            renderEmptyState(
              '작성된 운용보고서가 없습니다',
              '포지션 상세에서 운용보고서를 작성할 수 있습니다',
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )
          ) : (
            <div className={gridClasses}>
              {operationReports.map((note) => (
                <DocumentCard
                  key={note.id}
                  type="report"
                  data={note}
                  onClick={() => handleNoteClick(note)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decision Notes Tab - 의사결정서 */}
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
            <div className={gridClasses}>
              {decisionNotes.map((note) => (
                <DocumentCard
                  key={note.id}
                  type="decision"
                  data={note}
                  onClick={() => handleNoteClick(note)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Columns Tab - 칼럼 */}
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
            <div className={gridClasses}>
              {columns.map((column) => (
                <DocumentCard
                  key={column.id}
                  type="column"
                  data={column}
                  onClick={() => handleColumnClick(column)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 칼럼 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteColumnId}
        onClose={() => setDeleteColumnId(null)}
        onConfirm={handleDeleteColumn}
        title="칼럼 삭제"
        message="정말 이 칼럼을 삭제하시겠습니까?"
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
