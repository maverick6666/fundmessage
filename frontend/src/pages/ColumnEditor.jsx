import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BlockEditor } from '../components/editor/BlockEditor';
import { columnService } from '../services/columnService';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';

export function ColumnEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const isEditing = !!id;
  const titleRef = useRef(null);

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (isEditing) {
      fetchColumn();
    } else {
      // Focus title on new document
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [id]);

  useEffect(() => {
    // Calculate word count
    const text = blocks
      .filter(b => b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote')
      .map(b => b.data.text || '')
      .join(' ');
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  }, [blocks]);

  const fetchColumn = async () => {
    setLoading(true);
    try {
      const data = await columnService.getColumn(id);
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
        await columnService.updateColumn(id, data);
        toast.success('칼럼이 수정되었습니다');
      } else {
        await columnService.createColumn(data);
        toast.success('칼럼이 저장되었습니다');
      }

      setHasChanges(false);
      navigate('/reports?tab=columns');
    } catch (err) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleExit = () => {
    if (hasChanges) {
      setShowExitConfirm(true);
    } else {
      navigate('/reports?tab=columns');
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus to editor
      document.querySelector('[data-block-editor] textarea, [data-block-editor] input')?.focus();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0b] flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-gray-400 text-sm font-medium tracking-wide">문서를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Full-screen immersive editor */}
      <div className="fixed inset-0 bg-[#0a0a0b] z-50 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0b] via-[#0d0d0e] to-[#0a0a0b]" />

        {/* Paper texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />

        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
          <button
            onClick={handleExit}
            className="group flex items-center gap-2.5 text-gray-500 hover:text-gray-300 transition-colors duration-200"
          >
            <svg className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium tracking-wide">나가기</span>
          </button>

          <div className="flex items-center gap-6">
            {/* Word count */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
              <span className="tabular-nums">{wordCount}</span>
              <span>단어</span>
            </div>

            {/* Save status */}
            {hasChanges && (
              <div className="flex items-center gap-1.5 text-xs text-amber-500/70">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                <span>저장되지 않음</span>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="relative group px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed overflow-hidden"
            >
              <span className={`flex items-center gap-2 transition-opacity ${saving ? 'opacity-0' : 'opacity-100'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                저장
              </span>
              {saving && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Error message */}
        {error && (
          <div className="relative z-10 mx-auto max-w-3xl px-6 pt-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-red-400/70 hover:text-red-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Main content area */}
        <main className="relative z-10 h-[calc(100vh-65px)] overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-12 pb-32">
            {/* Title input */}
            <div className="mb-10">
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                }}
                onKeyDown={handleTitleKeyDown}
                placeholder="제목"
                className="w-full text-4xl sm:text-5xl font-semibold bg-transparent border-0 outline-none text-white placeholder-gray-700 leading-tight tracking-tight"
                style={{ fontFamily: "'Noto Serif KR', 'Crimson Pro', serif" }}
              />
              <div className="mt-4 h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
            </div>

            {/* Block editor */}
            <div data-block-editor>
              <BlockEditor
                initialBlocks={blocks}
                onChange={(newBlocks) => {
                  setBlocks(newBlocks);
                  setHasChanges(true);
                }}
                premium
              />
            </div>
          </div>
        </main>

        {/* Bottom help bar */}
        <footer className="fixed bottom-0 inset-x-0 z-10 flex items-center justify-center py-4 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/95 to-transparent pointer-events-none">
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono">/</kbd>
              <span>블록 메뉴</span>
            </span>
            <span className="w-px h-3 bg-gray-800" />
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono">Enter</kbd>
              <span>새 블록</span>
            </span>
          </div>
        </footer>
      </div>

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141416] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">저장하지 않고 나가시겠습니까?</h3>
            <p className="text-sm text-gray-400 mb-6">변경사항이 저장되지 않습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => navigate('/reports?tab=columns')}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
