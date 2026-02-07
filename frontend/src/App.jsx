import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Positions } from './pages/Positions';
import { PositionDetail } from './pages/PositionDetail';
import { Requests } from './pages/Requests';
import { Discussion } from './pages/Discussion';
import { Discussions } from './pages/Discussions';
import { Stats } from './pages/Stats';
import { TeamManagement } from './pages/TeamManagement';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
// StockSearch removed - redirects to /positions
import { Reports } from './pages/Reports';
import { ColumnEditor } from './pages/ColumnEditor';
import { NewsDesk } from './pages/NewsDesk';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function ManagerRoute({ children }) {
  const { isManagerOrAdmin } = useAuth();

  if (!isManagerOrAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">접근 권한이 필요합니다</h2>
        <p className="text-gray-500 mb-6">이 페이지는 팀장 또는 관리자만 접근할 수 있습니다.</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          대시보드로 이동
        </a>
      </div>
    );
  }

  return children;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />}
      />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/stock-search"
        element={<Navigate to="/positions" replace />}
      />

      <Route
        path="/positions"
        element={
          <PrivateRoute>
            <Positions />
          </PrivateRoute>
        }
      />

      <Route
        path="/positions/:id"
        element={
          <PrivateRoute>
            <PositionDetail />
          </PrivateRoute>
        }
      />

      <Route
        path="/requests"
        element={
          <PrivateRoute>
            <Requests />
          </PrivateRoute>
        }
      />

      <Route
        path="/my-requests"
        element={<Navigate to="/requests" replace />}
      />

      <Route
        path="/discussions"
        element={
          <PrivateRoute>
            <Discussions />
          </PrivateRoute>
        }
      />

      <Route
        path="/discussions/:id"
        element={
          <PrivateRoute>
            <Discussion />
          </PrivateRoute>
        }
      />

      <Route
        path="/stats"
        element={
          <PrivateRoute>
            <Stats />
          </PrivateRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <PrivateRoute>
            <Reports />
          </PrivateRoute>
        }
      />

      <Route
        path="/newsdesk"
        element={
          <PrivateRoute>
            <NewsDesk />
          </PrivateRoute>
        }
      />

      <Route
        path="/columns/new"
        element={
          <PrivateRoute>
            <ColumnEditor />
          </PrivateRoute>
        }
      />

      <Route
        path="/columns/:id/edit"
        element={
          <PrivateRoute>
            <ColumnEditor />
          </PrivateRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <PrivateRoute>
            <Notifications />
          </PrivateRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />

      <Route
        path="/team"
        element={
          <PrivateRoute>
            <ManagerRoute>
              <TeamManagement />
            </ManagerRoute>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
