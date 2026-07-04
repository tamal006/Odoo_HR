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
        className={`glass-panel sidebar-container sidebar-nav ${isOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'var(--sidebar-width)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          borderRadius: 0,
          borderRight: '2px solid #000000',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <style>{`
          .sidebar-container, .sidebar-nav {
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
            .sidebar-container, .sidebar-nav {
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
            color: #ffffff !important;
            background: #000000;
            font-weight: 700;
            box-shadow: 3px 3px 0px 0px #000000;
          }
          .nav-item.active span, .nav-item.active svg {
            color: #ffffff !important;
          }
        `}</style>

        {/* Logo/Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #000000', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            color: '#ffffff'
          }}>
            Ω
          </div>
          <span style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '0.5px', color: '#000000' }}>Odoo HRMS</span>
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
                {({ isActive }) => (
                  <>
                    <Icon size={20} color={isActive ? '#ffffff' : (item.accent ? '#000000' : '#404040')} />
                    <span style={{ color: isActive ? '#ffffff' : '#000000' }}>{item.name}</span>
                    {item.accent && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.5px',
                        padding: '2px 6px', borderRadius: '4px', background: isActive ? '#ffffff' : '#000000', color: isActive ? '#000000' : '#ffffff' }}>AI</span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid #000000' }}>
          {employeeDetails && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #000000'
              }}>
                {employeeDetails.profilePicture ? (
                  <img 
                    src={employeeDetails.profilePicture.startsWith('data:') ? employeeDetails.profilePicture : `data:image/png;base64,${employeeDetails.profilePicture}`} 
                    alt={employeeDetails.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={20} color="#000000" />
                )}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: '#000000' }}>
                  {employeeDetails.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#404040', textTransform: 'capitalize' }}>
                  {role}
                </div>
              </div>
            </div>
          )}

          <button
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'flex-start', background: '#ffffff', border: '1px solid #000000', color: '#000000', boxShadow: '2px 2px 0px 0px #000000' }}
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
