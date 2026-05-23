import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import { usePipelineStream } from './hooks/usePipelineStream';
import Sidebar from './components/shared/Sidebar';
import ProtectedRoute from './components/shared/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import PredictionPage from './pages/PredictionPage';
import DashboardPage from './pages/DashboardPage';
import PoisonLogPage from './pages/PoisonLogPage';
import AdminPage from './pages/AdminPage';
import UsersPage from './pages/UsersPage';
import PortfolioPage from './pages/PortfolioPage';
import UserInvestmentsPage from './pages/UserInvestmentsPage';

function AppContent() {
  const { poisonFlashActive } = useAppStore();
  const { isAuthenticated, isAdmin } = useAuthStore();

  // Connect to backend SSE for real-time pipeline events
  usePipelineStream();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className={`h-screen w-screen flex bg-bg overflow-hidden ${poisonFlashActive ? 'poison-flash' : ''}`}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="ml-[60px] flex-1 h-screen overflow-hidden">
        <Routes>
          <Route path="/" element={
            <ProtectedRoute><PredictionPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/poison" element={
            <ProtectedRoute requireAdmin>
              <PoisonLogPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute requireAdmin>
              <UsersPage />
            </ProtectedRoute>
          } />
          <Route path="/portfolio" element={
            <ProtectedRoute>
              <PortfolioPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/investments" element={
            <ProtectedRoute requireAdmin>
              <UserInvestmentsPage />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Admin-only: Simulate Poison Event button */}
      {isAdmin && (
        <button
          onClick={useAppStore.getState().triggerPoisonFlash}
          className="fixed bottom-4 right-4 z-50 px-3 py-1.5 bg-bg-panel border border-accent-danger/30 text-accent-danger font-mono text-[10px] hover:bg-accent-danger/10 hover:border-accent-danger transition-colors"
        >
          SIMULATE POISON EVENT
        </button>
      )}
    </div>
  );
}

function App() {
  const { restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
