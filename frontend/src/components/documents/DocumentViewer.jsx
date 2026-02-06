import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlockRenderer } from '../editor/BlockEditor';
import { formatRelativeTime } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';

/**
 * Premium Document Viewer Modal
 *
 * Supports both block-based content (columns) and markdown content (decision notes)
 */
export function DocumentViewer({
  isOpen,
  onClose,
  doc: doc,
  type = 'column', // 'column' | 'decision-note'
  onEdit,
  onDelete,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      window.document.body.style.overflow = 'hidden';
    } else {
      window.document.body.style.overflow = '';
    }
    return () => {
      window.document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleEdit = () => {
    if (type === 'column' && doc?.id) {
      navigate(`/columns/${doc.id}/edit`);
    } else if (onEdit) {
      onEdit(doc);
    }
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(doc?.id);
    }
  };

  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isAuthor = doc?.author_id === user?.id || doc?.author?.id === user?.id;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isManager;

  if (!isOpen || !doc) return null;

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal container */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center py-8 px-4">
          <div
            className={`relative w-full max-w-3xl bg-[#0f0f10] border border-white/10 rounded-2xl shadow-2xl transform transition-all duration-200 ${
              isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            {/* Header */}
            <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#0f0f10]/95 backdrop-blur-sm rounded-t-2xl">
              <div className="flex items-center gap-4">
                {/* Document type badge */}
                <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  type === 'column'
                    ? 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                }`}>
                  {type === 'column' ? '칼럼' : '의사결정서'}
                </span>

                {/* Position info for decision notes */}
                {type === 'decision-note' && doc.position && (
                  <span className="text-sm text-gray-500">
                    {doc.position.ticker_name || doc.position.ticker}
                  </span>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Content */}
            <div className="px-8 py-8">
              {/* Title */}
              <h1
                className="text-3xl sm:text-4xl font-semibold text-white mb-6 leading-tight"
                style={{ fontFamily: "'Noto Serif KR', 'Crimson Pro', serif" }}
              >
                {doc.title}
              </h1>

              {/* Author & date */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
                {doc.author && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-medium">
                      {doc.author.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {doc.author.full_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(doc.created_at)}
                        {doc.updated_at && doc.updated_at !== doc.created_at && (
                          <span className="ml-2 text-gray-600">(수정됨)</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Body content */}
              <article className="doc-content">
                {/* Block-based content (columns) */}
                {doc.blocks && doc.blocks.length > 0 ? (
                  <BlockRenderer blocks={doc.blocks} premium />
                ) : doc.content ? (
                  /* Markdown content (decision notes) */
                  <div className="prose-viewer">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-semibold text-white mt-8 mb-4" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xl font-semibold text-white mt-6 mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-medium text-gray-200 mt-5 mb-2">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-gray-300 text-lg leading-relaxed mb-4" style={{ fontFamily: "'Crimson Pro', 'Noto Serif KR', serif" }}>
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-gray-300">{children}</li>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="pl-5 border-l-2 border-emerald-500/50 text-gray-400 italic my-6">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-6">
                            <table className="w-full border-collapse text-sm">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-white/5 text-gray-300">
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className="px-4 py-2.5 text-left font-medium border-b border-white/10">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-4 py-2.5 text-gray-400 border-b border-white/5">
                            {children}
                          </td>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-200">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-gray-400">{children}</em>
                        ),
                        code: ({ inline, children }) =>
                          inline ? (
                            <code className="px-1.5 py-0.5 bg-white/5 text-emerald-400 rounded text-sm font-mono">
                              {children}
                            </code>
                          ) : (
                            <pre className="p-4 bg-black/30 rounded-lg overflow-x-auto my-4">
                              <code className="text-sm text-gray-300 font-mono">{children}</code>
                            </pre>
                          ),
                        hr: () => (
                          <div className="py-6">
                            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                          </div>
                        ),
                      }}
                    >
                      {doc.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">내용이 없습니다.</p>
                )}
              </article>
            </div>

            {/* Footer actions */}
            {(canEdit || canDelete) && (
              <footer className="sticky bottom-0 flex items-center justify-end gap-3 px-8 py-4 border-t border-white/5 bg-[#0f0f10]/95 backdrop-blur-sm rounded-b-2xl">
                {canEdit && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    수정
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    삭제
                  </button>
                )}
              </footer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Position Notes Viewer Modal
 * Shows list of decision notes for a position
 */
export function PositionNotesViewer({
  isOpen,
  onClose,
  position,
  notes = [],
  onNoteClick,
  onGenerateReport,
  isGenerating = false,
}) {
  const { user } = useAuth();
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

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center py-8 px-4">
          <div
            className={`relative w-full max-w-2xl bg-[#0f0f10] border border-white/10 rounded-2xl shadow-2xl transform transition-all duration-200 ${
              isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            {/* Header */}
            <header className="flex items-start justify-between px-6 py-5 border-b border-white/5">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    position.status === 'open'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-gray-500/10 text-gray-400'
                  }`}>
                    {position.status === 'open' ? '보유중' : '종료'}
                  </span>
                  <span className="text-sm text-gray-500 font-mono">
                    {position.ticker} · {position.market}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-white" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                  {position.ticker_name || position.ticker}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Stats */}
            <div className="flex items-center gap-6 px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-gray-400">토론 {position.discussion_count || 0}개</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-gray-400">노트 {notes.length}개</span>
              </div>

              {isManager && position.has_data && onGenerateReport && (
                <button
                  onClick={() => onGenerateReport(position.id)}
                  disabled={isGenerating}
                  className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-colors disabled:opacity-50"
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
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 mb-1">작성된 노트가 없습니다</p>
                  <p className="text-sm text-gray-600">포지션 상세에서 의사결정 노트를 작성할 수 있습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => onNoteClick?.(note)}
                      className="w-full text-left p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-xl transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-200 group-hover:text-white transition-colors truncate">
                            {note.title}
                          </h3>
                          {note.content && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {note.content.substring(0, 150)}...
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-gray-600">
                            {formatRelativeTime(note.created_at)}
                          </span>
                          {note.author && (
                            <p className="text-xs text-gray-500 mt-1">
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
