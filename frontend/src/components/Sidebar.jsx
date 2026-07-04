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
  LogOut 
} from 'lucide-react';

export const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { role, employeeDetails, logout } = useAuthContext();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
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
          width: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          borderRadius: 0,
          borderRight: '1px solid var(--panel-border)',
          borderLeft: 'none',
          borderTop: 'none',
          borderBottom: 'none',
          background: 'rgba(10, 10, 15, 0.6)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <style>{`
          .sidebar-nav {
            transform: translateX(-100%);
          }
          @media (min-width: 1024px) {
            .sidebar-nav {
              transform: translateX(0) !important;
            }
          }
          .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            color: var(--text-secondary);
            border-radius: 8px;
            margin: 4px 12px;
            font-weight: 500;
            transition: all 0.2s;
          }
          .nav-item:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.04);
            text-decoration: none;
          }
          .nav-item.active {
            color: #fff;
            background: var(--primary-gradient);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
          }
        `}</style>

        {/* Logo/Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            color: '#fff'
          }}>
            Ω
          </div>
          <span style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '0.5px' }}>Odoo HRMS</span>
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
                <Icon size={20} />
                <span>{item.name}</span>
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
