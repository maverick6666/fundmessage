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

// Document Card Component - Editorial/Luxury Style
function DocumentCard({ type, data, onClick }) {
  const isColumn = type === 'column';

  // Type-based theming
  const getTypeTheme = () => {
    switch (type) {
      case 'decision':
        return {
          accent: 'from-blue-500 via-indigo-500 to-blue-600',
          glow: 'group-hover:shadow-blue-500/20',
          iconBg: 'from-blue-500 to-indigo-600',
          text: 'group-hover:text-blue-600 dark:group-hover:text-blue-400'
        };
      case 'report':
        return {
          accent: 'from-emerald-500 via-teal-500 to-cyan-500',
          glow: 'group-hover:shadow-emerald-500/20',
          iconBg: 'from-emerald-500 to-teal-600',
          text: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
        };
      case 'column':
        return {
          accent: 'from-violet-500 via-purple-500 to-fuchsia-500',
          glow: 'group-hover:shadow-violet-500/20',
          iconBg: 'from-violet-500 to-purple-600',
          text: 'group-hover:text-violet-600 dark:group-hover:text-violet-400'
        };
      default:
        return {
          accent: 'from-gray-400 to-gray-500',
          glow: 'group-hover:shadow-gray-500/20',
          iconBg: 'from-gray-500 to-gray-600',
          text: 'group-hover:text-gray-600 dark:group-hover:text-gray-400'
        };
    }
  };

  const theme = getTypeTheme();

  // Get badge info
  const getBadge = () => {
    if (isColumn) {
      return data.is_verified ? {
        text: '검증됨',
        icon: (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ),
        className: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
      } : null;
    }
    if (data.position?.status === 'open') {
      return {
        text: '보유중',
        icon: (
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        ),
        className: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
      };
    }
    return {
      text: '종료',
      icon: null,
      className: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    };
  };

  const badge = getBadge();

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded-2xl"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl
          bg-white dark:bg-gray-800/90
          border border-gray-200/80 dark:border-gray-700/50
          backdrop-blur-sm
          transition-all duration-500 ease-out
          hover:-translate-y-2 hover:scale-[1.02]
          shadow-lg shadow-gray-200/40 dark:shadow-gray-900/40
          group-hover:shadow-2xl ${theme.glow}
          group-hover:border-gray-300/80 dark:group-hover:border-gray-600/50
        `}
        style={{ aspectRatio: '3/4' }}
      >
        {/* Top Accent Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.accent} opacity-80 group-hover:opacity-100 transition-opacity`} />

        {/* Decorative corner gradient */}
        <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${theme.accent} opacity-[0.03] group-hover:opacity-[0.08] rounded-full blur-2xl transition-opacity duration-500`} />

        {/* Title Section */}
        <div className="relative h-[30%] p-4 flex flex-col justify-center">
          <h3 className={`font-bold text-gray-900 dark:text-gray-50 text-sm leading-snug line-clamp-2 transition-colors duration-300 ${theme.text}`}>
            {data.title}
          </h3>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />

        {/* Content Section */}
        <div className="relative h-[70%] p-4 flex flex-col">
          {/* Badge */}
          {badge && (
            <div className="absolute top-3 right-3">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${badge.className} transition-transform duration-300 group-hover:scale-105`}>
                {badge.icon}
                {badge.text}
              </span>
            </div>
          )}

          {/* Content Details */}
          <div className="flex-1 flex flex-col justify-center pt-2">
            {isColumn ? (
              // Column: Author info with avatar
              <div className="space-y-3">
                {data.author && (
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.iconBg} flex items-center justify-center text-white font-bold shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      {data.author.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {data.author.full_name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">작성자</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Decision/Report: Position info
              <div className="space-y-2">
                {data.position && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${theme.iconBg} flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform duration-300`}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                          {data.position.ticker_name || data.position.ticker}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {data.position.ticker}
                        </p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100/80 dark:bg-gray-700/50 rounded-md">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {data.position.market}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer - Time with icon */}
          <div className="flex items-center gap-1.5 pt-3 mt-auto border-t border-gray-100/80 dark:border-gray-700/30">
            <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
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
