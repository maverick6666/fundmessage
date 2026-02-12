import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SidePanel } from './SidePanel';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSidePanelStore } from '../../stores/useSidePanelStore';
import { useLayoutStore } from '../../stores/useLayoutStore';

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { connect, isConnected } = useWebSocket();
  const { isOpen: sidePanelOpen } = useSidePanelStore();
  const { sidebarCollapsed, sidePanelWidth } = useLayoutStore();

  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      connect();
    }
  }, [isAuthenticated, isConnected, connect]);

  return (
    <div
      className="h-screen flex flex-col transition-colors duration-200"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
        />

        <main
          className="flex-1 overflow-y-auto overflow-x-auto p-4 lg:p-6 animate-fade-in transition-all duration-300"
          style={{
            // 사이드 패널이 열렸을 때 margin-right 적용
            marginRight: sidePanelOpen ? `${sidePanelWidth}px` : 0,
            minWidth: '320px',
          }}
        >
          <ErrorBoundary key={location.pathname}>
            {children}
          </ErrorBoundary>
        </main>

        {/* 노션 스타일 사이드 패널 */}
        <SidePanel />
      </div>
    </div>
  );
}
