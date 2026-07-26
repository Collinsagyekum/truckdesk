import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useAuth } from './hooks/useAuth';
import type { UserRole } from './types';
import type { ReactNode } from 'react';

// Layouts
import DriverLayout from './components/layout/DriverLayout';
import OwnerLayout from './components/layout/OwnerLayout';

// Pages — Login
import LoginPage from './pages/LoginPage';

// Pages — Driver
import DriverHomePage from './pages/driver/DriverHomePage';
import LoadsListPage from './pages/driver/LoadsListPage';
import NewLoadPage from './pages/driver/NewLoadPage';
import LoadDetailPage from './pages/driver/LoadDetailPage';
import ExpensesListPage from './pages/driver/ExpensesListPage';
import NewExpensePage from './pages/driver/NewExpensePage';
import CompliancePage from './pages/driver/CompliancePage';
import FinancialDashboardPage from './pages/driver/FinancialDashboardPage';
import WhatsAppLogPage from './pages/driver/WhatsAppLogPage';

// Pages — Owner
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import FleetPage from './pages/owner/FleetPage';
import DriverDetailPage from './pages/owner/DriverDetailPage';
import OwnerCompliancePage from './pages/owner/OwnerCompliancePage';
import InvoicesPage from './pages/owner/InvoicesPage';
import ImpersonationBanner from './components/ui/ImpersonationBanner';

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-900">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-900">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (userRole !== role) {
    const redirect = userRole === 'driver' ? '/driver/home' : '/owner/dashboard';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-900">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    const redirect = role === 'owner' ? '/owner/dashboard' : '/driver/home';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ImpersonationBanner />
          <Routes>
            {/* Public */}
            <Route
              path="/login"
              element={
                <RedirectIfAuthenticated>
                  <LoginPage />
                </RedirectIfAuthenticated>
              }
            />

            {/* Driver routes */}
            <Route
              path="/driver"
              element={
                <RequireAuth>
                  <RequireRole role="driver">
                    <DriverLayout />
                  </RequireRole>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<DriverHomePage />} />
              <Route path="loads" element={<LoadsListPage />} />
              <Route path="loads/new" element={<NewLoadPage />} />
              <Route path="loads/:id" element={<LoadDetailPage />} />
              <Route path="expenses" element={<ExpensesListPage />} />
              <Route path="expenses/new" element={<NewExpensePage />} />
              <Route path="compliance" element={<CompliancePage />} />
              <Route path="financial" element={<FinancialDashboardPage />} />
              <Route path="whatsapp-log" element={<WhatsAppLogPage />} />
            </Route>

            {/* Owner routes */}
            <Route
              path="/owner"
              element={
                <RequireAuth>
                  <RequireRole role="owner">
                    <OwnerLayout />
                  </RequireRole>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<OwnerDashboardPage />} />
              <Route path="fleet" element={<FleetPage />} />
              <Route path="driver/:id" element={<DriverDetailPage />} />
              <Route path="compliance" element={<OwnerCompliancePage />} />
              <Route path="invoices" element={<InvoicesPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
