import { useEffect, useRef, useState, useCallback } from 'react';
import { useSidePanelStore } from '../../stores/useSidePanelStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useTheme } from '../../context/ThemeContext';
import { DocumentPanel } from '../documents/DocumentPanel';
import { ColumnEditorPanel } from '../editor/ColumnEditorPanel';
import { NoteEditorPanel } from '../editor/NoteEditorPanel';

/**
 * 노션 스타일 사이드 패널
 *
 * - 오른쪽에서 슬라이드인
 * - 테마 연동
 * - 메인 콘텐츠와 동시 상호작용 가능
 * - ESC로 닫기
 * - 드래그로 너비 조절
 */
export function SidePanel() {
  const { isOpen, panelType, panelData, closePanel } = useSidePanelStore();
  const { sidePanelWidth, setSidePanelWidth } = useLayoutStore();
  const { isCurrentThemeDark } = useTheme();
  const panelRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closePanel]);

  // 리사이즈 핸들러
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidePanelWidth;

    const handleMouseMove = (e) => {
      const delta = startX - e.clientX;
      const newWidth = startWidth + delta;
      setSidePanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidePanelWidth, setSidePanelWidth]);

  if (!isOpen) return null;

  return (
    <>
      {/* 반투명 오버레이 - 모바일에서만 클릭으로 닫기 */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={closePanel}
      />

      {/* 사이드 패널 */}
      <aside
        ref={panelRef}
        className={`
          fixed top-16 right-0 h-[calc(100vh-4rem)] z-30
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
          shadow-2xl
          ${isCurrentThemeDark
            ? 'bg-[#18181b] border-l border-white/10'
            : 'bg-white border-l border-gray-200'
          }
        `}
        style={{
          width: `${sidePanelWidth}px`,
          maxWidth: '90vw',
        }}
      >
        {/* 리사이즈 핸들 */}
        <div
          className={`
            absolute left-0 top-0 h-full w-1 cursor-ew-resize z-10
            group transition-colors
            ${isResizing
              ? isCurrentThemeDark ? 'bg-emerald-500' : 'bg-emerald-400'
              : 'hover:bg-emerald-500/50'
            }
          `}
          onMouseDown={handleMouseDown}
        >
          {/* 핸들 시각적 표시 */}
          <div
            className={`
              absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
              w-1 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
              ${isCurrentThemeDark ? 'bg-white/30' : 'bg-gray-400'}
            `}
          />
        </div>

        {/* 에디터 패널과 custom 패널은 자체 헤더를 가짐 */}
        {panelType !== 'column-editor' && panelType !== 'note-editor' && panelType !== 'custom' && (
          <header
            className={`
              flex items-center justify-between px-5 py-4
              border-b shrink-0
              ${isCurrentThemeDark ? 'border-white/10' : 'border-gray-200'}
            `}
          >
            <div className="flex items-center gap-3">
              {/* 패널 타입 표시 */}
              {panelType === 'document' && panelData?.documentType && (
                <span
                  className={`
                    px-2.5 py-1 text-xs font-medium rounded-md
                    ${panelData.documentType === 'column'
                      ? isCurrentThemeDark
                        ? 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20'
                        : 'bg-purple-50 text-purple-600 ring-1 ring-purple-200'
                      : isCurrentThemeDark
                        ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                        : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                    }
                  `}
                >
                  {panelData.documentType === 'column' ? '칼럼' : '의사결정서'}
                </span>
              )}
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={closePanel}
              className={`
                p-2 rounded-lg transition-colors
                ${isCurrentThemeDark
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }
              `}
              title="닫기 (ESC)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
        )}

        {/* 패널 컨텐츠 */}
        <div className={`flex-1 min-h-0 ${(panelType === 'column-editor' || panelType === 'note-editor') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {panelType === 'document' && panelData?.document && (
            <DocumentPanel
              document={panelData.document}
              type={panelData.documentType}
              onSaved={panelData?.onSaved}
            />
          )}
          {panelType === 'column-editor' && (
            <ColumnEditorPanel
              columnId={panelData?.columnId}
              onSaved={panelData?.onSaved}
            />
          )}
          {panelType === 'note-editor' && panelData?.note && (
            <NoteEditorPanel
              note={panelData.note}
              onSaved={panelData?.onSaved}
            />
          )}
          {panelType === 'custom' && panelData?.render && (
            <div className="h-full overflow-y-auto">
              {panelData.render()}
            </div>
          )}
        </div>
      </aside>

      {/* 리사이즈 중 커서 스타일 */}
      {isResizing && (
        <style>{`
          * { cursor: ew-resize !important; user-select: none !important; }
        `}</style>
      )}
    </>
  );
}
