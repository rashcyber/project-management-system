import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import OfflineIndicator from '../OfflineIndicator';
import { Loading } from '../common';
import ToastContainer from '../common/ToastContainer';
import GlobalSearch from '../common/GlobalSearch';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import { supabase } from '../../lib/supabase';
import { initializeOfflineDetection } from '../../lib/offline';
import { subscribeToNotificationsForEmail } from '../../lib/emailService';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  const { user, profile, loading, initialized, initialize } = useAuthStore();
  const { fetchNotifications, subscribeToNotifications } = useNotificationStore();

  // Initialize auth on mount
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  // OFFLINE: Initialize offline detection on mount
  useEffect(() => {
    const cleanup = initializeOfflineDetection();
    return cleanup;
  }, []);

  // SECURITY: Monitor for unauthorized session changes (session hijacking detection)
  // NOTE: Disabled the strict SIGNED_IN check because:
  // - Invitations are created server-side (no local session change)
  // - Password resets use recovery tokens (not new sign-in)
  // - Hijacking detection should happen at network/token level, not app level
  useEffect(() => {
    if (!initialized || !user) return;

    const currentUserId = user.id;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Log all auth events for debugging
      console.log('🔐 Auth state changed:', { event, userId: session?.user?.id });

      // Check for explicit sign-outs (user logged out) - this is normal
      if (event === 'SIGNED_OUT') {
        console.log('ℹ️ User signed out normally');
      }

      // Check for token refreshes (should keep same user)
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user?.id !== currentUserId) {
          console.warn('⚠️ Token refresh with different user ID', {
            previous: currentUserId,
            current: session?.user?.id,
          });
        }
      }

      // Note: SIGNED_IN events are expected during password resets and invitations
      // These are legitimate and should not trigger logout
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [initialized, user]);

  // Check for mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Fetch notifications and subscribe to real-time updates
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const unsubscribe = subscribeToNotifications(user.id);
      const unsubscribeEmail = subscribeToNotificationsForEmail(user.id);

      return () => {
        unsubscribe?.();
        unsubscribeEmail?.();
      };
    }
  }, [user, fetchNotifications, subscribeToNotifications]);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Show loading while initializing
  if (!initialized || loading) {
    return <Loading fullscreen text="Loading..." />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <OfflineIndicator />

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`main-wrapper ${sidebarOpen && !isMobile ? 'sidebar-open' : 'sidebar-closed'}`}
      >
        <Navbar
          onMenuClick={handleSidebarToggle}
          isDarkMode={isDarkMode}
          onThemeToggle={handleThemeToggle}
        />

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
      <GlobalSearch />
    </div>
  );
};

export default Layout;
