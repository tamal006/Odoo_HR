import React from 'react';

const STATUS_THEMES = {
  // Leave States
  draft: { label: 'Draft', bg: '#ffffff', color: '#000000', border: '#000000' },
  confirm: { label: 'Pending', bg: '#ffffff', color: '#000000', border: '#000000' },
  validate1: { label: 'First Approval', bg: '#ffffff', color: '#000000', border: '#000000' },
  validate: { label: 'Approved', bg: '#000000', color: '#ffffff', border: '#000000' },
  refuse: { label: 'Rejected', bg: '#ffffff', color: '#737373', border: '#000000' },

  // Attendance States
  'Checked In': { label: 'Working', bg: '#000000', color: '#ffffff', border: '#000000' },
  'Present': { label: 'Present', bg: '#000000', color: '#ffffff', border: '#000000' },
  'Absent': { label: 'Absent', bg: '#ffffff', color: '#000000', border: '#000000' },

  // Contracts
  open: { label: 'Active', bg: '#000000', color: '#ffffff', border: '#000000' },
  closed: { label: 'Closed', bg: '#ffffff', color: '#737373', border: '#000000' },
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
