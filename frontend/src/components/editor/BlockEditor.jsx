import { useState, useRef, useCallback } from 'react';
import { uploadService } from '../../services/uploadService';

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
  { type: 'paragraph', label: '텍스트', icon: 'T' },
  { type: 'heading', label: '제목', icon: 'H' },
  { type: 'image', label: '이미지', icon: '🖼' },
  { type: 'quote', label: '인용', icon: '"' },
  { type: 'divider', label: '구분선', icon: '—' },
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

export function BlockEditor({ initialBlocks = [], onChange, readOnly = false }) {
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
  const fileInputRef = useRef(null);

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
    setTimeout(() => setFocusedBlockId(newBlock.id), 50);
    return newBlock;
  }, [blocks, updateBlocks]);

  const deleteBlock = useCallback((blockId) => {
    if (blocks.length <= 1) {
      // 마지막 블록은 비우기만
      updateBlock(blockId, { text: '' });
      return;
    }
    const index = blocks.findIndex(b => b.id === blockId);
    const newBlocks = blocks.filter(b => b.id !== blockId);
    updateBlocks(newBlocks);
    // 이전 블록에 포커스
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
      setMenuPosition({ top: rect.bottom + 4, left: rect.left });
      setShowMenu(true);
      setFocusedBlockId(block.id);
    }
  }, [addBlockAfter, deleteBlock]);

  const handleImageUpload = useCallback(async (blockId, file) => {
    if (!file) return;

    // 파일 크기 체크 (200KB)
    if (file.size > 200 * 1024) {
      alert('이미지 크기는 200KB 이하여야 합니다.');
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
      alert(error.response?.data?.detail || '이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingBlockId(null);
    }
  }, [updateBlock]);

  const handleMenuSelect = useCallback((type) => {
    if (!focusedBlockId) return;

    if (type === 'image') {
      // 현재 블록을 이미지로 변경
      const newBlocks = blocks.map(b =>
        b.id === focusedBlockId ? { ...b, type: 'image', data: { url: '', caption: '' } } : b
      );
      updateBlocks(newBlocks);
      setShowMenu(false);
      // 파일 선택 다이얼로그 열기
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    } else if (type === 'divider') {
      // 구분선 추가
      const newBlocks = blocks.map(b =>
        b.id === focusedBlockId ? { ...b, type: 'divider', data: {} } : b
      );
      updateBlocks(newBlocks);
      addBlockAfter(focusedBlockId);
    } else {
      // 다른 타입으로 변경
      const newBlocks = blocks.map(b =>
        b.id === focusedBlockId ? { ...b, type, data: { ...b.data, level: type === 'heading' ? 2 : undefined } } : b
      );
      updateBlocks(newBlocks);
      setShowMenu(false);
    }
  }, [focusedBlockId, blocks, updateBlocks, addBlockAfter]);

  const renderBlock = (block, index) => {
    const isUploading = uploadingBlockId === block.id;

    if (block.type === 'paragraph') {
      return (
        <textarea
          key={block.id}
          value={block.data.text || ''}
          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
          onKeyDown={(e) => handleKeyDown(e, block)}
          onFocus={() => setFocusedBlockId(block.id)}
          placeholder={index === 0 ? "내용을 입력하세요... ('/' 입력으로 블록 추가)" : ""}
          readOnly={readOnly}
          className="w-full bg-transparent border-0 outline-none resize-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-base leading-relaxed"
          rows={1}
          style={{ minHeight: '1.75rem' }}
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
      const sizeClass = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg';
      return (
        <div key={block.id} className="flex items-center gap-2">
          <select
            value={level}
            onChange={(e) => updateBlock(block.id, { level: parseInt(e.target.value) })}
            className="bg-transparent border-0 text-xs text-gray-400 cursor-pointer"
            disabled={readOnly}
          >
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            type="text"
            value={block.data.text || ''}
            onChange={(e) => updateBlock(block.id, { text: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, block)}
            onFocus={() => setFocusedBlockId(block.id)}
            placeholder="제목"
            readOnly={readOnly}
            className={`flex-1 bg-transparent border-0 outline-none font-bold text-gray-900 dark:text-gray-100 ${sizeClass}`}
          />
        </div>
      );
    }

    if (block.type === 'image') {
      return (
        <div key={block.id} className="py-2">
          {block.data.url ? (
            <div className="space-y-2">
              <img
                src={block.data.url}
                alt={block.data.caption || ''}
                className="max-w-full rounded-lg border dark:border-gray-700"
              />
              {!readOnly && (
                <input
                  type="text"
                  value={block.data.caption || ''}
                  onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                  placeholder="이미지 설명 추가..."
                  className="w-full bg-transparent border-0 outline-none text-sm text-gray-500 dark:text-gray-400 placeholder-gray-400"
                />
              )}
              {readOnly && block.data.caption && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{block.data.caption}</p>
              )}
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isUploading
                  ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => {
                setFocusedBlockId(block.id);
                fileInputRef.current?.click();
              }}
            >
              {isUploading ? (
                <div className="flex items-center justify-center gap-2 text-primary-600 dark:text-primary-400">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>업로드 중...</span>
                </div>
              ) : (
                <>
                  <div className="text-3xl mb-2">🖼</div>
                  <p className="text-gray-500 dark:text-gray-400">클릭하여 이미지 업로드</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">최대 200KB</p>
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    if (block.type === 'quote') {
      return (
        <div key={block.id} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1">
          <textarea
            value={block.data.text || ''}
            onChange={(e) => updateBlock(block.id, { text: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, block)}
            onFocus={() => setFocusedBlockId(block.id)}
            placeholder="인용문..."
            readOnly={readOnly}
            className="w-full bg-transparent border-0 outline-none resize-none text-gray-600 dark:text-gray-400 italic"
            rows={1}
            style={{ minHeight: '1.5rem' }}
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
        <div key={block.id} className="py-4">
          <hr className="border-gray-200 dark:border-gray-700" />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="relative min-h-[300px]">
      {/* 히든 파일 인풋 */}
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

      {/* 블록 목록 */}
      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className={`group relative ${
              focusedBlockId === block.id ? 'bg-gray-50 dark:bg-gray-800/50' : ''
            } rounded px-2 py-1 -mx-2`}
          >
            {/* 드래그 핸들 & 삭제 버튼 */}
            {!readOnly && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button
                  onClick={() => deleteBlock(block.id)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
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

      {/* 블록 추가 버튼 */}
      {!readOnly && (
        <button
          onClick={() => {
            const lastBlock = blocks[blocks.length - 1];
            addBlockAfter(lastBlock.id);
          }}
          className="mt-4 flex items-center gap-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm">블록 추가</span>
        </button>
      )}

      {/* 블록 타입 선택 메뉴 */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-2 min-w-[150px]"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                onClick={() => handleMenuSelect(bt.type)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
              >
                <span className="w-6 h-6 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  {bt.icon}
                </span>
                <span className="text-gray-700 dark:text-gray-300">{bt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 블록 렌더러 (읽기 전용)
 */
export function BlockRenderer({ blocks = [] }) {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <div className="prose dark:prose-invert max-w-none">
      {blocks.map((block) => {
        if (block.type === 'paragraph') {
          return (
            <p key={block.id} className="mb-3 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {block.data.text || '\u00A0'}
            </p>
          );
        }

        if (block.type === 'heading') {
          const Tag = `h${block.data.level || 2}`;
          return (
            <Tag key={block.id} className="font-bold text-gray-900 dark:text-gray-100 mb-3">
              {block.data.text}
            </Tag>
          );
        }

        if (block.type === 'image') {
          return (
            <figure key={block.id} className="my-4">
              <img
                src={block.data.url}
                alt={block.data.caption || ''}
                className="max-w-full rounded-lg"
              />
              {block.data.caption && (
                <figcaption className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {block.data.caption}
                </figcaption>
              )}
            </figure>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={block.id} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-4">
              {block.data.text}
            </blockquote>
          );
        }

        if (block.type === 'divider') {
          return <hr key={block.id} className="my-6 border-gray-200 dark:border-gray-700" />;
        }

        return null;
      })}
    </div>
  );
}
