import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Send, ShieldCheck, TrendingUp, CalendarClock, Activity,
  AlertTriangle, ChevronRight, Cpu, Loader2,
} from 'lucide-react';
import { useAuthContext } from '../context/AuthContext';
import {
  streamChat, fetchOverview, fetchSimulate, agentHealth,
} from '../api/agent';

/* ----------------------------- tiny markdown ----------------------------- */
const escapeHtml = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const inlineMd = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
function renderMarkdown(src) {
  const lines = escapeHtml(src).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
      let t = '<table class="md-table"><thead><tr>' + cells(rows[0]).map((h) => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
      rows.slice(2).forEach((r) => { t += '<tr>' + cells(r).map((d) => `<td>${d}</td>`).join('') + '</tr>'; });
      out.push(t + '</tbody></table>');
      continue;
    }
    if (/^\s*&gt;\s?/.test(l)) { out.push('<blockquote>' + inlineMd(l.replace(/^\s*&gt;\s?/, '')) + '</blockquote>'); i++; continue; }
    out.push(inlineMd(l)); i++;
  }
  return out.join('\n').replace(/\n(?!<)/g, '<br/>');
}

/* ------------------------------- helpers -------------------------------- */
const riskColor = (r) => (r === 'understaffed' ? '#a3a3a3' : r === 'watch' ? '#525252' : '#000000');
const bandColor = (s) => (s == null ? '#737373' : s < 25 ? '#000000' : s < 50 ? '#404040' : s < 75 ? '#737373' : '#a3a3a3');
const initials = (n) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const PRESETS = {
  admin: [
    'Approve leave request 101 for Ananya',
    'Which weeks are we understaffed?',
    'Preview the impact of approving leave 101',
    'Is Rohit at risk of burnout?',
  ],
  employee: [
    "What's my leave balance forecast?",
    'Submit leave for next Monday',
    'Show my attendance pattern',
  ],
};

/* ============================================================================
   Capability strip — communicates WHAT makes this clever
   ========================================================================== */
const CAPABILITIES = [
  { icon: TrendingUp, label: 'Predictive', tip: 'Burn-rate forecasts, burnout signal & 8-week capacity — computed live, not stored.' },
  { icon: ShieldCheck, label: 'Human-gated', tip: 'RBAC enforced in code + explicit confirmation before any Odoo write.' },
  { icon: CalendarClock, label: 'Impact Preview', tip: 'Simulates a leave approval and shows the staffing consequence before you act.' },
];

