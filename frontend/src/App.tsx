import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import GamePanels from './pages/GamePanels';
import './App.css';

// Lazy load admin code only when needed
const AdminAuthProvider = lazy(() =>
  import('./admin/contexts/AdminAuthContext').then(module => ({
    default: module.AdminAuthProvider
  }))
);
const AdminApp = lazy(() => import('./admin/AdminApp'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60 * 1000, // 2 minutes - default for most queries
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time (renamed from cacheTime)
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Admin routes - lazy loaded */}
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<div>Chargement...</div>}>
                <AdminAuthProvider>
                  <AdminApp />
                </AdminAuthProvider>
              </Suspense>
            }
          />

          {/* Main game routes */}
          <Route
            path="*"
            element={
              <AuthProvider>
                <GamePanels />
              </AuthProvider>
            }
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
