import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarRange,
  Receipt,
  User,
  LogOut,
  Sparkles
} from 'lucide-react';

export const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { role, employeeDetails, logout } = useAuthContext();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'AI Copilot', path: '/copilot', icon: Sparkles, accent: true },
    ...(role === 'admin' ? [{ name: 'Employees', path: '/employees', icon: Users }] : []),
    { name: 'Attendance', path: '/attendance', icon: Clock },
    { name: 'Leaves', path: '/leaves', icon: CalendarRange },
    { name: 'Payroll', path: '/payroll', icon: Receipt },
    { name: 'My Profile', path: '/profile', icon: User },
  ];

  return (
    <>
      {/* Mobile Sidebar overlay */}
      {isOpen && (
        <div 
          className="sidebar-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 998
          }}
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`glass-panel sidebar-nav ${isOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          borderRadius: 0,
          borderRight: '1px solid var(--panel-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <style>{`
          .sidebar-container {
            width: var(--sidebar-width);
            height: 100vh;
            background: #ffffff;
            border-right: 2px solid #000000;
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; left: 0; z-index: 50;
            transition: transform 0.3s ease;
          }
          @media (min-width: 1024px) {
            .sidebar-container {
              transform: translateX(0) !important;
            }
          }
          .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 8px;
            color: #404040;
            font-weight: 500;
            transition: all 0.2s;
          }
          .nav-item:hover {
            color: #000000;
            background: #f5f5f5;
            text-decoration: none;
          }
          .nav-item.active {
            color: #ffffff;
            background: #000000;
            font-weight: 700;
            box-shadow: 3px 3px 0px 0px #000000;
          }
        `}</style>

        {/* Logo/Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            color: '#fff'
          }}>
            Ω
          </div>
          <span style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '0.5px', color: '#000' }}>Odoo HRMS</span>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
              >
                <Icon size={20} color={item.accent ? '#000000' : undefined} />
                <span>{item.name}</span>
                {item.accent && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.5px',
                    padding: '2px 6px', borderRadius: '4px', background: '#000000', color: '#ffffff' }}>AI</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--panel-border)' }}>
          {employeeDetails && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#232329',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--panel-border)'
              }}>
                {employeeDetails.profilePicture ? (
                  <img 
                    src={employeeDetails.profilePicture.startsWith('data:') ? employeeDetails.profilePicture : `data:image/png;base64,${employeeDetails.profilePicture}`} 
                    alt={employeeDetails.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={20} className="text-secondary" />
                )}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {employeeDetails.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {role}
                </div>
              </div>
            </div>
          )}

          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'flex-start', background: 'rgba(244, 63, 94, 0.05)', borderColor: 'rgba(244, 63, 94, 0.1)', color: '#fda4af' }}
            onClick={logout}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
