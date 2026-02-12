import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BlockRenderer } from '../editor/BlockEditor';
import { ConfirmModal } from '../common/ConfirmModal';
import { formatRelativeTime } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useSidePanelStore } from '../../stores/useSidePanelStore';
import { columnService } from '../../services/columnService';
import { decisionNoteService } from '../../services/decisionNoteService';
import { commentService } from '../../services/commentService';
import { useToast } from '../../context/ToastContext';

/**
 * 사이드 패널용 문서 뷰어
 *
 * - 테마 연동 (라이트/다크)
 * - 스크롤 가능
 * - 마크다운 및 블록 콘텐츠 지원
 * - 인라인 편집 지원 (칼럼, 의사결정 노트)
 * - 칼럼 검증 기능 (팀장/관리자)
 * - 댓글 기능
 */
export function DocumentPanel({ document: doc, type = 'decision-note', onDelete, onSaved }) {
  const { user } = useAuth();
  const { isCurrentThemeDark } = useTheme();
  const { openColumnEditor, openNoteEditor, closePanel } = useSidePanelStore();
  const toast = useToast();
  const [verifying, setVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(doc?.is_verified || false);
  const [verifier, setVerifier] = useState(doc?.verifier || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 댓글 관련 상태
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [showCommentDeleteConfirm, setShowCommentDeleteConfirm] = useState(null);
  const commentInputRef = useRef(null);

  // 문서 타입을 API에서 사용하는 형식으로 변환
  const getDocumentType = () => {
    if (type === 'column') return 'column';
    if (type === 'decision-note') return 'decision_note';
    if (type === 'report') return 'report';
    return type;
  };

  // 댓글 로드
  useEffect(() => {
    if (doc?.id) {
      loadComments();
    }
  }, [doc?.id, type]);

  const loadComments = async () => {
    if (!doc?.id) return;
    setCommentsLoading(true);
    try {
      const result = await commentService.getComments({
        document_type: getDocumentType(),
        document_id: doc.id,
      });
      setComments(result.comments || []);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  // 댓글 작성
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      await commentService.createComment({
        document_type: getDocumentType(),
        document_id: doc.id,
        content: newComment.trim(),
      });
      setNewComment('');
      await loadComments();
      toast.success('댓글이 작성되었습니다');
    } catch (error) {
      toast.error(error.response?.data?.detail || '댓글 작성에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // 댓글 수정 시작
  const handleStartEdit = (comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  // 댓글 수정 취소
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent('');
  };

  // 댓글 수정 저장
  const handleSaveEdit = async (commentId) => {
    if (!editingContent.trim()) return;

    try {
      await commentService.updateComment(commentId, editingContent.trim());
      setEditingCommentId(null);
      setEditingContent('');
      await loadComments();
      toast.success('댓글이 수정되었습니다');
    } catch (error) {
      toast.error(error.response?.data?.detail || '댓글 수정에 실패했습니다');
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId) => {
    try {
      await commentService.deleteComment(commentId);
      setShowCommentDeleteConfirm(null);
      await loadComments();
      toast.success('댓글이 삭제되었습니다');
    } catch (error) {
      toast.error(error.response?.data?.detail || '댓글 삭제에 실패했습니다');
    }
  };

  if (!doc) return null;

  const isManagerRole = user?.role === 'manager' || user?.role === 'admin';
  const isAuthor = doc?.author_id === user?.id || doc?.author?.id === user?.id;
  // 의사결정 노트는 팀장/관리자만 수정 가능, 칼럼은 작성자만
  const canEdit = type === 'decision-note' ? isManagerRole : isAuthor;
  const canDelete = isAuthor || isManagerRole;
  // 검증은 팀장/관리자만 가능하며, 본인 칼럼은 검증 불가
  const canVerify = type === 'column' && isManagerRole && !isAuthor;

  const handleVerify = async () => {
    if (!doc?.id) return;
    setVerifying(true);
    try {
      const result = await columnService.verifyColumn(doc.id);
      setIsVerified(true);
      setVerifier({ id: user?.id, full_name: user?.full_name });
      toast.success(result.message || '칼럼이 검증되었습니다.');
      if (onSaved) onSaved({ action: 'verify', columnId: doc.id });
    } catch (error) {
      toast.error(error.response?.data?.detail || '검증에 실패했습니다.');
    } finally {
      setVerifying(false);
    }
  };

  const handleUnverify = async () => {
    if (!doc?.id) return;
    setVerifying(true);
    try {
      await columnService.unverifyColumn(doc.id);
      setIsVerified(false);
      setVerifier(null);
      toast.success('검증이 취소되었습니다.');
      if (onSaved) onSaved({ action: 'unverify', columnId: doc.id });
    } catch (error) {
      toast.error(error.response?.data?.detail || '검증 취소에 실패했습니다.');
    } finally {
      setVerifying(false);
    }
  };

  const handleEdit = () => {
    if (type === 'column' && doc?.id) {
      // 사이드 패널 내에서 편집 모드로 전환
      openColumnEditor(doc.id, onSaved);
    } else if (type === 'decision-note' && doc?.id) {
      // 의사결정 노트 편집 모드로 전환
      openNoteEditor(doc, onSaved);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      if (onDelete) {
        onDelete(doc?.id);
      } else if (type === 'column' || type === 'ai_column') {
        await columnService.deleteColumn(doc?.id);
        toast.success('칼럼이 삭제되었습니다');
        if (onSaved) onSaved();
        closePanel();
      } else if ((type === 'decision-note' || type === 'report') && doc?.position_id && doc?.id) {
        await decisionNoteService.deleteNote(doc.position_id, doc.id);
        toast.success('문서가 삭제되었습니다');
        if (onSaved) onSaved();
        closePanel();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다');
    }
    setShowDeleteConfirm(false);
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
      {/* 제목 + 검증 배지 */}
      <div className="flex items-start gap-2 mb-5">
        <h1
          className={`text-2xl sm:text-3xl font-semibold leading-tight flex-1 ${styles.title}`}
          style={{ fontFamily: "'Noto Serif KR', 'Crimson Pro', serif" }}
        >
          {doc.title}
        </h1>
        {type === 'column' && isVerified && (
          <div className="shrink-0 mt-1" title={`검증됨${verifier ? ` - ${verifier.full_name}` : ''}`}>
            <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

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
      {(canEdit || canDelete || canVerify) && (
        <div className={`flex items-center justify-end gap-2 mt-6 pt-4 border-t ${styles.border}`}>
          {/* 검증/검증취소 버튼 (팀장/관리자만, 본인 칼럼 제외) */}
          {canVerify && !isVerified && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${isCurrentThemeDark
                  ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20'
                  : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                }
                ${verifying ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {verifying ? '검증중...' : '검증하기'}
            </button>
          )}
          {canVerify && isVerified && (
            <button
              onClick={handleUnverify}
              disabled={verifying}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${isCurrentThemeDark
                  ? 'text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10'
                  : 'text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                }
                ${verifying ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {verifying ? '취소중...' : '검증 취소'}
            </button>
          )}
          {canEdit && (
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

      {/* 댓글 섹션 */}
      <section className={`mt-8 pt-6 pb-16 border-t ${styles.border}`}>
        {/* 섹션 헤더 */}
        <div className="flex items-center gap-2 mb-5">
          <svg
            className={`w-5 h-5 ${isCurrentThemeDark ? 'text-emerald-400' : 'text-emerald-600'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3
            className={`text-base font-semibold ${styles.title}`}
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            의견
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isCurrentThemeDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            {comments.length}
          </span>
        </div>

        {/* 댓글 작성 폼 */}
        <form onSubmit={handleSubmitComment} className="mb-6">
          <div className={`
            relative rounded-xl overflow-hidden
            ${isCurrentThemeDark
              ? 'bg-white/5 border border-white/10 focus-within:border-emerald-500/50'
              : 'bg-gray-50 border border-gray-200 focus-within:border-emerald-400'
            }
            transition-colors
          `}>
            <textarea
              ref={commentInputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="의견을 남겨주세요..."
              rows={3}
              className={`
                w-full px-4 py-3 bg-transparent resize-none outline-none
                text-sm leading-relaxed
                ${styles.text}
                placeholder:${styles.mutedText}
              `}
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
            />
            <div className={`flex items-center justify-between px-3 py-2 border-t ${styles.border}`}>
              <span className={`text-xs ${styles.mutedText}`}>
                {newComment.length}/2000
              </span>
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                  transition-all duration-200
                  ${newComment.trim() && !submitting
                    ? isCurrentThemeDark
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30'
                    : isCurrentThemeDark
                      ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>등록중</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>등록</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* 댓글 목록 */}
        <div className="space-y-1">
          {commentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <svg className={`w-6 h-6 animate-spin ${styles.mutedText}`} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : comments.length === 0 ? (
            <div className={`text-center py-8 ${styles.mutedText}`}>
              <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">아직 의견이 없습니다</p>
              <p className="text-xs mt-1 opacity-70">첫 번째 의견을 남겨보세요</p>
            </div>
          ) : (
            comments.map((comment, index) => {
              const isCommentAuthor = comment.user_id === user?.id;
              const canDeleteComment = isCommentAuthor || isManagerRole;
              const isEditing = editingCommentId === comment.id;

              return (
                <div
                  key={comment.id}
                  className={`
                    group relative py-4
                    ${index !== comments.length - 1 ? `border-b ${styles.border}` : ''}
                  `}
                >
                  {/* 댓글 헤더 */}
                  <div className="flex items-start gap-3">
                    {/* 아바타 */}
                    <div className={`
                      w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-medium
                      ${isCurrentThemeDark
                        ? 'bg-gradient-to-br from-slate-600 to-slate-700'
                        : 'bg-gradient-to-br from-slate-400 to-slate-500'
                      }
                    `}>
                      {comment.user?.full_name?.charAt(0) || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* 작성자 정보 */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-sm font-medium ${styles.text}`}>
                          {comment.user?.full_name || '알 수 없음'}
                        </span>
                        <span className={`text-xs ${styles.mutedText}`}>
                          {formatRelativeTime(comment.created_at)}
                          {comment.updated_at && comment.updated_at !== comment.created_at && (
                            <span className="ml-1 opacity-70">(수정됨)</span>
                          )}
                        </span>
                      </div>

                      {/* 댓글 내용 또는 편집 폼 */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            rows={3}
                            className={`
                              w-full px-3 py-2 rounded-lg resize-none outline-none
                              text-sm leading-relaxed
                              ${isCurrentThemeDark
                                ? 'bg-white/10 border border-white/20 focus:border-emerald-500/50 text-gray-200'
                                : 'bg-white border border-gray-300 focus:border-emerald-400 text-gray-700'
                              }
                              transition-colors
                            `}
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={!editingContent.trim()}
                              className={`
                                px-3 py-1 text-xs font-medium rounded-md transition-colors
                                ${editingContent.trim()
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : isCurrentThemeDark
                                    ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }
                              `}
                            >
                              저장
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className={`
                                px-3 py-1 text-xs font-medium rounded-md transition-colors
                                ${isCurrentThemeDark
                                  ? 'bg-white/5 text-gray-400 hover:bg-white/10'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }
                              `}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={`text-sm leading-relaxed whitespace-pre-wrap ${styles.text}`}
                          style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
                        >
                          {comment.content}
                        </p>
                      )}
                    </div>

                    {/* 액션 버튼 (hover 시 표시) */}
                    {!isEditing && (isCommentAuthor || canDeleteComment) && (
                      <div className={`
                        flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity
                      `}>
                        {isCommentAuthor && (
                          <button
                            onClick={() => handleStartEdit(comment)}
                            className={`
                              p-1.5 rounded-md transition-colors
                              ${isCurrentThemeDark
                                ? 'text-gray-500 hover:text-gray-300 hover:bg-white/10'
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }
                            `}
                            title="수정"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canDeleteComment && (
                          <button
                            onClick={() => setShowCommentDeleteConfirm(comment.id)}
                            className={`
                              p-1.5 rounded-md transition-colors
                              ${isCurrentThemeDark
                                ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              }
                            `}
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title={type === 'column' ? '칼럼 삭제' : '의사결정서 삭제'}
        message={type === 'column' ? '정말 이 칼럼을 삭제하시겠습니까?' : '정말 이 의사결정서를 삭제하시겠습니다?'}
        confirmText="삭제"
        confirmVariant="danger"
      />

      {/* 댓글 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!showCommentDeleteConfirm}
        onClose={() => setShowCommentDeleteConfirm(null)}
        onConfirm={() => handleDeleteComment(showCommentDeleteConfirm)}
        title="댓글 삭제"
        message="정말 이 댓글을 삭제하시겠습니까?"
        confirmText="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
