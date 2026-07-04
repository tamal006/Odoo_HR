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
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))',
          border: '1px solid rgba(99,102,241,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>
              Welcome, {employeeDetails?.name || 'Employee'}!
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
            { label: 'My Profile', icon: User, color: '#6366f1', path: '/profile', desc: 'View & edit details' },
            { label: 'Attendance', icon: Clock, color: '#10b981', path: '/attendance', desc: 'Daily & weekly logs' },
            { label: 'Leave Requests', icon: CalendarRange, color: '#f59e0b', path: '/leaves', desc: `${pendingLeaves.length} pending` },
            { label: 'Payroll', icon: Receipt, color: '#ec4899', path: '/payroll', desc: 'View salary details' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="glass-panel glass-panel-interactive"
                style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '14px' }}
                onClick={() => navigate(card.path)}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: `${card.color}15`, border: `1px solid ${card.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color
                }}>
                  <Icon size={22} />
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: '1rem' }}>{card.label}</span>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>{card.desc}</span>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)', alignSelf: 'flex-end', marginTop: '-10px' }} />
              </div>
            );
          })}
        </div>

        {/* Recent Activity / Alerts — spec 3.2.1 */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} style={{ color: 'var(--primary)' }} /> Recent Activity & Alerts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Attendance entries */}
            {attendance.slice(0, 3).map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
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
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{l.leaveType} Leave</span>
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
        <StatCard title="Total Employees" value={employees.length} icon={Users} color="#6366f1" />
        <StatCard title="Present Today" value={todayAttendance.length} icon={Clock} color="#10b981" />
        <StatCard title="Pending Leaves" value={pendingLeaves.length} icon={CalendarRange} color="#f59e0b" />
        <StatCard title="Approved Leaves" value={approvedLeaves.length} icon={CalendarRange} color="#10b981" />
      </div>

      {/* Three-column Admin Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="admin-grid">
        <style>{`
          @media (min-width: 1024px) {
            .admin-grid { grid-template-columns: 1fr 1fr 1fr; }
          }
        `}</style>

        {/* Employee List — spec 3.2.2 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>Employee List</h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate('/employees')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {employees.slice(0, 6).map(emp => (
              <div key={emp.id}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                onClick={() => navigate('/employees')}
              >
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', background: '#232329',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--panel-border)', overflow: 'hidden', flexShrink: 0
                }}>
                  {emp.avatar
                    ? <img src={`data:image/png;base64,${emp.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <User size={16} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 500, fontSize: '0.9rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{emp.department || 'No dept'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Records — spec 3.2.2 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>Attendance Records</h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate('/attendance')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {attendance.slice(0, 6).map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{a.employeeName}</span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {a.checkIn ? new Date(a.checkIn.replace(' ', 'T') + 'Z').toLocaleString() : '-'}
                  </span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
            {attendance.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No records today.</p>}
          </div>
        </div>

        {/* Leave Approvals — spec 3.2.2 */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>Leave Approvals</h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate('/leaves')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {pendingLeaves.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending leave requests.</p>
              : pendingLeaves.slice(0, 6).map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{l.employeeName}</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {l.leaveType} — {l.numberOfDays} day(s)
                    </span>
                  </div>
                  <StatusBadge status={l.state} />
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
