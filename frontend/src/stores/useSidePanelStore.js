import { create } from 'zustand';

/**
 * Side Panel Store
 *
 * 노션 스타일의 사이드 패널을 전역에서 관리합니다.
 * - 오른쪽에서 슬라이드인
 * - 다른 문서 클릭 시 내용만 교체 (무한 중첩 X)
 * - 왼쪽 메인 콘텐츠는 상호작용 가능
 */
export const useSidePanelStore = create((set, get) => ({
  // 패널 열림 상태
  isOpen: false,

  // 패널 타입: 'document' | 'column-editor' | null
  panelType: null,

  // 패널 데이터
  panelData: null,

  // 패널 열기
  openPanel: ({ type, data }) => {
    set({
      isOpen: true,
      panelType: type,
      panelData: data,
    });
  },

  // 패널 내용 교체 (이미 열려있을 때 다른 문서로 변경)
  replacePanel: ({ type, data }) => {
    set({
      panelType: type,
      panelData: data,
    });
  },

  // 패널 닫기
  closePanel: () => {
    set({
      isOpen: false,
      panelType: null,
      panelData: null,
    });
  },

  // 문서 열기 헬퍼
  openDocument: (document, documentType = 'decision-note') => {
    const { isOpen, openPanel, replacePanel } = get();
    const action = isOpen ? replacePanel : openPanel;
    action({
      type: 'document',
      data: { document, documentType },
    });
  },

  // 칼럼 에디터 열기 헬퍼
  openColumnEditor: (columnId = null, onSaved = null) => {
    const { openPanel } = get();
    openPanel({
      type: 'column-editor',
      data: { columnId, onSaved },
    });
  },
}));
