import React from 'react';

const STATUS_THEMES = {
  // Leave States
  draft: { label: 'Draft', bg: 'rgba(255, 255, 255, 0.05)', color: '#d1d5db', border: 'rgba(255, 255, 255, 0.1)' },
  confirm: { label: 'Pending', bg: 'rgba(245, 158, 11, 0.1)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.2)' },
  validate1: { label: 'First Approval', bg: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: 'rgba(99, 102, 241, 0.2)' },
  validate: { label: 'Approved', bg: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.2)' },
  refuse: { label: 'Rejected', bg: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', border: 'rgba(244, 63, 94, 0.2)' },

  // Attendance States
  'Checked In': { label: 'Working', bg: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: 'rgba(99, 102, 241, 0.25)' },
  'Present': { label: 'Present', bg: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.2)' },
  'Absent': { label: 'Absent', bg: 'rgba(244, 63, 94, 0.1)', color: '#fda4af', border: 'rgba(244, 63, 94, 0.2)' },

  // Contracts
  open: { label: 'Active', bg: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.2)' },
  closed: { label: 'Closed', bg: 'rgba(255, 255, 255, 0.05)', color: '#9ca3af', border: 'rgba(255, 255, 255, 0.1)' },
};

export const StatusBadge = ({ status }) => {
  const normalized = status?.toLowerCase() === 'pending' ? 'confirm' : (status || 'draft');
  const theme = STATUS_THEMES[normalized] || STATUS_THEMES[status] || {
    label: status,
    bg: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    border: 'rgba(255, 255, 255, 0.1)'
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        backgroundColor: theme.bg,
        color: theme.color,
        border: `1px solid ${theme.border}`,
        letterSpacing: '0.3px',
        textTransform: 'uppercase'
      }}
    >
      {theme.label}
    </span>
  );
};
