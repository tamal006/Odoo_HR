import React, { useEffect, useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import {
  CalendarRange, Plus, X, AlertCircle, Check, XCircle,
  ChevronLeft, ChevronRight, MessageSquare, Clock
} from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function LeavesPage() {
  const { role, employeeId } = useAuthContext();
  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    leaveType: '',
    dateFrom: '',
    dateTo: '',
    reason: '',
  });

  // Calendar picker state
  const now = new Date();
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(now.getMonth());
  const [pickTarget, setPickTarget] = useState(null); // 'dateFrom' | 'dateTo' | null

  const fetchData = async () => {
    try {
      setLoading(true);
      const [lRes, tRes] = await Promise.all([
        apiClient.get('/leaves'),
        apiClient.get('/leaves/types').catch(() => ({ success: false })),
      ]);
      if (lRes.success) setLeaves(lRes.data);
      if (tRes.success) setLeaveTypes(tRes.data);
    } catch (err) { setError('Failed to load leave data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [role, employeeId]);

  const handleSubmit = async () => {
    if (!formData.dateFrom || !formData.dateTo) {
      setError('Please select both start and end dates.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const res = await apiClient.post('/leaves', {
        employee_id: employeeId,
        leave_type: formData.leaveType || undefined,
        date_from: formData.dateFrom,
        date_to: formData.dateTo,
        reason: formData.reason,
      });
      if (res.success) {
        setShowForm(false);
        setFormData({ leaveType: '', dateFrom: '', dateTo: '', reason: '' });
        fetchData();
      }
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleAction = async (leaveId, action) => {
    try {
      setError(null);
      const res = await apiClient.patch(`/leaves/${leaveId}`, { action });
      if (res.success) fetchData();
    } catch (err) { setError(err.message); }
  };

  // Calendar date picker helpers
  const getMonthDays = (year, month) => ({
    firstDay: new Date(year, month, 1).getDay(),
    daysInMonth: new Date(year, month + 1, 0).getDate(),
  });

  const selectDate = (day) => {
    const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setFormData(prev => ({ ...prev, [pickTarget]: dateStr }));
    // If selecting dateFrom and dateTo is empty or before dateFrom, auto-set
    if (pickTarget === 'dateFrom' && (!formData.dateTo || dateStr > formData.dateTo)) {
      setFormData(prev => ({ ...prev, dateFrom: dateStr, dateTo: dateStr }));
    }
    setPickTarget(null);
  };

  const prevMonth = () => {
    if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11); }
    else setPickerMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0); }
    else setPickerMonth(m => m + 1);
  };

  const pendingLeaves = leaves.filter(l => l.state === 'confirm');
  const processedLeaves = leaves.filter(l => l.state !== 'confirm');

  if (loading) return <LoadingSkeleton count={4} height="80px" />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>Leave & Time-Off</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {role === 'admin' ? 'Review and approve employee leave requests.' : 'Apply for leave and track your request status.'}
          </p>
        </div>
        {role === 'employee' && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ padding: '10px 24px' }}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            <span>{showForm ? 'Cancel' : 'Apply for Leave'}</span>
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '8px', padding: '14px', color: '#fda4af', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      {/* ─── Leave Application Form (Employee) — spec 3.5 ─── */}
      {showForm && role === 'employee' && (
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>New Leave Request</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            {/* Leave Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Leave Type</label>
              <select
                value={formData.leaveType}
                onChange={e => setFormData(p => ({ ...p, leaveType: e.target.value }))}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)',
                  background: '#19191f', color: '#fff', fontSize: '0.9rem', outline: 'none'
                }}
              >
                <option value="">Select type...</option>
                {leaveTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Date From — Calendar Picker */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Start Date</label>
              <button
                onClick={() => setPickTarget(pickTarget === 'dateFrom' ? null : 'dateFrom')}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)',
                  background: '#19191f', color: formData.dateFrom ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <span>{formData.dateFrom || 'Pick start date...'}</span>
                <CalendarRange size={16} />
              </button>
              {pickTarget === 'dateFrom' && <CalendarPicker year={pickerYear} month={pickerMonth} selected={formData.dateFrom} onSelect={selectDate} prevMonth={prevMonth} nextMonth={nextMonth} />}
            </div>

            {/* Date To — Calendar Picker */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>End Date</label>
              <button
                onClick={() => setPickTarget(pickTarget === 'dateTo' ? null : 'dateTo')}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)',
                  background: '#19191f', color: formData.dateTo ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.9rem', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <span>{formData.dateTo || 'Pick end date...'}</span>
                <CalendarRange size={16} />
              </button>
              {pickTarget === 'dateTo' && <CalendarPicker year={pickerYear} month={pickerMonth} selected={formData.dateTo} onSelect={selectDate} prevMonth={prevMonth} nextMonth={nextMonth} minDate={formData.dateFrom} />}
            </div>
          </div>

          {/* Reason / Remarks */}
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Remarks</label>
            <textarea
              value={formData.reason}
              onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
              rows={3}
              placeholder="Add a reason or description..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)',
                background: '#19191f', color: '#fff', fontSize: '0.9rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ padding: '12px 32px' }}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Pending Leaves (Admin approval) — spec 3.5 ─── */}
      {role === 'admin' && pendingLeaves.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#f59e0b' }} /> Pending Approvals
            <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d', fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', marginLeft: '8px' }}>{pendingLeaves.length}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingLeaves.map(l => (
              <LeaveCard key={l.id} leave={l} role={role} onAction={handleAction} />
            ))}
          </div>
        </div>
      )}

      {/* ─── All Leaves List ─── */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
          {role === 'admin' ? 'All Leave Requests' : 'My Leave History'}
        </h3>
        {(role === 'admin' ? processedLeaves : leaves).length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No leave requests found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(role === 'admin' ? processedLeaves : leaves).map(l => (
              <LeaveCard key={l.id} leave={l} role={role} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────── LeaveCard Component ──────── */
function LeaveCard({ leave, role, onAction }) {
  const stateMap = {
    confirm: 'Pending',
    validate: 'Approved',
    refuse: 'Rejected',
    draft: 'Draft',
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
      padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)',
      transition: 'background 0.15s'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {role === 'admin' && <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{leave.employeeName}</span>}
          <StatusBadge status={leave.state} />
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {leave.leaveType || 'Time Off'} — {leave.numberOfDays} day(s)
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {leave.dateFrom} → {leave.dateTo}
        </span>
        {leave.reason && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <MessageSquare size={12} /> {leave.reason}
          </span>
        )}
      </div>

      {role === 'admin' && leave.state === 'confirm' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={() => onAction(leave.id, 'approve')} style={{ padding: '8px 18px', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Check size={15} /> Approve
          </button>
          <button className="btn" onClick={() => onAction(leave.id, 'reject')} style={{ padding: '8px 18px', background: 'rgba(244,63,94,0.15)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.3)' }}>
            <XCircle size={15} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────── Calendar Picker Dropdown ──────── */
function CalendarPicker({ year, month, selected, onSelect, prevMonth, nextMonth, minDate }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: '4px',
      background: '#1a1a22', border: '1px solid var(--panel-border)', borderRadius: '12px',
      padding: '16px', width: '300px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}><ChevronLeft size={16} /></button>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{monthLabel}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}><ChevronRight size={16} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', padding: '6px 0' }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dateStr === selected;
          const isDisabled = minDate && dateStr < minDate;

          return (
            <button
              key={day}
              onClick={() => !isDisabled && onSelect(day)}
              disabled={isDisabled}
              style={{
                padding: '8px 4px', borderRadius: '6px', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: isSelected ? 'var(--primary)' : 'transparent',
                color: isDisabled ? 'rgba(255,255,255,0.15)' : isSelected ? '#fff' : 'var(--text-primary)',
                fontWeight: isSelected ? 700 : 400, fontSize: '0.8rem',
                transition: 'background 0.1s'
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
