import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { 
  Users, Clock, CalendarRange, Receipt, User, LogOut,
  Play, Square, AlertCircle, Bell, ArrowRight, ChevronRight
} from 'lucide-react';

export default function DashboardPage() {
  const { role, employeeId, employeeDetails, logout } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [checkInState, setCheckInState] = useState({ checkedIn: false, record: null });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (role === 'admin') {
          const [empRes, attRes, leaveRes] = await Promise.all([
            apiClient.get('/employees'),
            apiClient.get('/attendance'),
            apiClient.get('/leaves'),
          ]);
          if (empRes.success) setEmployees(empRes.data);
          if (attRes.success) setAttendance(attRes.data);
          if (leaveRes.success) setLeaves(leaveRes.data);
        } else {
          const [attRes, leaveRes] = await Promise.all([
            apiClient.get('/attendance'),
            apiClient.get('/leaves'),
          ]);
          if (attRes.success) {
            setAttendance(attRes.data);
            const open = attRes.data.find(a => !a.checkOut);
            setCheckInState({ checkedIn: !!open, record: open || null });
          }
          if (leaveRes.success) setLeaves(leaveRes.data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [role, employeeId]);

  const handleCheckInToggle = async () => {
    try {
      const res = await apiClient.post('/attendance', { employee_id: employeeId });
      if (res.success) {
        setCheckInState(res.action === 'check_in'
          ? { checkedIn: true, record: res.data }
          : { checkedIn: false, record: null });
        const attRes = await apiClient.get('/attendance');
        if (attRes.success) setAttendance(attRes.data);
      }
    } catch (err) { setError(err.message); }
  };

  if (loading) return <LoadingSkeleton count={4} height="140px" />;

  const pendingLeaves = leaves.filter(l => l.state === 'confirm');
  const approvedLeaves = leaves.filter(l => l.state === 'validate');
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(a => a.checkIn?.startsWith(todayStr));

  /* ──────── EMPLOYEE DASHBOARD ──────── */
  if (role === 'employee') {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '8px', padding: '14px', color: '#fda4af', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} /><span>{error}</span>
          </div>
        )}

        {/* Welcome Banner with Check-in */}
        <div className="glass-panel" style={{
          padding: '32px',
          background: 'linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.01))',
          border: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Welcome Back
            </span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {employeeDetails?.name || 'Employee'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
              {checkInState.checkedIn
                ? `You are currently checked in. Keep up the great work!`
                : `You haven't checked in yet today.`}
            </p>
          </div>
          <button
            className={`btn ${checkInState.checkedIn ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleCheckInToggle}
            style={{ padding: '14px 32px', fontSize: '1rem' }}
          >
            {checkInState.checkedIn ? <Square size={18} /> : <Play size={18} />}
            <span>{checkInState.checkedIn ? 'Check Out' : 'Check In'}</span>
          </button>
        </div>

        {/* Quick-Access Cards — spec 3.2.1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { label: 'My Profile', icon: User, color: '#000000', path: '/profile', desc: 'View & edit details' },
            { label: 'Attendance', icon: Clock, color: '#000000', path: '/attendance', desc: 'Daily & weekly logs' },
            { label: 'Leave Requests', icon: CalendarRange, color: '#000000', path: '/leaves', desc: `${pendingLeaves.length} pending` },
            { label: 'Payroll', icon: Receipt, color: '#000000', path: '/payroll', desc: 'View salary details' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="glass-panel glass-panel-interactive"
                style={{ padding: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px' }}
                onClick={() => navigate(card.path)}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: '8px',
                  background: '#ffffff', border: '1px solid #000000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Icon size={22} color={card.color} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{card.label}</div>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>{card.desc}</span>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)', alignSelf: 'flex-end', marginTop: '-10px' }} />
              </div>
            );
          })}
        </div>

        {/* Recent Activity / Alerts — spec 3.2.1 */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} style={{ color: 'var(--primary)' }} /> Recent Activity & Alerts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Attendance entries */}
            {attendance.slice(0, 3).map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--panel-border)' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {a.checkIn ? new Date(a.checkIn.replace(' ', 'T') + 'Z').toLocaleDateString() : '-'}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {a.workedHours != null ? `${a.workedHours.toFixed(1)} hrs worked` : 'Open shift'}
                  </span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
            {/* Leave status alerts */}
            {leaves.slice(0, 2).map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--panel-border)' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{l.leaveType} Leave</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {l.numberOfDays} day(s) — {l.reason || 'No reason'}
                  </span>
                </div>
                <StatusBadge status={l.state} />
              </div>
            ))}
            {attendance.length === 0 && leaves.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '12px 0' }}>No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ──────── ADMIN / HR DASHBOARD — spec 3.2.2 ──────── */
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '8px', padding: '14px', color: '#fda4af', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      {/* Stat Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard title="Total Employees" value={employees.length} icon={Users} color="#000000" />
        <StatCard title="Present Today" value={todayAttendance.length} icon={Clock} color="#000000" />
        <StatCard title="Pending Leaves" value={pendingLeaves.length} icon={CalendarRange} color="#000000" />
        <StatCard title="Approved Leaves" value={approvedLeaves.length} icon={CalendarRange} color="#000000" />
      </div>

      {/* Three-column Admin Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="admin-grid">
        <style>{`
          @media (min-width: 1024px) {
            .admin-grid { grid-template-columns: 1fr 1fr 1fr; }
          }
        `}</style>

        {/* Employee Directory */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="var(--primary)" /> Employee Directory ({employees.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {employees.slice(0, 8).map(emp => (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#ffffff', border: '1px solid #000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: '#000000' }}>
                  {emp.name ? emp.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.department || 'Employee'}</div>
                </div>
              </div>
            ))}
            {employees.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No employees loaded.</p>}
          </div>
        </div>

        {/* Pending Leaves List */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarRange size={18} color="var(--primary)" /> Pending Leaves ({pendingLeaves.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {pendingLeaves.length > 0 ? pendingLeaves.slice(0, 6).map(l => (
              <div key={l.id} style={{ padding: '10px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{l.employeeName || 'Unknown'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.leaveType}</div>
                </div>
                <StatusBadge status={l.state || 'confirm'} />
              </div>
            )) : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending leave requests.</p>}
          </div>
        </div>

        {/* Today's Attendance List */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--primary)" /> Present Today ({todayAttendance.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {todayAttendance.length > 0 ? todayAttendance.slice(0, 6).map(a => (
              <div key={a.id} style={{ padding: '10px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{a.employeeName || 'Unknown'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In: {a.checkIn ? new Date(a.checkIn.replace(' ', 'T') + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}</div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Active</span>
              </div>
            )) : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No check-ins recorded today.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
