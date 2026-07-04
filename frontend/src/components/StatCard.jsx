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
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginTop: '8px', color: '#fff' }}>
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
        borderRadius: '12px',
        background: `rgba(255, 255, 255, 0.02)`,
        border: '1px solid var(--panel-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        boxShadow: `0 0 15px 0 rgba(0, 0, 0, 0.1)`
      }}>
        <Icon size={24} />
      </div>
    </div>
  );
};
