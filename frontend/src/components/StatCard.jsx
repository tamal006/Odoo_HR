import React from 'react';

export const StatCard = ({ title, value, icon: Icon, color = 'var(--primary)', trend, style }) => {
  return (
    <div 
      className="glass-panel glass-panel-interactive animate-fade-in"
      style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
        minWidth: '240px',
        ...style
      }}
    >
      <div>
        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginTop: '8px', color: 'var(--text-primary)' }}>
          {value}
        </h2>
        {trend && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
            <span style={{ color: trend.type === 'positive' ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
              {trend.value}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {trend.label}
            </span>
          </div>
        )}
      </div>

      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '8px',
        background: '#ffffff',
        border: '1px solid #000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#000000',
        boxShadow: '2px 2px 0px 0px #000000'
      }}>
        <Icon size={24} />
      </div>
    </div>
  );
};
