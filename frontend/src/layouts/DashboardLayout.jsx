import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useAuthContext } from '../context/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { UserX, AlertCircle } from 'lucide-react';

export const DashboardLayout = () => {
  const { isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { employeeId, loading: authLoading, error, logout, recheck } = useAuthContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  if (!clerkLoaded) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <LoadingSkeleton count={3} height="100px" style={{ maxWidth: '600px' }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

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
        <p style={{ color: 'var(--text-secondary)' }}>Connecting Odoo Employee Profile...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If there's an identity mismatch error (no Odoo employee record found for Clerk email)
  if (error || !employeeId) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-color)',
        padding: '24px'
      }}>
        <div className="glass-panel" style={{
          maxWidth: '500px',
          width: '100%',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid var(--danger-border)',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(244, 63, 94, 0.1)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            border: '1px solid var(--danger-border)'
          }}>
            <UserX size={32} />
          </div>
          
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '12px', color: '#fff' }}>
            Identity Mapping Failed
          </h2>
          
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            We couldn't link your email to an employee record in Odoo. 
            An HR manager must create an employee record with your exact login email in Odoo first.
          </p>

          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.05)',
              border: '1px solid rgba(244, 63, 94, 0.1)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.85rem',
              color: '#fda4af',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textAlign: 'left'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={recheck}>
              Retry Connection
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
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
