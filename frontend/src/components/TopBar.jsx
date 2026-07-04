import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const TopBar = ({ toggleSidebar }) => {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/employees': return 'Employee Directory';
      case '/attendance': return 'Attendance Tracker';
      case '/leaves': return 'Leaves & Time-Off';
      case '/payroll': return 'Payroll & Salary';
      case '/profile': return 'My Profile';
      default: return 'HRMS Management';
    }
  };

  return (
    <header
      className="glass-panel"
      style={{
        height: '70px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderRadius: 0,
        borderBottom: '1px solid var(--panel-border)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        background: 'rgba(10, 10, 15, 0.4)',
        position: 'sticky',
        top: 0,
        zIndex: 900,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          className="btn btn-secondary"
          onClick={toggleSidebar}
          style={{
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px'
          }}
          id="sidebar-toggle-btn"
        >
          <Menu size={20} />
          <style>{`
            #sidebar-toggle-btn {
              display: flex;
            }
            @media (min-width: 1024px) {
              #sidebar-toggle-btn {
                display: none;
              }
            }
          `}</style>
        </button>

        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', letterSpacing: '0.2px' }}>
          {getPageTitle()}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <UserButton 
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              avatarBox: 'w-9 h-9 border border-panel-border',
            }
          }}
        />
      </div>
    </header>
  );
};
