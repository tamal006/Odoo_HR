// agent.js — client for the Python AI agent (FastAPI, :8000).
// In dev, Vite proxies /agent and /insights to it (see vite.config.js), so we
// use relative paths by default. Set VITE_AGENT_URL to hit it cross-origin.
const AGENT_URL = import.meta.env.VITE_AGENT_URL || '';

const json = async (path) => {
  const r = await fetch(`${AGENT_URL}${path}`);
  return r.json();
};

export const fetchOverview = () => json('/insights/overview');
export const fetchEmployeeInsight = (id) => json(`/insights/employee/${id}`);
export const fetchSimulate = (leaveId) => json(`/insights/simulate/${leaveId}`);
export const fetchCapacity = (dept, weeks = 8) => {
  const q = new URLSearchParams({ weeks });
  if (dept) q.set('department_id', dept);
  return json(`/insights/capacity?${q}`);
};
export const agentHealth = async () => {
  try {
    const res = await json('/health');
    if (res && res.status === 'ok') return res;
  } catch { /* try direct fallback */ }
  try {
    const r = await fetch('http://localhost:8000/health');
    return await r.json();
  } catch {
    return { mcp_connected: false };
  }
};

// Streaming chat over the Vercel AI SDK data-stream protocol.
// Calls onDelta(fullTextSoFar) as tokens arrive; resolves with the final text.
export async function streamChat(payload, onDelta, onError) {
  const res = await fetch(`${AGENT_URL}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) throw new Error(`Agent responded ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      let ev;
      try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (ev.type === 'text-delta') { full += ev.delta || ''; onDelta(full); }
      else if (ev.type === 'error') { onError?.(ev.error); throw new Error(ev.error); }
    }
  }
  return full;
}
