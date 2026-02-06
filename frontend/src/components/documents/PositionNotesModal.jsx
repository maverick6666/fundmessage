import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { formatRelativeTime } from '../../utils/formatters';

/**
 * 포지션 노트 목록 모달
 *
 * 운용보고서 탭에서 포지션 클릭 시 표시
 * 노트 클릭 시 사이드 패널로 문서 열기
 */
export function PositionNotesModal({
  isOpen,
  onClose,
  position,
  notes = [],
  loading = false,
  onNoteClick,
  onGenerateReport,
  isGenerating = false,
}) {
  const { user } = useAuth();
  const { isCurrentThemeDark } = useTheme();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  if (!isOpen || !position) return null;

  // 테마별 스타일
  const styles = {
    backdrop: isCurrentThemeDark ? 'bg-black/60' : 'bg-black/40',
    modal: isCurrentThemeDark
      ? 'bg-[#1a1a1c] border-white/10'
      : 'bg-white border-gray-200',
    title: isCurrentThemeDark ? 'text-white' : 'text-gray-900',
    subtitle: isCurrentThemeDark ? 'text-gray-400' : 'text-gray-600',
    mutedText: isCurrentThemeDark ? 'text-gray-500' : 'text-gray-500',
    border: isCurrentThemeDark ? 'border-white/10' : 'border-gray-200',
    cardBg: isCurrentThemeDark
      ? 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/10'
      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-gray-300',
    statusOpen: isCurrentThemeDark
      ? 'bg-emerald-500/10 text-emerald-400'
      : 'bg-emerald-50 text-emerald-600',
    statusClosed: isCurrentThemeDark
      ? 'bg-gray-500/10 text-gray-400'
      : 'bg-gray-100 text-gray-600',
    closeBtn: isCurrentThemeDark
      ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
    emptyBg: isCurrentThemeDark ? 'bg-white/5' : 'bg-gray-100',
  };

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${styles.backdrop} backdrop-blur-sm`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center py-8 px-4">
          <div
            className={`
              relative w-full max-w-lg border rounded-2xl shadow-2xl
              transform transition-all duration-200
              ${styles.modal}
              ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
            `}
          >
            {/* Header */}
            <header className={`flex items-start justify-between px-5 py-4 border-b ${styles.border}`}>
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    position.status === 'open' ? styles.statusOpen : styles.statusClosed
                  }`}>
                    {position.status === 'open' ? '보유중' : '종료'}
                  </span>
                  <span className={`text-sm font-mono ${styles.mutedText}`}>
                    {position.ticker} · {position.market}
                  </span>
                </div>
                <h2 className={`text-xl font-semibold ${styles.title}`} style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  {position.ticker_name || position.ticker}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg transition-colors ${styles.closeBtn}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Stats */}
            <div className={`flex items-center gap-5 px-5 py-3 border-b ${styles.border}`}>
              <div className={`flex items-center gap-1.5 text-sm ${styles.subtitle}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>토론 {position.discussion_count || 0}개</span>
              </div>
              <div className={`flex items-center gap-1.5 text-sm ${styles.subtitle}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>노트 {notes.length}개</span>
              </div>

              {isManager && position.has_data && onGenerateReport && (
                <button
                  onClick={() => onGenerateReport(position.id)}
                  disabled={isGenerating}
                  className={`
                    ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                    ${isCurrentThemeDark
                      ? 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20'
                      : 'text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200'
                    }
                    disabled:opacity-50
                  `}
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      생성 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI 보고서
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Notes list */}
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className={`w-12 h-12 rounded-xl ${styles.emptyBg} flex items-center justify-center mb-3`}>
                    <svg className={`w-6 h-6 ${styles.mutedText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className={styles.subtitle}>작성된 노트가 없습니다</p>
                  <p className={`text-sm ${styles.mutedText} mt-1`}>포지션 상세에서 의사결정 노트를 작성할 수 있습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => onNoteClick?.(note)}
                      className={`w-full text-left p-3.5 border rounded-xl transition-all group ${styles.cardBg}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium ${styles.title} group-hover:text-emerald-500 transition-colors truncate`}>
                            {note.title}
                          </h3>
                          {note.content && (
                            <p className={`text-sm ${styles.mutedText} mt-1 line-clamp-2`}>
                              {note.content.substring(0, 120)}...
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`text-xs ${styles.mutedText}`}>
                            {formatRelativeTime(note.created_at)}
                          </span>
                          {note.author && (
                            <p className={`text-xs ${styles.subtitle} mt-0.5`}>
                              {note.author.full_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
