import { useEffect, useRef } from 'react';
import { useSidePanelStore } from '../../stores/useSidePanelStore';
import { useTheme } from '../../context/ThemeContext';
import { DocumentPanel } from '../documents/DocumentPanel';

/**
 * 노션 스타일 사이드 패널
 *
 * - 오른쪽에서 슬라이드인
 * - 테마 연동
 * - 메인 콘텐츠와 동시 상호작용 가능
 * - ESC로 닫기
 */
export function SidePanel() {
  const { isOpen, panelType, panelData, closePanel } = useSidePanelStore();
  const { isCurrentThemeDark } = useTheme();
  const panelRef = useRef(null);

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

  // 패널 외부 클릭 감지 (선택적 - 현재는 비활성화)
  // 메인 콘텐츠와 상호작용이 가능해야 하므로 외부 클릭으로 닫지 않음

  if (!isOpen) return null;

  return (
    <>
      {/* 반투명 오버레이 - 클릭해도 닫히지 않고 메인 콘텐츠 상호작용 가능 */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={closePanel}
      />

      {/* 사이드 패널 */}
      <aside
        ref={panelRef}
        className={`
          fixed top-0 right-0 h-full z-50
          w-full sm:w-[480px] lg:w-[520px] xl:w-[580px]
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
          // 데스크탑에서는 메인 콘텐츠가 축소되지 않고 패널이 위에 떠있음
        }}
      >
        {/* 패널 헤더 */}
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

        {/* 패널 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {panelType === 'document' && panelData?.document && (
            <DocumentPanel
              document={panelData.document}
              type={panelData.documentType}
            />
          )}
        </div>
      </aside>
    </>
  );
}
