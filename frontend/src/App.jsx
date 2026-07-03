import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const SmartEntry = lazy(() => import('./pages/SmartEntry'));
const RegisterLead = lazy(() => import('./pages/RegisterLead'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const AgentDashboard = lazy(() => import('./pages/agent/Dashboard'));
const ManagerDashboard = lazy(() => import('./pages/manager/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));
const WidgetDemo = lazy(() => import('./pages/WidgetDemo'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-bg">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function App() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  const customerRedirect = isAuthenticated ? (
    <Navigate to={
      user?.role === 'customer' ? '/customer' :
      user?.role === 'agent' ? '/agent' :
      user?.role === 'manager' ? '/manager' :
      user?.role === 'super_admin' ? '/admin' : '/login'
    } replace />
  ) : null;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Smart entry — replaces both /login and /register for customers */}
        <Route path="/login" element={
          isAuthenticated ? customerRedirect : <SmartEntry />
        } />

        <Route path="/register" element={
          isAuthenticated ? customerRedirect : <SmartEntry />
        } />

        <Route path="/admin-login" element={
          isAuthenticated ? (
            <Navigate to={
              user?.role === 'customer' ? '/customer' :
              user?.role === 'agent' ? '/agent' :
              user?.role === 'manager' ? '/manager' :
              user?.role === 'super_admin' ? '/admin' : '/admin-login'
            } replace />
          ) : (
            <AdminLogin />
          )
        } />

        <Route path="/customer" element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerDashboard />
          </ProtectedRoute>
        } />

        <Route path="/agent" element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AgentDashboard />
          </ProtectedRoute>
        } />

        <Route path="/manager" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/" element={
          <Navigate to={
            isAuthenticated ? (
              user?.role === 'customer' ? '/customer' :
              user?.role === 'agent' ? '/agent' :
              user?.role === 'manager' ? '/manager' :
              user?.role === 'super_admin' ? '/admin' : '/login'
            ) : '/login'
          } replace />
        } />

        <Route path="/customercare" element={<WidgetDemo />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
