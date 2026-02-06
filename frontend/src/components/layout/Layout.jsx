import { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SidePanel } from './SidePanel';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSidePanelStore } from '../../stores/useSidePanelStore';

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { connect, isConnected } = useWebSocket();
  const { isOpen: sidePanelOpen } = useSidePanelStore();

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
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main
          className={`
            flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in
            transition-all duration-300
            ${sidePanelOpen ? 'lg:mr-[520px] xl:mr-[580px]' : ''}
          `}
        >
          {children}
        </main>

        {/* 노션 스타일 사이드 패널 */}
        <SidePanel />
      </div>
    </div>
  );
}
