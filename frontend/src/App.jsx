import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const Login = lazy(() => import('./pages/Login'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Register = lazy(() => import('./pages/Register'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const AgentDashboard = lazy(() => import('./pages/agent/Dashboard'));
const ManagerDashboard = lazy(() => import('./pages/manager/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));

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

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? (
            <Navigate to={
              user?.role === 'customer' ? '/customer' :
              user?.role === 'agent' ? '/agent' :
              user?.role === 'manager' ? '/manager' :
              user?.role === 'super_admin' ? '/admin' : '/login'
            } replace />
          ) : (
            <Login />
          )
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

        <Route path="/register" element={
          isAuthenticated ? (
            <Navigate to={
              user?.role === 'customer' ? '/customer' :
              user?.role === 'agent' ? '/agent' :
              user?.role === 'manager' ? '/manager' :
              user?.role === 'super_admin' ? '/admin' : '/register'
            } replace />
          ) : (
            <Register />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
