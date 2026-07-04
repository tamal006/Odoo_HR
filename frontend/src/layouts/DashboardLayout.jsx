import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';

export const DashboardLayout = () => {
  const { isSignedIn, loading: authLoading } = useAuthContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '40px' }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.05)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: 'var(--text-secondary)' }}>Connecting to Odoo...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
      className="main-viewport"
      >
        <style>{`
          .main-viewport {
            padding-left: 0;
          }
          @media (min-width: 1024px) {
            .main-viewport {
              padding-left: var(--sidebar-width);
            }
          }
        `}</style>
        <TopBar toggleSidebar={toggleSidebar} />
        
        <main style={{ flex: 1, padding: '32px 24px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
