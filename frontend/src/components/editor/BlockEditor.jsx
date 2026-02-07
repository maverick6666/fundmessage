import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

export function BlockEditor({ initialBlocks = [], onChange, readOnly = false, isDark = false, containerRef = null }) {
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const editorRef = useRef(null);
  const menuInputRef = useRef(null);
  // 내부에서 변경이 발생했는지 추적 (이미지 업로드, 텍스트 수정 등)
  const internalChangeRef = useRef(false);
  // textarea refs for height auto-resize
  const textareaRefs = useRef(new Map());

  // initialBlocks의 ID를 문자열로 변환하여 비교 (참조 대신 내용 기반)
  const initialBlockIds = useMemo(() =>
    initialBlocks.map(b => b.id).join(','),
    [initialBlocks]
  );

  // Sync with initial blocks only when data comes from external source (server fetch)
  useEffect(() => {
    // 내부 변경이면 무시 (이미지 업로드 등)
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }

    // 외부에서 블록 데이터가 로드된 경우에만 동기화
    if (initialBlocks.length > 0) {
      setBlocks(initialBlocks);
    }
  }, [initialBlockIds]);

  // 메뉴 위치 조정 (화면 하단 overflow 방지)
  useEffect(() => {
    if (showMenu && menuRef.current) {
      const menuEl = menuRef.current;
      const menuRect = menuEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // 메뉴가 화면 하단을 벗어나면 위로 조정
      if (menuRect.bottom > viewportHeight - 20) {
        const newTop = menuPosition.top - menuRect.height - 50;
        if (newTop > 50) {
          setMenuPosition(prev => ({ ...prev, top: newTop }));
        }
      }
    }
  }, [showMenu]);

  const updateBlocks = useCallback((newBlocks) => {
    setBlocks(newBlocks);
    // 내부 변경 표시 (useEffect에서 외부 동기화 방지)
    internalChangeRef.current = true;
    onChange?.(newBlocks);
  }, [onChange]);

  // textarea 높이 자동 조절 (스크롤 점프 방지)
  const adjustTextareaHeight = useCallback((el) => {
    if (!el) return;
    // requestAnimationFrame으로 레이아웃 계산 후 높이 조정
    requestAnimationFrame(() => {
      if (!el) return;
      const currentHeight = el.style.height;
      el.style.height = 'auto';
      const newHeight = el.scrollHeight + 'px';
      // 높이가 변경된 경우에만 업데이트
      if (currentHeight !== newHeight) {
        el.style.height = newHeight;
      } else {
        el.style.height = currentHeight;
      }
    });
  }, []);

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
      const menuWidth = 240;
      const viewportWidth = window.innerWidth;

      // 메뉴를 입력창 왼쪽 기준으로 표시, 화면 밖으로 나가지 않게 조정
      let left = rect.left;

      // 오른쪽 overflow 방지: 메뉴가 화면 우측을 넘으면 왼쪽으로 이동
      if (left + menuWidth > viewportWidth - 20) {
        left = viewportWidth - menuWidth - 20;
      }

      // 왼쪽 overflow 방지
      if (left < 10) {
        left = 10;
      }

      setMenuPosition({ top: rect.bottom + 8, left });
      setShowMenu(true);
      setMenuFilter('');
      setFocusedBlockId(block.id);

      // 메뉴 입력창에 포커스
      setTimeout(() => menuInputRef.current?.focus(), 50);
    } else if (e.key === 'Escape' && showMenu) {
      setShowMenu(false);
      setMenuFilter('');
    }
  }, [addBlockAfter, deleteBlock, showMenu]);

  // 이미지를 현재 블록 또는 새 블록에 추가
  const insertImageFromFile = useCallback(async (file, targetBlockId = null) => {
    if (!file || !file.type.startsWith('image/')) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.warning('이미지 크기는 2MB 이하여야 합니다.');
      return;
    }

    // 타겟 블록이 없으면 현재 포커스된 블록 사용
    let blockId = targetBlockId || focusedBlockId;

    // 블록이 없으면 새 블록 생성
    if (!blockId) {
      const lastBlock = blocks[blocks.length - 1];
      const newBlock = addBlockAfter(lastBlock.id, 'image');
      blockId = newBlock.id;
    }

    setUploadingBlockId(blockId);
    try {
      const result = await uploadService.uploadImage(file);

      // 블록 타입 변환과 이미지 URL 업데이트를 한번에 처리
      setBlocks(prevBlocks => {
        const newBlocks = prevBlocks.map(b =>
          b.id === blockId
            ? { ...b, type: 'image', data: { url: result.url, caption: '', filename: result.filename } }
            : b
        );
        internalChangeRef.current = true;
        onChange?.(newBlocks);
        return newBlocks;
      });

      toast.success('이미지가 업로드되었습니다');
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      toast.error(error.response?.data?.detail || '이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingBlockId(null);
    }
  }, [focusedBlockId, blocks, addBlockAfter, onChange, toast]);

  // 클립보드 붙여넣기 핸들러 (이미지 지원)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          insertImageFromFile(file);
        }
        return;
      }
    }
  }, [insertImageFromFile]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        insertImageFromFile(file);
      }
    }
  }, [insertImageFromFile]);

  const handleMenuSelect = useCallback((type) => {
    if (!focusedBlockId) return;

    const targetBlockId = focusedBlockId;

    if (type === 'image') {
      const newBlocks = blocks.map(b =>
        b.id === targetBlockId ? { ...b, type: 'image', data: { url: '', caption: '' } } : b
      );
      updateBlocks(newBlocks);
      setShowMenu(false);
      setMenuFilter('');
      // 파일 선택 다이얼로그 열기 (블록 ID 유지)
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }, 150);
    } else if (type === 'divider') {
      const newBlocks = blocks.map(b =>
        b.id === targetBlockId ? { ...b, type: 'divider', data: {} } : b
      );
      updateBlocks(newBlocks);
      setShowMenu(false);
      setMenuFilter('');
      addBlockAfter(targetBlockId);
    } else {
      const newBlocks = blocks.map(b =>
        b.id === targetBlockId ? { ...b, type, data: { ...b.data, level: type === 'heading' ? 2 : undefined } } : b
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

    // 테마별 스타일
    const textStyle = isDark ? {
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
          onPaste={(e) => {
            // 텍스트 블럭에서도 이미지 붙여넣기 지원
            const items = e.clipboardData?.items;
            if (items) {
              for (const item of items) {
                if (item.type.startsWith('image/')) {
                  e.preventDefault();
                  e.stopPropagation(); // 컨테이너로 버블링 방지
                  const file = item.getAsFile();
                  if (file) {
                    insertImageFromFile(file, block.id);
                  }
                  return;
                }
              }
            }
          }}
          placeholder={index === 0 ? "여기에 내용을 작성하세요..." : ""}
          readOnly={readOnly}
          style={textStyle}
          className={`w-full bg-transparent border-0 outline-none resize-none leading-relaxed ${
            isDark
              ? 'text-gray-200 placeholder-gray-600'
              : 'text-gray-800 placeholder-gray-400 text-base'
          }`}
          rows={1}
          ref={(el) => {
            textareaRefs.current.set(block.id, el);
            adjustTextareaHeight(el);
          }}
        />
      );
    }

    if (block.type === 'heading') {
      const level = block.data.level || 2;
      const sizeClass = level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl';

      return (
        <div key={block.id} className="flex items-center gap-3">
          {!readOnly && (
            <select
              value={level}
              onChange={(e) => updateBlock(block.id, { level: parseInt(e.target.value) })}
              className={`bg-transparent border-0 text-xs cursor-pointer ${
                isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'
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
            style={{ fontFamily: "'Noto Serif KR', 'Crimson Pro', serif" }}
            className={`flex-1 bg-transparent border-0 outline-none font-semibold ${sizeClass} ${
              isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
      );
    }

    if (block.type === 'image') {
      return (
        <div key={block.id} className="py-3">
          {block.data.url ? (
            <div className="space-y-3 flex flex-col items-center">
              <img
                src={block.data.url}
                alt={block.data.caption || ''}
                className={`max-w-full rounded-lg shadow-sm ${
                  isDark ? 'border-2 border-white/20' : 'border-2 border-gray-300'
                }`}
              />
              {!readOnly && (
                <input
                  type="text"
                  value={block.data.caption || ''}
                  onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                  placeholder="이미지 설명 추가..."
                  className={`w-full bg-transparent border-0 outline-none text-sm text-center ${
                    isDark ? 'text-gray-500 placeholder-gray-700' : 'text-gray-500 placeholder-gray-400'
                  }`}
                />
              )}
              {readOnly && block.data.caption && (
                <p className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {block.data.caption}
                </p>
              )}
            </div>
          ) : (
            <div
              className={`group border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isUploading
                  ? isDark
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-emerald-300 bg-emerald-50'
                  : isDark
                    ? 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                    : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                // 먼저 블록 ID 설정 후 파일 선택 열기
                setFocusedBlockId(block.id);
                // 약간의 딜레이 후 파일 선택기 열기
                setTimeout(() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }, 50);
              }}
            >
              {isUploading ? (
                <div className={`flex flex-col items-center gap-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm font-medium">업로드 중...</span>
                </div>
              ) : (
                <>
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-colors ${
                    isDark
                      ? 'bg-white/5 group-hover:bg-white/10'
                      : 'bg-gray-100 group-hover:bg-gray-200'
                  }`}>
                    <svg className={`w-6 h-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    클릭, 드래그 또는 Ctrl+V로 업로드
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    최대 2MB
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
          isDark ? 'border-l-2 border-emerald-500/50' : 'border-l-2 border-emerald-400'
        }`}>
          <div className={`absolute -left-3 top-2 text-2xl font-serif ${isDark ? 'text-emerald-500/30' : 'text-emerald-400/50'}`}>"</div>
          <textarea
            value={block.data.text || ''}
            onChange={(e) => updateBlock(block.id, { text: e.target.value })}
            onKeyDown={(e) => handleKeyDown(e, block)}
            onFocus={() => setFocusedBlockId(block.id)}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (items) {
                for (const item of items) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    e.stopPropagation(); // 컨테이너로 버블링 방지
                    const file = item.getAsFile();
                    if (file) {
                      insertImageFromFile(file, block.id);
                    }
                    return;
                  }
                }
              }
            }}
            placeholder="인용문..."
            readOnly={readOnly}
            style={{ fontFamily: "'Crimson Pro', serif", fontStyle: 'italic' }}
            className={`w-full bg-transparent border-0 outline-none resize-none text-lg ${
              isDark
                ? 'text-gray-400 placeholder-gray-600'
                : 'text-gray-600 placeholder-gray-400'
            }`}
            rows={1}
            ref={(el) => {
              textareaRefs.current.set(block.id, el);
              adjustTextareaHeight(el);
            }}
          />
        </div>
      );
    }

    if (block.type === 'divider') {
      return (
        <div key={block.id} className="py-6">
          <div className={`h-px ${
            isDark
              ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
              : 'bg-gradient-to-r from-transparent via-gray-300 to-transparent'
          }`} />
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={editorRef}
      className={`relative min-h-[200px] ${isDragging ? 'ring-2 ring-emerald-500/50 ring-inset rounded-lg' : ''}`}
      style={{ overflowAnchor: 'none' }}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className={`absolute inset-0 z-30 flex items-center justify-center rounded-lg pointer-events-none ${
          isDark ? 'bg-emerald-500/10' : 'bg-emerald-50/80'
        }`}>
          <div className={`flex flex-col items-center gap-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">이미지를 놓으세요</span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            insertImageFromFile(file, focusedBlockId);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Block list */}
      <div className="space-y-4">
        {blocks.map((block, index) => (
          <div
            key={block.id}
            className={`group relative rounded-lg transition-all duration-150 px-3 py-2 -mx-3 ${
              focusedBlockId === block.id
                ? isDark ? 'bg-white/[0.02]' : 'bg-gray-50'
                : ''
            }`}
          >
            {/* Delete button */}
            {!readOnly && (
              <div className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 -left-10">
                <button
                  onClick={() => deleteBlock(block.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    isDark
                      ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
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
            isDark
              ? 'text-gray-600 hover:text-gray-400'
              : 'text-gray-400 hover:text-gray-600'
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
            className={`fixed z-50 rounded-xl shadow-2xl overflow-hidden min-w-[220px] ${
              isDark
                ? 'bg-[#1a1a1c] border border-white/10'
                : 'bg-white border border-gray-200'
            }`}
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {/* Search input */}
            <div className={`px-3 py-2 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
              <input
                ref={menuInputRef}
                type="text"
                value={menuFilter}
                onChange={(e) => setMenuFilter(e.target.value)}
                placeholder="블록 검색..."
                className={`w-full text-sm bg-transparent border-0 outline-none ${
                  isDark
                    ? 'text-gray-200 placeholder-gray-600'
                    : 'text-gray-700 placeholder-gray-400'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredBlockTypes.length > 0) {
                    e.preventDefault();
                    handleMenuSelect(filteredBlockTypes[0].type);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowMenu(false);
                    setMenuFilter('');
                  }
                }}
              />
            </div>

            {/* Block type list */}
            <div className="py-1 max-h-[280px] overflow-y-auto">
              {filteredBlockTypes.length === 0 ? (
                <div className={`px-4 py-3 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  결과 없음
                </div>
              ) : (
                filteredBlockTypes.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => handleMenuSelect(bt.type)}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                      isDark
                        ? 'hover:bg-white/5'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                      isDark
                        ? 'bg-white/5 text-gray-400'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {bt.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        {bt.label}
                      </div>
                      <div className={`text-xs truncate ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
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
 * 블록 렌더러 (읽기 전용)
 * @param {boolean} isDark - 다크 테마 여부 (테마 연동)
 */
export function BlockRenderer({ blocks = [], isDark = false }) {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  const dark = isDark;

  // 테마별 스타일
  const styles = {
    paragraph: dark
      ? 'text-gray-300 text-base leading-relaxed'
      : 'text-gray-700 text-base leading-relaxed',
    heading: dark ? 'text-white' : 'text-gray-900',
    quote: dark
      ? 'pl-4 border-l-2 border-emerald-500/50 text-gray-400 italic'
      : 'pl-4 border-l-2 border-emerald-400 text-gray-600 italic',
    caption: dark ? 'text-gray-500' : 'text-gray-500',
    divider: dark
      ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent'
      : 'bg-gradient-to-r from-transparent via-gray-300 to-transparent',
    imageBorder: dark ? 'border-2 border-white/20 shadow-sm' : 'border-2 border-gray-300 shadow-sm',
  };

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        if (block.type === 'paragraph') {
          return (
            <p
              key={block.id}
              className={`whitespace-pre-wrap ${styles.paragraph}`}
              style={{ fontFamily: "'Crimson Pro', 'Noto Serif KR', serif" }}
            >
              {block.data.text || '\u00A0'}
            </p>
          );
        }

        if (block.type === 'heading') {
          const level = block.data.level || 2;
          const sizeClass = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg';

          return (
            <h2
              key={block.id}
              className={`font-semibold ${styles.heading} ${sizeClass} mt-5 mb-2`}
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              {block.data.text}
            </h2>
          );
        }

        if (block.type === 'image') {
          return (
            <figure key={block.id} className="my-5 flex flex-col items-center">
              <img
                src={block.data.url}
                alt={block.data.caption || ''}
                className={`max-w-full rounded-lg ${styles.imageBorder}`}
              />
              {block.data.caption && (
                <figcaption className={`text-center text-sm mt-2 ${styles.caption}`}>
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
              className={`my-4 ${styles.quote}`}
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {block.data.text}
            </blockquote>
          );
        }

        if (block.type === 'divider') {
          return (
            <div key={block.id} className="py-4">
              <div className={`h-px ${styles.divider}`} />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