function CapabilityStrip() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {CAPABILITIES.map(({ icon: Icon, label, tip }) => (
        <div key={label} title={tip}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999,
            background: '#ffffff', border: '1px solid #000000', fontSize: 12.5, fontWeight: 700, color: '#000000', boxShadow: '2px 2px 0px 0px #000000' }}>
          <Icon size={14} color="#000000" /> {label}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   Capacity timeline (live from the agent)
   ========================================================================== */
function CapacityTimeline({ weeks }) {
  if (!weeks?.length) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No forecast yet.</div>;
  return (
    <>
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 96, marginTop: 4 }}>
        {weeks.map((w) => {
          const off = w.on_leave_confirmed + w.on_leave_pending;
          return (
            <div key={w.week_start} title={`${w.label}: ${w.coverage_pct}% covered · ${off} off`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', height: 13 }}>{off || ''}</div>
              <div style={{ width: '100%', minHeight: 5, height: `${Math.max(6, w.coverage_pct)}%`,
                background: riskColor(w.risk), borderRadius: '5px 5px 2px 2px', transition: 'height .8s cubic-bezier(.22,1,.36,1)' }} />
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{(w.label || '').split(' ')[1]}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
        {[['Healthy', '#000000'], ['Watch', '#525252'], ['Understaffed', '#a3a3a3']].map(([t, c]) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} /> {t}
          </span>
        ))}
      </div>
    </>
  );
}

/* ============================================================================
   Impact Preview — the standout: before/after a hypothetical approval
   ========================================================================== */
function ImpactPreview({ sim, loading }) {
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}><Loader2 size={15} className="spin" /> Simulating approval…</div>;
  if (!sim) return <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Select a pending approval to preview its staffing impact.</div>;
  if (sim.error) return <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Impact preview needs the predictive tools (live in the demo Odoo).</div>;
  return (
    <div className="animate-fade-in">
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
        If you approve <span style={{ color: '#ffffff' }}>{sim.employee_name}</span>&rsquo;s leave:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(52px, 1fr))', gap: 6, marginBottom: 10 }}>
        {sim.weeks.map((w) => {
          const drop = w.delta < 0;
          return (
            <div key={w.label} title={`${w.label}: ${w.before}% → ${w.after}%`}
              style={{ textAlign: 'center', padding: '7px 3px', borderRadius: 8,
                background: w.risk_after === 'understaffed' ? 'var(--danger-bg)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${w.risk_after === 'understaffed' ? 'var(--danger-border)' : 'var(--panel-border)'}` }}>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{(w.label || '').split(' ')[1]}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: drop ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {w.before}<span style={{ opacity: .5 }}>→</span>{w.after}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5,
        padding: '9px 11px', borderRadius: 8, background: sim.safe ? 'var(--success-bg)' : 'var(--danger-bg)',
        border: `1px solid ${sim.safe ? 'var(--success-border)' : 'var(--danger-border)'}`, color: sim.safe ? '#ffffff' : '#a1a1aa' }}>
        {sim.safe ? <ShieldCheck size={15} style={{ flex: 'none', marginTop: 1 }} /> : <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />}
        <span>{sim.verdict}</span>
      </div>
    </div>
  );
}

/* ============================================================================
   Copilot page
   ========================================================================== */
export default function CopilotPage() {
  const auth = useAuthContext();
  const role = auth.role || 'admin';
  const identity = {
    role,
    employee_id: auth.employeeId ? Number(auth.employeeId) : 1,
    employee_name: auth.employeeDetails?.name || auth.email || 'Soumyajit Roy (HR Manager)',
  };

  const [messages, setMessages] = useState([]);       // {role, content}
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [overview, setOverview] = useState(null);
  const [sim, setSim] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const logRef = useRef(null);

  const loadOverview = useCallback(async () => {
    try { const d = await fetchOverview(); if (!d.error) setOverview(d); } catch { /* agent offline */ }
  }, []);

  useEffect(() => { loadOverview(); agentHealth().then(setHealth); }, [loadOverview]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages]);

  const runSimulation = async (leaveId) => {
    setSimLoading(true); setSim(null);
    try { setSim(await fetchSimulate(leaveId)); } catch { setSim({ error: true }); }
    finally { setSimLoading(false); }
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    setInput('');
    const next = [...messages, { role: 'user', content: q }];
    setMessages([...next, { role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);
    const update = (full) => setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: full, streaming: true }; return c; });
    try {
      const full = await streamChat({ messages: next, ...identity }, update, (err) => update('⚠ ' + err));
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: full || '_(no response)_' }; return c; });
    } catch (e) {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: '⚠ ' + e.message + ' — is the agent running on :8000?' }; return c; });
    } finally { setStreaming(false); loadOverview(); }
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const worst = overview?.capacity?.worst_week?.coverage_pct;
  const target = health?.mcp_target;
  const connected = health?.mcp_connected;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <style>{`
        .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
        .co-msg code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 90%; }
        .co-msg blockquote { margin: 6px 0; padding: 5px 11px; border-left: 2px solid var(--primary);
          background: rgba(255,255,255,0.05); border-radius: 0 6px 6px 0; color: var(--text-secondary); font-size: 12.5px; }
        .co-msg .md-table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12.5px; }
        .co-msg .md-table th, .co-msg .md-table td { border: 1px solid var(--panel-border); padding: 5px 9px; text-align: left; }
        .co-msg .md-table th { background: rgba(255,255,255,0.04); }
        .cursor-blink { display: inline-block; width: 7px; height: 14px; background: var(--primary); border-radius: 2px; vertical-align: text-bottom; animation: blink 1s steps(2) infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .preset:hover { border-color: var(--primary) !important; color: var(--primary) !important; }
        .attn-row:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.14) !important; }
        @media (max-width: 980px) { .co-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: '#000000', border: '1px solid #000000', display: 'grid', placeItems: 'center', boxShadow: '2px 2px 0px 0px #000000', flexShrink: 0 }}>
              <Sparkles size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.3px', color: '#000000', margin: 0 }}>AI Copilot</h1>
              <div style={{ fontSize: 12.5, color: '#404040' }}>Reads your Odoo HR through MCP · forecasts · never writes without you</div>
            </div>
          </div>
          <div title={connected ? `Live data source: ${target || 'Odoo via MCP'}` : 'Agent offline'}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999,
              background: '#ffffff', border: '1px solid #000000', fontSize: 12, fontWeight: 700, color: '#000000', boxShadow: '2px 2px 0px 0px #000000' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: connected ? '#000000' : '#737373', display: 'inline-block' }} />
            {connected ? `Live · ${target || 'Odoo'}` : 'Agent offline'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 2 }}>
          <CapabilityStrip />
        </div>
      </div>

      {/* main grid */}
      <div className="co-grid" style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20, flex: 1, minHeight: 0 }}>
        {/* chat */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 460, overflow: 'hidden' }}>
          <div ref={logRef} style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', maxWidth: 380 }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>✦</div>
                <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>How can I help, {identity.employee_name.split(' ')[0]}?</div>
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>Ask about leave, approvals, attendance or capacity. I call Odoo tools live and confirm before any change.</p>
              </div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className="co-msg" style={{
                maxWidth: '82%', padding: '11px 15px', borderRadius: 8, lineHeight: 1.55, fontSize: 13.5,
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? '#000000' : '#ffffff',
                border: m.role === 'user' ? '1px solid #000000' : '1px solid #000000',
                color: m.role === 'user' ? '#ffffff' : '#000000',
                boxShadow: '2px 2px 0px 0px #000000'
              }}>
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                {m.streaming && <span className="cursor-blink" />}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--panel-border)', padding: '13px 18px 16px', background: 'rgba(255,255,255,0.015)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 11 }}>
              {(PRESETS[role] || PRESETS.employee).map((p) => (
                <button key={p} className="preset" onClick={() => send(p)} disabled={streaming}
                  style={{ fontSize: 12, fontWeight: 500, padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)', color: 'var(--text-secondary)' }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea className="form-textarea" rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
                placeholder="Ask your Odoo HR copilot…" style={{ resize: 'none', maxHeight: 120 }} />
              <button className={`btn btn-primary ${streaming ? 'btn-disabled' : ''}`} onClick={() => send()} disabled={streaming} style={{ height: 44 }}>
                {streaming ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* insights rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 2 }}>
          {/* capacity */}
          <div className="glass-panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CalendarClock size={16} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Org capacity · 8 weeks</span>
              {worst != null && (
                <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                  background: worst < 70 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)', color: worst < 70 ? '#a1a1aa' : '#ffffff' }}>
                  min {worst}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 6 }}>{overview?.capacity?.narrative || 'Loading live forecast…'}</div>
            <CapacityTimeline weeks={overview?.capacity?.weeks} />
          </div>

          {/* pending approvals -> impact preview */}
          <div className="glass-panel" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Cpu size={16} color="var(--primary)" />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Pending approvals</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>tap to preview impact</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(overview?.pending_approvals || []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing awaiting approval.</div>}
              {(overview?.pending_approvals || []).map((p) => (
                <button key={p.id} className="attn-row" onClick={() => runSimulation(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, cursor: 'pointer',
                    background: 'transparent', border: '1px solid var(--panel-border)', textAlign: 'left', color: 'var(--text-primary)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{initials(p.employee_name)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.employee_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>#{p.id} · {p.date_from} → {p.date_to} · {p.days}d</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </button>
              ))}
            </div>
            {(sim || simLoading) && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--panel-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--primary)', marginBottom: 10 }}>
                  <Activity size={13} /> Impact Preview
                </div>
                <ImpactPreview sim={sim} loading={simLoading} />
                {sim && !sim.error && (
                  <button className="btn btn-secondary" style={{ width: '100%', marginTop: 10, fontSize: 12.5 }}
                    onClick={() => send(`Approve leave request ${overview.pending_approvals.find((p) => p.employee_name === sim.employee_name)?.id ?? ''} for ${sim.employee_name}`)}>
                    Ask copilot to approve →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* at-risk */}
          {(overview?.at_risk || []).length > 0 && (
            <div className="glass-panel" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={16} color="var(--warning)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Burnout radar</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {overview.at_risk.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#000000', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, color: '#ffffff' }}>{initials(p.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#000000' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.balance_status === 'over_pace' ? 'Leave burn over pace' : `Attendance risk · ${p.attendance_label}`}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: bandColor(p.attendance_score) }}>{p.attendance_score ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
