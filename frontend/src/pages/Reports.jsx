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
import { useAuthContext } from '../context/AuthContext';

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

// Document Card Component - Brutalist Style
function DocumentCard({ type, data, onClick, onDelete, showDelete }) {
  const isColumn = type === 'column';

  // Brutalist color blocks - theme-harmonious colors
  const typeStyles = {
    decision: {
      headerBg: 'bg-cyan-600 dark:bg-cyan-700',
      headerText: 'text-white',
      label: '의사결정'
    },
    report: {
      headerBg: 'bg-teal-600 dark:bg-teal-700',
      headerText: 'text-white',
      label: '운용보고'
    },
    column: {
      headerBg: 'bg-slate-700 dark:bg-slate-600',
      headerText: 'text-white',
      label: '칼럼'
    }
  };

  const style = typeStyles[type] || typeStyles.column;

  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-50 dark:bg-gray-900 border-2 border-black dark:border-gray-300 hover:border-black dark:hover:border-white transition-colors duration-150">

        {/* Top Color Block - 문서 유형 표시 */}
        <div className={`${style.headerBg} px-2.5 py-1.5 flex items-center justify-between border-b-2 border-black dark:border-gray-300`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${style.headerText}`}>
            {style.label}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Instagram-style blue verified badge - always blue regardless of theme */}
            {isColumn && data.is_verified && (
              <svg className="w-4 h-4 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
              </svg>
            )}
            {/* 관리자 모드 삭제 버튼 */}
            {showDelete && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(data);
                }}
                className="p-0.5 rounded hover:bg-red-500/30 text-white/70 hover:text-white transition-colors"
                title="삭제"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-2rem)] px-2.5 py-2 flex flex-col">

          {/* Title - 상단 배치, 볼드, 더 큰 폰트 */}
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight line-clamp-4 group-hover:underline decoration-2 underline-offset-2">
            {data.title}
          </h3>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Meta row */}
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 uppercase">
              {formatRelativeTime(data.created_at)}
            </span>
            {!isColumn && data.position?.status === 'open' && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5">
                OPEN
              </span>
            )}
          </div>

          {/* Footer - 두꺼운 상단 보더 */}
          <div className="pt-1.5 border-t-2 border-black/20 dark:border-white/20">
            {isColumn ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-slate-700/80 dark:bg-slate-500/80 flex items-center justify-center text-white text-xs font-bold ring-1 ring-black/10 dark:ring-white/10 shrink-0">
                  {data.author?.full_name?.charAt(0) || '?'}
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {data.author?.full_name || '익명'}
                </span>
              </div>
            ) : data.position && (
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                  {data.position.ticker_name || data.position.ticker}
                </span>
                <span className="text-[9px] font-mono font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1 py-0.5">
                  {data.position.market}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export function Reports() {
  const { user } = useAuth();
  const { adminMode } = useAuthContext();
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

  // Gallery grid classes - 6열 그리드 (카드 사이즈 2/3)
  const gridClasses = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3";

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
                  showDelete={adminMode}
                  onDelete={(col) => setDeleteColumnId(col.id)}
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
