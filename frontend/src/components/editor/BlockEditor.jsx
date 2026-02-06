import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadService } from '../../services/uploadService';
import { useToast } from '../../context/ToastContext';

/**
 * 노션 스타일 블록 에디터
 *
 * 블록 타입:
 * - paragraph: 일반 텍스트
 * - heading: 제목 (level 1-3)
 * - image: 이미지
 * - quote: 인용
 * - divider: 구분선
 */

const BLOCK_TYPES = [
  { type: 'paragraph', label: '텍스트', icon: 'Aa', description: '일반 텍스트를 입력합니다' },
  { type: 'heading', label: '제목', icon: 'H', description: '섹션 제목을 추가합니다' },
  { type: 'image', label: '이미지', icon: '🖼️', description: '이미지를 업로드합니다' },
  { type: 'quote', label: '인용', icon: '❝', description: '인용문을 추가합니다' },
  { type: 'divider', label: '구분선', icon: '—', description: '가로 구분선을 추가합니다' },
];

function createBlock(type, data = {}) {
  return {
    id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    data: {
      text: '',
      level: type === 'heading' ? 2 : undefined,
      ...data,
    },
  };
}

export function BlockEditor({ initialBlocks = [], onChange, readOnly = false, premium = false }) {
  const toast = useToast();
  const [blocks, setBlocks] = useState(() => {
    if (initialBlocks.length === 0) {
      return [createBlock('paragraph')];
    }
    return initialBlocks;
  });
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [uploadingBlockId, setUploadingBlockId] = useState(null);
  const [menuFilter, setMenuFilter] = useState('');
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // Sync with initial blocks when they change
  useEffect(() => {
    if (initialBlocks.length > 0) {
      setBlocks(initialBlocks);
    }
  }, [initialBlocks]);

  const updateBlocks = useCallback((newBlocks) => {
    setBlocks(newBlocks);
    onChange?.(newBlocks);
  }, [onChange]);

  const updateBlock = useCallback((blockId, newData) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b
    );
    updateBlocks(newBlocks);
  }, [blocks, updateBlocks]);

  const addBlockAfter = useCallback((blockId, type = 'paragraph', data = {}) => {
    const index = blocks.findIndex(b => b.id === blockId);
    const newBlock = createBlock(type, data);
    const newBlocks = [
      ...blocks.slice(0, index + 1),
      newBlock,
      ...blocks.slice(index + 1),
    ];
    updateBlocks(newBlocks);
    setShowMenu(false);
    setMenuFilter('');
    setTimeout(() => setFocusedBlockId(newBlock.id), 50);
    return newBlock;
  }, [blocks, updateBlocks]);

  const deleteBlock = useCallback((blockId) => {
    if (blocks.length <= 1) {
      updateBlock(blockId, { text: '' });
      return;
    }
    const index = blocks.findIndex(b => b.id === blockId);
    const newBlocks = blocks.filter(b => b.id !== blockId);
    updateBlocks(newBlocks);
    if (index > 0) {
      setFocusedBlockId(newBlocks[index - 1].id);
    }
  }, [blocks, updateBlocks, updateBlock]);

  const handleKeyDown = useCallback((e, block) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlockAfter(block.id);
    } else if (e.key === 'Backspace' && block.data.text === '') {
      e.preventDefault();
      deleteBlock(block.id);
    } else if (e.key === '/' && block.data.text === '') {
      e.preventDefault();
      const rect = e.target.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 8, left: rect.left });
      setShowMenu(true);
      setMenuFilter('');
      setFocusedBlockId(block.id);
    } else if (e.key === 'Escape' && showMenu) {
      setShowMenu(false);
      setMenuFilter('');
    }
  }, [addBlockAfter, deleteBlock, showMenu]);

  const handleImageUpload = useCallback(async (blockId, file) => {
    if (!file) return;

    if (file.size > 200 * 1024) {
      toast.warning('이미지 크기는 200KB 이하여야 합니다.');
      return;
    }

    setUploadingBlockId(blockId);
    try {
      const result = await uploadService.uploadImage(file);
      updateBlock(blockId, {
        url: result.url,
        caption: '',
        filename: result.filename
      });
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      toast.error(error.response?.data?.detail || '이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingBlockId(null);
    }
  }, [updateBlock, toast]);

  const handleMenuSelect = useCallback((type) => {
    if (!focusedBlockId) return;

    if (type === 'image') {
      const newBlocks = blocks.map(b =>
        b.id === focusedBlockId ? { ...b, type: 'image', data: { url: '', caption: '' } } : b
      );
      updateBlocks(newBlocks);
      setShowMenu(false);
      setMenuFilter('');
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    } else if (type === 'divider') {
      const newBlocks = blocks.map(b =>
        b.id === focusedBlockId ? { ...b, type: 'divider', data: {} } : b
      );
      updateBlocks(newBlocks);
      addBlockAfter(focusedBlockId);
    } else {
      const newBlocks = blocks.map(b =>
        b.id === focusedBlockId ? { ...b, type, data: { ...b.data, level: type === 'heading' ? 2 : undefined } } : b
      );
      updateBlocks(newBlocks);
      setShowMenu(false);
      setMenuFilter('');
    }
  }, [focusedBlockId, blocks, updateBlocks, addBlockAfter]);

  const filteredBlockTypes = BLOCK_TYPES.filter(bt =>
    bt.label.toLowerCase().includes(menuFilter.toLowerCase()) ||
    bt.type.toLowerCase().includes(menuFilter.toLowerCase())
  );

  const renderBlock = (block, index) => {
    const isUploading = uploadingBlockId === block.id;
    const isFocused = focusedBlockId === block.id;

    // Premium styling
    const textStyle = premium ? {
      fontFamily: "'Crimson Pro', 'Noto Serif KR', serif",
      fontSize: '1.125rem',
      lineHeight: '1.8',
      letterSpacing: '0.01em',
    } : {};

    if (block.type === 'paragraph') {
      return (
        <textarea
          key={block.id}
          value={block.data.text || ''}
          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
          onKeyDown={(e) => handleKeyDown(e, block)}
          onFocus={() => setFocusedBlockId(block.id)}
          placeholder={index === 0 ? (premium ? "여기에 내용을 작성하세요..." : "내용을 입력하세요... ('/' 입력으로 블록 추가)") : ""}
          readOnly={readOnly}
          style={textStyle}
          className={`w-full bg-transparent border-0 outline-none resize-none leading-relaxed ${
            premium
              ? 'text-gray-200 placeholder-gray-600'
              : 'text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-base'
          }`}
          rows={1}
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          }}
        />
      );
    }

    if (block.type === 'heading') {
      const level = block.data.level || 2;
      const sizeClass = premium
        ? level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl'
        : level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg';

      return (
        <div key={block.id} className="flex items-center gap-3">
          {!readOnly && (
            <select
              value={level}
              onChange={(e) => updateBlock(block.id, { level: parseInt(e.target.value) })}
              className={`bg-transparent border-0 text-xs cursor-pointer ${
                premium ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400'
              }`}
            >
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          )}
          <input
            type="text"
            value={block.data.text || ''}
            onChange={(e) => updateBlock(block.id, { text: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, block)}
            onFocus={() => setFocusedBlockId(block.id)}
            placeholder="제목"
            readOnly={readOnly}
            style={premium ? { fontFamily: "'Noto Serif KR', 'Crimson Pro', serif" } : {}}
            className={`flex-1 bg-transparent border-0 outline-none font-semibold ${sizeClass} ${
              premium ? 'text-white placeholder-gray-600' : 'text-gray-900 dark:text-gray-100'
            }`}
          />
        </div>
      );
    }

    if (block.type === 'image') {
      return (
        <div key={block.id} className="py-3">
          {block.data.url ? (
            <div className="space-y-3">
              <img
                src={block.data.url}
                alt={block.data.caption || ''}
                className={`max-w-full rounded-lg ${
                  premium ? 'border border-white/10' : 'border dark:border-gray-700'
                }`}
              />
              {!readOnly && (
                <input
                  type="text"
                  value={block.data.caption || ''}
                  onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                  placeholder="이미지 설명 추가..."
                  style={premium ? { fontFamily: "'DM Sans', sans-serif" } : {}}
                  className={`w-full bg-transparent border-0 outline-none text-sm text-center ${
                    premium ? 'text-gray-500 placeholder-gray-700' : 'text-gray-500 dark:text-gray-400 placeholder-gray-400'
                  }`}
                />
              )}
              {readOnly && block.data.caption && (
                <p className={`text-sm text-center ${premium ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                  {block.data.caption}
                </p>
              )}
            </div>
          ) : (
            <div
              className={`group border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
                isUploading
                  ? premium
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                  : premium
                    ? 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => {
                setFocusedBlockId(block.id);
                fileInputRef.current?.click();
              }}
            >
              {isUploading ? (
                <div className={`flex flex-col items-center gap-3 ${premium ? 'text-emerald-400' : 'text-primary-600 dark:text-primary-400'}`}>
                  <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm font-medium">업로드 중...</span>
                </div>
              ) : (
                <>
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-colors ${
                    premium
                      ? 'bg-white/5 group-hover:bg-white/10'
                      : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                  }`}>
                    <svg className={`w-6 h-6 ${premium ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className={`text-sm font-medium mb-1 ${premium ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    클릭하여 이미지 업로드
                  </p>
                  <p className={`text-xs ${premium ? 'text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}>
                    최대 200KB
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    if (block.type === 'quote') {
      return (
        <div key={block.id} className={`relative pl-5 py-2 ${
          premium ? 'border-l-2 border-emerald-500/50' : 'border-l-4 border-gray-300 dark:border-gray-600'
        }`}>
          {premium && (
            <div className="absolute -left-3 top-2 text-2xl text-emerald-500/30 font-serif">"</div>
          )}
          <textarea
            value={block.data.text || ''}
            onChange={(e) => updateBlock(block.id, { text: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, block)}
            onFocus={() => setFocusedBlockId(block.id)}
            placeholder="인용문..."
            readOnly={readOnly}
            style={premium ? { fontFamily: "'Crimson Pro', serif", fontStyle: 'italic' } : {}}
            className={`w-full bg-transparent border-0 outline-none resize-none ${
              premium
                ? 'text-gray-400 placeholder-gray-600 text-lg'
                : 'text-gray-600 dark:text-gray-400 italic'
            }`}
            rows={1}
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }
            }}
          />
        </div>
      );
    }

    if (block.type === 'divider') {
      return (
        <div key={block.id} className="py-6">
          <div className={`h-px ${
            premium
              ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
              : 'border-t border-gray-200 dark:border-gray-700'
          }`} />
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`relative ${premium ? 'min-h-[400px]' : 'min-h-[300px]'}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && focusedBlockId) {
            handleImageUpload(focusedBlockId, file);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Block list */}
      <div className={premium ? 'space-y-4' : 'space-y-2'}>
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className={`group relative rounded-lg transition-all duration-150 ${
              premium
                ? focusedBlockId === block.id
                  ? 'bg-white/[0.02]'
                  : ''
                : focusedBlockId === block.id
                  ? 'bg-gray-50 dark:bg-gray-800/50'
                  : ''
            } ${premium ? 'px-3 py-2 -mx-3' : 'px-2 py-1 -mx-2'}`}
          >
            {/* Delete button */}
            {!readOnly && (
              <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
                premium ? '-left-10' : 'left-0 -translate-x-full pr-2'
              }`}>
                <button
                  onClick={() => deleteBlock(block.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    premium
                      ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-gray-400 hover:text-red-500'
                  }`}
                  title="블록 삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
            {renderBlock(block, index)}
          </div>
        ))}
      </div>

      {/* Add block button */}
      {!readOnly && (
        <button
          onClick={() => {
            const lastBlock = blocks[blocks.length - 1];
            addBlockAfter(lastBlock.id);
          }}
          className={`mt-6 flex items-center gap-2 transition-colors ${
            premium
              ? 'text-gray-600 hover:text-gray-400'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium">블록 추가</span>
        </button>
      )}

      {/* Block type menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowMenu(false);
              setMenuFilter('');
            }}
          />
          <div
            ref={menuRef}
            className={`fixed z-50 rounded-xl shadow-2xl overflow-hidden ${
              premium
                ? 'bg-[#1a1a1c] border border-white/10 min-w-[220px]'
                : 'bg-white dark:bg-gray-800 border dark:border-gray-700 min-w-[200px]'
            }`}
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {/* Search input */}
            <div className={`px-3 py-2 border-b ${premium ? 'border-white/5' : 'border-gray-100 dark:border-gray-700'}`}>
              <input
                type="text"
                value={menuFilter}
                onChange={(e) => setMenuFilter(e.target.value)}
                placeholder="블록 검색..."
                autoFocus
                className={`w-full text-sm bg-transparent border-0 outline-none ${
                  premium
                    ? 'text-gray-200 placeholder-gray-600'
                    : 'text-gray-700 dark:text-gray-300 placeholder-gray-400'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredBlockTypes.length > 0) {
                    handleMenuSelect(filteredBlockTypes[0].type);
                  } else if (e.key === 'Escape') {
                    setShowMenu(false);
                    setMenuFilter('');
                  }
                }}
              />
            </div>

            {/* Block type list */}
            <div className="py-1 max-h-[280px] overflow-y-auto">
              {filteredBlockTypes.length === 0 ? (
                <div className={`px-4 py-3 text-sm ${premium ? 'text-gray-500' : 'text-gray-400'}`}>
                  결과 없음
                </div>
              ) : (
                filteredBlockTypes.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => handleMenuSelect(bt.type)}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                      premium
                        ? 'hover:bg-white/5'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                      premium
                        ? 'bg-white/5 text-gray-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {bt.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${premium ? 'text-gray-200' : 'text-gray-700 dark:text-gray-300'}`}>
                        {bt.label}
                      </div>
                      <div className={`text-xs truncate ${premium ? 'text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}>
                        {bt.description}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 블록 렌더러 (읽기 전용) - 프리미엄 뷰어용
 */
export function BlockRenderer({ blocks = [], premium = false }) {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <div className={premium ? 'space-y-4' : 'prose dark:prose-invert max-w-none'}>
      {blocks.map((block) => {
        if (block.type === 'paragraph') {
          return (
            <p
              key={block.id}
              className={`whitespace-pre-wrap ${
                premium
                  ? 'text-gray-300 text-lg leading-relaxed'
                  : 'mb-3 text-gray-700 dark:text-gray-300'
              }`}
              style={premium ? { fontFamily: "'Crimson Pro', 'Noto Serif KR', serif" } : {}}
            >
              {block.data.text || '\u00A0'}
            </p>
          );
        }

        if (block.type === 'heading') {
          const level = block.data.level || 2;
          const sizeClass = premium
            ? level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl'
            : '';

          if (premium) {
            return (
              <h2
                key={block.id}
                className={`font-semibold text-white ${sizeClass} mt-8 mb-4`}
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                {block.data.text}
              </h2>
            );
          }

          const Tag = `h${level}`;
          return (
            <Tag key={block.id} className="font-bold text-gray-900 dark:text-gray-100 mb-3">
              {block.data.text}
            </Tag>
          );
        }

        if (block.type === 'image') {
          return (
            <figure key={block.id} className={premium ? 'my-8' : 'my-4'}>
              <img
                src={block.data.url}
                alt={block.data.caption || ''}
                className={`max-w-full rounded-lg ${premium ? 'border border-white/10' : ''}`}
              />
              {block.data.caption && (
                <figcaption className={`text-center text-sm mt-3 ${
                  premium ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {block.data.caption}
                </figcaption>
              )}
            </figure>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={block.id}
              className={`my-6 ${
                premium
                  ? 'pl-5 border-l-2 border-emerald-500/50 text-gray-400 italic text-lg'
                  : 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400'
              }`}
              style={premium ? { fontFamily: "'Crimson Pro', serif" } : {}}
            >
              {block.data.text}
            </blockquote>
          );
        }

        if (block.type === 'divider') {
          return (
            <div key={block.id} className={premium ? 'py-6' : 'my-6'}>
              <div className={`h-px ${
                premium
                  ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
                  : 'border-t border-gray-200 dark:border-gray-700'
              }`} />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
