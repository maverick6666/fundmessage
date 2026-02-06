import { useState, useEffect, useRef } from 'react';
import { BlockEditor } from './BlockEditor';
import { columnService } from '../../services/columnService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { useSidePanelStore } from '../../stores/useSidePanelStore';

/**
 * 사이드 패널용 칼럼 에디터
 */
export function ColumnEditorPanel({ columnId = null, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const { isCurrentThemeDark } = useTheme();
  const { closePanel } = useSidePanelStore();
  const titleRef = useRef(null);

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const isEditing = !!columnId;

  useEffect(() => {
    if (isEditing) {
      fetchColumn();
    } else {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [columnId]);

  const fetchColumn = async () => {
    setLoading(true);
    try {
      const data = await columnService.getColumn(columnId);
      setTitle(data.title);
      if (data.blocks && data.blocks.length > 0) {
        setBlocks(data.blocks);
      } else if (data.content) {
        const paragraphs = data.content.split('\n').filter(p => p.trim());
        setBlocks(paragraphs.map((text, i) => ({
          id: `legacy_${i}`,
          type: 'paragraph',
          data: { text }
        })));
      }
    } catch (err) {
      setError('칼럼을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        content: null,
      };

      if (isEditing) {
        await columnService.updateColumn(columnId, data);
        toast.success('칼럼이 수정되었습니다');
      } else {
        await columnService.createColumn(data);
        toast.success('칼럼이 저장되었습니다');
      }

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
      if (!confirm('저장하지 않고 닫으시겠습니까?')) return;
    }
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
      };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className={`text-sm ${styles.textSecondary}`}>불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className={`flex items-center justify-between px-5 py-3 border-b ${styles.border}`}>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${
            isCurrentThemeDark
              ? 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20'
              : 'bg-purple-50 text-purple-600 ring-1 ring-purple-200'
          }`}>
            {isEditing ? '칼럼 수정' : '새 칼럼'}
          </span>
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-xs text-amber-500">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              저장 필요
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      {/* 에러 메시지 */}
      {error && (
        <div className={`mx-5 mt-4 px-4 py-3 ${styles.errorBg} border rounded-lg ${styles.errorText} text-sm flex items-center gap-2`}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto opacity-70 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 에디터 */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
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
        <BlockEditor
          initialBlocks={blocks}
          onChange={(newBlocks) => {
            setBlocks(newBlocks);
            setHasChanges(true);
          }}
          isDark={isCurrentThemeDark}
        />
      </div>
    </div>
  );
}
