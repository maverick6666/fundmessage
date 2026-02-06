import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlockRenderer } from '../editor/BlockEditor';
import { formatRelativeTime } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useSidePanelStore } from '../../stores/useSidePanelStore';

/**
 * 사이드 패널용 문서 뷰어
 *
 * - 테마 연동 (라이트/다크)
 * - 스크롤 가능
 * - 마크다운 및 블록 콘텐츠 지원
 */
export function DocumentPanel({ document: doc, type = 'decision-note', onDelete }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCurrentThemeDark } = useTheme();
  const { closePanel } = useSidePanelStore();

  if (!doc) return null;

  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isAuthor = doc?.author_id === user?.id || doc?.author?.id === user?.id;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isManager;

  const handleEdit = () => {
    if (type === 'column' && doc?.id) {
      closePanel();
      navigate(`/columns/${doc.id}/edit`);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(doc?.id);
    }
  };

  // 테마별 스타일
  const styles = {
    title: isCurrentThemeDark ? 'text-white' : 'text-gray-900',
    subtitle: isCurrentThemeDark ? 'text-gray-400' : 'text-gray-600',
    text: isCurrentThemeDark ? 'text-gray-300' : 'text-gray-700',
    mutedText: isCurrentThemeDark ? 'text-gray-500' : 'text-gray-500',
    border: isCurrentThemeDark ? 'border-white/10' : 'border-gray-200',
    avatarBg: isCurrentThemeDark
      ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
      : 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    codeBg: isCurrentThemeDark ? 'bg-black/30' : 'bg-gray-100',
    quoteBorder: isCurrentThemeDark ? 'border-emerald-500/50' : 'border-emerald-400',
    tableBg: isCurrentThemeDark ? 'bg-white/5' : 'bg-gray-50',
  };

  return (
    <div className="px-6 py-6">
      {/* 제목 */}
      <h1
        className={`text-2xl sm:text-3xl font-semibold mb-5 leading-tight ${styles.title}`}
        style={{ fontFamily: "'Noto Serif KR', 'Crimson Pro', serif" }}
      >
        {doc.title}
      </h1>

      {/* 작성자 & 날짜 */}
      {doc.author && (
        <div className={`flex items-center gap-3 mb-6 pb-5 border-b ${styles.border}`}>
          <div className={`w-9 h-9 rounded-full ${styles.avatarBg} flex items-center justify-center text-white text-sm font-medium`}>
            {doc.author.full_name?.charAt(0) || '?'}
          </div>
          <div>
            <p className={`text-sm font-medium ${styles.text}`}>
              {doc.author.full_name}
            </p>
            <p className={`text-xs ${styles.mutedText}`}>
              {formatRelativeTime(doc.created_at)}
              {doc.updated_at && doc.updated_at !== doc.created_at && (
                <span className="ml-1.5 opacity-70">(수정됨)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 포지션 정보 (의사결정서인 경우) */}
      {type === 'decision-note' && doc.position && (
        <div className={`mb-5 px-3 py-2 rounded-lg ${isCurrentThemeDark ? 'bg-white/5' : 'bg-gray-50'}`}>
          <span className={`text-sm ${styles.subtitle}`}>
            {doc.position.ticker_name || doc.position.ticker}
            <span className={`ml-2 font-mono text-xs ${styles.mutedText}`}>
              {doc.position.ticker} · {doc.position.market}
            </span>
          </span>
        </div>
      )}

      {/* 본문 */}
      <article className="document-content">
        {/* 블록 기반 콘텐츠 (칼럼) */}
        {doc.blocks && doc.blocks.length > 0 ? (
          <BlockRenderer blocks={doc.blocks} isDark={isCurrentThemeDark} />
        ) : doc.content ? (
          /* 마크다운 콘텐츠 (의사결정서) */
          <div className="prose-panel">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1
                    className={`text-xl font-semibold mt-6 mb-3 ${styles.title}`}
                    style={{ fontFamily: "'Noto Serif KR', serif" }}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    className={`text-lg font-semibold mt-5 mb-2.5 ${styles.title}`}
                    style={{ fontFamily: "'Noto Serif KR', serif" }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className={`text-base font-medium mt-4 mb-2 ${styles.text}`}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p
                    className={`text-base leading-relaxed mb-3 ${styles.text}`}
                    style={{ fontFamily: "'Crimson Pro', 'Noto Serif KR', serif" }}
                  >
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className={`list-disc list-inside mb-3 space-y-1 ${styles.text}`}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className={`list-decimal list-inside mb-3 space-y-1 ${styles.text}`}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className={styles.text}>{children}</li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className={`pl-4 border-l-2 ${styles.quoteBorder} ${styles.subtitle} italic my-4`}>
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-white/10">
                    <table className="w-full border-collapse text-sm">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className={`${styles.tableBg} ${styles.text}`}>
                    {children}
                  </thead>
                ),
                th: ({ children }) => (
                  <th className={`px-3 py-2 text-left font-medium border-b ${styles.border}`}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className={`px-3 py-2 ${styles.subtitle} border-b ${styles.border}`}>
                    {children}
                  </td>
                ),
                strong: ({ children }) => (
                  <strong className={`font-semibold ${styles.text}`}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em className={`italic ${styles.subtitle}`}>{children}</em>
                ),
                code: ({ inline, children }) =>
                  inline ? (
                    <code className={`px-1.5 py-0.5 ${styles.codeBg} text-emerald-600 dark:text-emerald-400 rounded text-sm font-mono`}>
                      {children}
                    </code>
                  ) : (
                    <pre className={`p-3 ${styles.codeBg} rounded-lg overflow-x-auto my-3`}>
                      <code className={`text-sm ${styles.text} font-mono`}>{children}</code>
                    </pre>
                  ),
                hr: () => (
                  <div className="py-4">
                    <div className={`h-px ${isCurrentThemeDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                  </div>
                ),
              }}
            >
              {doc.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className={`${styles.mutedText} italic`}>내용이 없습니다.</p>
        )}
      </article>

      {/* 액션 버튼 */}
      {(canEdit || canDelete) && (
        <div className={`flex items-center justify-end gap-2 mt-6 pt-4 border-t ${styles.border}`}>
          {canEdit && type === 'column' && (
            <button
              onClick={handleEdit}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${isCurrentThemeDark
                  ? 'text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10'
                  : 'text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                }
              `}
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
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${isCurrentThemeDark
                  ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20'
                  : 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
