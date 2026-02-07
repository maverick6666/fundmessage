import { useState, useEffect, useRef } from 'react';
import { BlockEditor } from './BlockEditor';
import { decisionNoteService } from '../../services/decisionNoteService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { useSidePanelStore } from '../../stores/useSidePanelStore';

/**
 * 사이드 패널용 의사결정 노트 에디터
 */
export function NoteEditorPanel({ note, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const { isCurrentThemeDark } = useTheme();
  const { closePanel } = useSidePanelStore();
  const titleRef = useRef(null);
  const editorContainerRef = useRef(null);

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      // 블록이 있으면 블록 사용, 없으면 content를 파싱
      if (note.blocks && note.blocks.length > 0) {
        setBlocks(note.blocks);
      } else if (note.content) {
        // 마크다운 content를 블록으로 변환
        const paragraphs = note.content.split('\n').filter(p => p.trim());
        setBlocks(paragraphs.map((text, i) => ({
          id: `legacy_${i}`,
          type: 'paragraph',
          data: { text }
        })));
      }
    }
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [note?.id]);

  // 블록에서 텍스트 추출
  const extractTextFromBlocks = (blocks) => {
    return blocks
      .map(block => {
        if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') {
          return block.data.text || '';
        }
        return '';
      })
      .filter(text => text.trim())
      .join('\n\n');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      titleRef.current?.focus();
      return;
    }

    const hasContent = blocks.some(b =>
      (b.type === 'paragraph' && b.data.text?.trim()) ||
      (b.type === 'heading' && b.data.text?.trim()) ||
      (b.type === 'quote' && b.data.text?.trim()) ||
      (b.type === 'image' && b.data.url) ||
      b.type === 'divider'
    );

    if (!hasContent) {
      setError('내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        title: title.trim(),
        blocks,
        content: extractTextFromBlocks(blocks), // 검색/미리보기용
      };

      // position_id 또는 position.id 사용
      const positionId = note.position_id || note.position?.id;
      if (!positionId) {
        setError('포지션 정보를 찾을 수 없습니다.');
        return;
      }

      await decisionNoteService.updateNote(positionId, note.id, data);
      toast.success('의사결정 노트가 수정되었습니다');

      setHasChanges(false);
      onSaved?.();
      closePanel();
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      setShowCloseConfirm(true);
    } else {
      closePanel();
    }
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    closePanel();
  };

  // 테마별 스타일
  const styles = isCurrentThemeDark
    ? {
        bg: 'bg-[#18181b]',
        text: 'text-white',
        textSecondary: 'text-gray-400',
        textMuted: 'text-gray-500',
        placeholder: 'placeholder-gray-600',
        border: 'border-white/10',
        errorBg: 'bg-red-500/10 border-red-500/20',
        errorText: 'text-red-400',
        divider: 'bg-white/10',
        modalBg: 'bg-[#1a1a1c]',
        modalBorder: 'border-white/10',
      }
    : {
        bg: 'bg-white',
        text: 'text-gray-900',
        textSecondary: 'text-gray-600',
        textMuted: 'text-gray-500',
        placeholder: 'placeholder-gray-400',
        border: 'border-gray-200',
        errorBg: 'bg-red-50 border-red-200',
        errorText: 'text-red-600',
        divider: 'bg-gray-200',
        modalBg: 'bg-white',
        modalBorder: 'border-gray-200',
      };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className={`flex items-center justify-between px-5 py-3 border-b ${styles.border} shrink-0`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-md shrink-0 ${
            isCurrentThemeDark
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
              : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
          }`}>
            의사결정 노트 수정
          </span>
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-xs text-amber-500 shrink-0">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              저장 필요
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleClose}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isCurrentThemeDark
                ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 rounded-lg transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 포지션 정보 */}
      {note?.position && (
        <div className={`px-5 py-2 border-b ${styles.border} shrink-0`}>
          <span className={`text-sm ${styles.textSecondary}`}>
            {note.position.ticker_name || note.position.ticker}
            <span className={`ml-2 font-mono text-xs ${styles.textMuted}`}>
              {note.position.ticker} · {note.position.market}
            </span>
          </span>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className={`mx-5 mt-4 px-4 py-3 ${styles.errorBg} border rounded-lg ${styles.errorText} text-sm flex items-center gap-2 shrink-0`}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">{error}</span>
          <button onClick={() => setError('')} className="ml-auto opacity-70 hover:opacity-100 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 에디터 - 스크롤 영역 */}
      <div
        ref={editorContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-6"
        style={{ overflowAnchor: 'none' }}
      >
        {/* 제목 */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setHasChanges(true);
          }}
          placeholder="제목"
          className={`w-full text-2xl font-semibold bg-transparent border-0 outline-none ${styles.text} ${styles.placeholder} mb-4`}
          style={{ fontFamily: "'Noto Serif KR', serif" }}
        />
        <div className={`h-px ${styles.divider} mb-6`} />

        {/* 블록 에디터 */}
        <div data-block-editor-container>
          <BlockEditor
            initialBlocks={blocks}
            onChange={(newBlocks) => {
              setBlocks(newBlocks);
              setHasChanges(true);
            }}
            isDark={isCurrentThemeDark}
            containerRef={editorContainerRef}
          />
        </div>
      </div>

      {/* 도움말 */}
      <div className={`px-5 py-3 border-t ${styles.border} shrink-0`}>
        <div className={`flex items-center gap-4 text-xs ${styles.textMuted}`}>
          <span className="flex items-center gap-1.5">
            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
              isCurrentThemeDark ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'
            }`}>/</kbd>
            <span>블록 메뉴</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
              isCurrentThemeDark ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'
            }`}>Enter</kbd>
            <span>새 블록</span>
          </span>
        </div>
      </div>

      {/* 닫기 확인 모달 */}
      {showCloseConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className={`mx-4 p-5 rounded-xl shadow-xl border max-w-sm w-full ${styles.modalBg} ${styles.modalBorder}`}>
            <h3 className={`text-lg font-semibold mb-2 ${styles.text}`}>
              저장하지 않고 닫으시겠습니까?
            </h3>
            <p className={`text-sm mb-5 ${styles.textSecondary}`}>
              변경사항이 저장되지 않습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isCurrentThemeDark
                    ? 'text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                계속 작성
              </button>
              <button
                onClick={confirmClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
