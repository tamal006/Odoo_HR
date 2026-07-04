import React from 'react';

export const LoadingSkeleton = ({ count = 3, height = '80px', style }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', ...style }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="glass-panel"
          style={{
            height,
            width: '100%',
            animation: 'pulse 1.5s infinite ease-in-out',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--panel-border)',
            borderRadius: '12px'
          }}
        />
      ))}
    </div>
  );
};
