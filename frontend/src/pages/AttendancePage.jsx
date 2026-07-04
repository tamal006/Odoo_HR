import React, { useEffect, useState, useMemo } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { Play, Square, AlertCircle, Calendar, ChevronLeft, ChevronRight, List, Grid3X3 } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayStr = new Date().toISOString().slice(0, 10);

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function formatTime(timeStr) {
  if (!timeStr) return '-';
  try {
    return new Date(timeStr.replace(' ', 'T') + 'Z').toLocaleString();
  } catch { return timeStr; }
}

export default function AttendancePage() {
  const { role, employeeId } = useAuthContext();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkInState, setCheckInState] = useState({ checkedIn: false });
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/attendance');
      if (res.success) {
        setAttendance(res.data);
        if (role === 'employee') {
          const open = res.data.find(a => !a.checkOut);
          setCheckInState({ checkedIn: !!open, record: open || null });
        }
      }
    } catch (err) { setError('Failed to load attendance.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAttendance(); }, [role, employeeId]);

  const handleCheckInToggle = async () => {
    try {
      setError(null);
      const res = await apiClient.post('/attendance', { employee_id: employeeId });
      if (res.success) {
        setCheckInState(res.action === 'check_in'
          ? { checkedIn: true, record: res.data }
          : { checkedIn: false, record: null });
        fetchAttendance();
      }
    } catch (err) { setError(err.message); }
  };

  // Build calendar data — map dates to statuses
  const calendarMap = useMemo(() => {
    const map = {};
    attendance.forEach(a => {
      if (!a.checkIn) return;
      const dateStr = a.checkIn.slice(0, 10); // YYYY-MM-DD
      if (!map[dateStr]) {
        map[dateStr] = {
          status: a.checkOut ? 'Present' : 'Checked In',
          hours: a.workedHours || 0,
          records: []
        };
      }
      map[dateStr].records.push(a);
      if (a.workedHours && a.workedHours > 0 && a.workedHours < 4) {
        map[dateStr].status = 'Half-day';
      } else if (a.checkOut) {
        map[dateStr].status = 'Present';
      }
    });
    return map;
  }, [attendance]);

  const { firstDay, daysInMonth } = getMonthDays(calYear, calMonth);
  const monthLabel = new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const statusColor = (status) => {
    switch (status) {
      case 'Present': return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7' };
      case 'Checked In': return { bg: 'rgba(244,114,182,0.15)', border: 'rgba(244,114,182,0.3)', text: '#fbcfe8' };
      case 'Half-day': return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d' };
      case 'Leave': return { bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', text: '#fda4af' };
      default: return { bg: 'transparent', border: 'transparent', text: 'var(--text-muted)' };
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>Attendance Tracker</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {role === 'admin' ? 'Monitor team attendance with daily, weekly, and monthly views.' : 'Track your clock-ins and view your attendance calendar.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
            <button
              className={viewMode === 'calendar' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ borderRadius: 0, padding: '8px 14px' }}
              onClick={() => setViewMode('calendar')}
            ><Grid3X3 size={16} /></button>
            <button
              className={viewMode === 'list' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ borderRadius: 0, padding: '8px 14px' }}
              onClick={() => setViewMode('list')}
            ><List size={16} /></button>
          </div>

          {role === 'employee' && (
            <button
              className={`btn ${checkInState.checkedIn ? 'btn-danger' : 'btn-primary'}`}
              onClick={handleCheckInToggle}
              style={{ padding: '10px 24px' }}
            >
              {checkInState.checkedIn ? <Square size={16} /> : <Play size={16} />}
              <span>{checkInState.checkedIn ? 'Check Out' : 'Check In'}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '8px', padding: '14px', color: '#fda4af', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      {loading ? <LoadingSkeleton count={3} height="100px" /> : viewMode === 'calendar' ? (
        /* ─── Monthly Calendar View ─── */
        <div className="glass-panel" style={{ padding: '24px' }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={prevMonth}><ChevronLeft size={18} /></button>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>{monthLabel}</h3>
            <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '8px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {/* Empty cells for days before month start */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} style={{ padding: '10px', minHeight: '70px' }} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entry = calendarMap[dateStr];
              const isToday = dateStr === todayStr;
              const sc = entry ? statusColor(entry.status) : statusColor('');
              const dayOfWeek = new Date(calYear, calMonth, day).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div
                  key={day}
                  style={{
                    padding: '8px',
                    minHeight: '70px',
                    borderRadius: '8px',
                    border: isToday ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.04)',
                    background: entry ? sc.bg : isWeekend ? 'rgba(255,255,255,0.01)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--primary)' : '#fff' }}>{day}</span>
                  {entry && (
                    <>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: sc.text, textTransform: 'uppercase' }}>{entry.status}</span>
                      {entry.hours > 0 && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{entry.hours.toFixed(1)}h</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Present', status: 'Present' },
              { label: 'Working', status: 'Checked In' },
              { label: 'Half-day', status: 'Half-day' },
              { label: 'Leave', status: 'Leave' },
            ].map(item => {
              const sc = statusColor(item.status);
              return (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: sc.bg, border: `1px solid ${sc.border}` }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─── List View ─── */
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <style>{`
            .att-table { width: 100%; border-collapse: collapse; text-align: left; }
            .att-table th { padding: 14px 20px; font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--panel-border); text-transform: uppercase; letter-spacing: 0.5px; }
            .att-table td { padding: 14px 20px; font-size: 0.9rem; color: var(--text-primary); border-bottom: 1px solid rgba(255,255,255,0.04); }
          `}</style>
          <table className="att-table">
            <thead>
              <tr>
                {role === 'admin' && <th>Employee</th>}
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr><td colSpan={role === 'admin' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No attendance records found.</td></tr>
              ) : attendance.map(a => (
                <tr key={a.id}>
                  {role === 'admin' && <td style={{ fontWeight: 500 }}>{a.employeeName}</td>}
                  <td>{formatTime(a.checkIn)}</td>
                  <td>{formatTime(a.checkOut)}</td>
                  <td>{a.workedHours != null ? `${a.workedHours.toFixed(2)} hrs` : '-'}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

