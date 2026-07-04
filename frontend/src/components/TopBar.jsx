import React from 'react';
import { Menu, LogOut, User as UserIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';

export const TopBar = ({ toggleSidebar }) => {
  const location = useLocation();
  const { employeeDetails, email, logout } = useAuthContext();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/copilot': return 'AI Copilot';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--primary-gradient)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff',
            fontWeight: 'bold', fontSize: '0.9rem'
          }}>
            {(employeeDetails?.name || email || 'U')[0].toUpperCase()}
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            title="Sign Out"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
