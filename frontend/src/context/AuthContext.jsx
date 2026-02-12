import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (authService.isAuthenticated()) {
      // 1) 캐시된 유저 데이터로 즉시 복원 (로딩 없이 바로 표시)
      const cachedUser = authService.getCachedUser();
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }

      // 2) 백그라운드에서 최신 유저 정보 확인
      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
        // Push 알림 구독 (이미 권한 있으면 즉시, 없으면 무시)
        initPushIfGranted();
      } catch (error) {
        // 401/403 인증 에러만 로그아웃 처리
        // 네트워크 에러나 서버 에러는 캐시된 데이터 유지
        if (error.response?.status === 401 || error.response?.status === 403) {
          authService.logout();
          setUser(null);
        }
      }
    }
    setLoading(false);
  };

  // Push 알림: 이미 권한이 있으면 자동 구독 (권한 팝업 안 띄움)
  const initPushIfGranted = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      notificationService.initPushNotifications().catch(() => {});
    }
  };

  const login = async (email, password) => {
    const userData = await authService.login(email, password);
    setUser(userData);
    window.dispatchEvent(new Event('auth-change'));
    // 첫 로그인 시 알림 권한 요청 + 구독
    notificationService.initPushNotifications().catch(() => {});
    return userData;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const isManagerOrAdmin = () => {
    return user?.role === 'manager' || user?.role === 'admin';
  };

  const isManager = () => {
    return user?.role === 'manager';
  };

  const canWrite = () => {
    return user?.role && user.role !== 'viewer';
  };

  const isViewer = () => {
    return user?.role === 'viewer';
  };

  const toggleAdminMode = () => {
    if (isManagerOrAdmin()) {
      setAdminMode(!adminMode);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setAdminMode(false);
    window.dispatchEvent(new Event('auth-change'));
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout: handleLogout,
      isManagerOrAdmin,
      isManager,
      canWrite,
      isViewer,
      isAuthenticated: !!user,
      adminMode,
      toggleAdminMode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
