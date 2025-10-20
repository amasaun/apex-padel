import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Auth from './pages/Auth';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Invites from './pages/Invites';
import AdminUsers from './pages/AdminUsers';
import AdminLocations from './pages/AdminLocations';
import ProtectedRoute from './components/ProtectedRoute';
import Footer from './components/Footer';

const queryClient = new QueryClient();

function AuthListener() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔐 AuthListener mounted');
    console.log('📍 Current URL:', window.location.href);
    console.log('🔗 Hash:', window.location.hash);
    console.log('🛣️  Pathname:', window.location.pathname);

    // Check if there's a recovery token in the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (accessToken && type === 'recovery') {
      console.log('✅ Found recovery token in URL');
      console.log('🔍 Access token:', accessToken.substring(0, 20) + '...');
      console.log('🔍 Type:', type);

      // If we're not already on reset-password page, navigate there
      if (window.location.pathname !== '/reset-password') {
        console.log('🔄 Navigating to /reset-password');
        navigate('/reset-password', { replace: true });
      } else {
        console.log('✓ Already on /reset-password page');
      }
    }

    // Listen for auth state changes, specifically PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth event:', event);
      console.log('👤 Session:', session ? 'exists' : 'null');
      console.log('🛣️  Current pathname:', window.location.pathname);

      // If this is a password recovery event, navigate to reset password page
      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔄 PASSWORD_RECOVERY event detected');
        if (window.location.pathname !== '/reset-password') {
          console.log('🔄 Navigating to /reset-password');
          navigate('/reset-password', { replace: true });
        }
      }
    });

    return () => {
      console.log('🔐 AuthListener unmounting');
      subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthListener />
        <div className="min-h-screen bg-white flex flex-col">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/matches" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/matches"
                element={
                  <ProtectedRoute>
                    <Matches />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/matches/:id"
                element={<MatchDetail />}
              />
              <Route
                path="/profile/:id"
                element={<Profile />}
              />
              <Route
                path="/profile/:id/edit"
                element={
                  <ProtectedRoute>
                    <EditProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invites"
                element={
                  <ProtectedRoute>
                    <Invites />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/locations"
                element={
                  <ProtectedRoute>
                    <AdminLocations />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
