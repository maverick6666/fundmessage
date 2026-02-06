import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Layout Store
 *
 * 레이아웃 관련 상태를 전역에서 관리합니다.
 * - 사이드바 접힘/펼침 상태 (localStorage 저장)
 * - 사이드 패널 너비 (localStorage 저장)
 */
export const useLayoutStore = create(
  persist(
    (set, get) => ({
      // 사이드바 접힘 상태 (데스크탑용)
      sidebarCollapsed: false,

      // 사이드 패널 너비 (px)
      sidePanelWidth: 520,

      // 사이드바 토글
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      // 사이드바 접기
      collapseSidebar: () => {
        set({ sidebarCollapsed: true });
      },

      // 사이드바 펼치기
      expandSidebar: () => {
        set({ sidebarCollapsed: false });
      },

      // 사이드 패널 너비 설정
      setSidePanelWidth: (width) => {
        // 최소 320px, 최대 800px
        const clampedWidth = Math.min(Math.max(width, 320), 800);
        set({ sidePanelWidth: clampedWidth });
      },
    }),
    {
      name: 'fund-layout-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidePanelWidth: state.sidePanelWidth,
      }),
    }
  )
);
