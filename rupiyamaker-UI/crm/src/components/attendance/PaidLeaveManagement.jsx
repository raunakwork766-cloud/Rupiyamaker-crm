import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { hrmsService } from '../../services/hrmsService';

const BASE = '/api';
const uid = () => { try { const u = JSON.parse(localStorage.getItem('userData') || 'null'); return u?.user_id || u?._id || ''; } catch { return ''; } };
const uname = () => { try { const u = JSON.parse(localStorage.getItem('userData') || 'null'); return u?.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : 'Admin'; } catch { return 'Admin'; } };
const empName = e => `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown';
const empInit = e => empName(e).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const fmt = d => { if (!d) return '—'; try { return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return String(d); } };

const getISTMonth = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const periodLabel = p => { if (!p) return ''; const [y, m] = p.split('-'); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }); };

const LEAVES = [
  { k: 'earned', l: 'Earned Leave', s: 'EL', c: '#38bdf8', dot: '#0ea5e9', fp: 'earned_leaves' },
  { k: 'paid',   l: 'Paid Leave',   s: 'PL', c: '#4ade80', dot: '#22c55e', fp: 'paid_leaves' },
  { k: 'grace',  l: 'Grace Leave',  s: 'GR', c: '#c084fc', dot: '#a855f7', fp: 'grace_leaves' },
];

/* ─────────────────────────────── MAIN ─────────────────────────────── */
const PaidLeaveManagement = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);
  const [q, setQ]             = useState('');
  const [period, setPeriod]   = useState(getISTMonth);

  // Popup state: { emp, lt, bal } when a cell is clicked
  const [popup, setPopup]     = useState(null);
  const [popTab, setPopTab]   = useState('adjust'); // 'adjust' | 'history'
  const [busy, setBusy]       = useState(false);
  const [hist, setHist]       = useState([]);
  const [histLoad, setHistLoad] = useState(false);

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const empResp = await hrmsService.getAllEmployees();
      const allEmps = Array.isArray(empResp?.data) ? empResp.data : [];
      const list = allEmps.filter(e => e.employee_status === 'active');
      const bals = await Promise.allSettled(
        list.map(e => axios.get(`${BASE}/settings/leave-balance/${e._id || e.id}?user_id=${uid()}&period=${period}`).then(r => r.data?.data || null))
      );
      const newRows = list.map((e, i) => ({ e, b: bals[i].status === 'fulfilled' ? bals[i].value : null }));
      setRows(newRows);
      // refresh popup bal if open
      if (popup) {
        const pId = popup.emp._id || popup.emp.id;
        const updated = newRows.find(r => (r.e._id || r.e.id) === pId);
        if (updated) setPopup(p => ({ ...p, bal: updated.b }));
      }
    } catch (x) {
      showToast('err', 'Load failed: ' + (x.response?.data?.detail || x.message));
    } finally { setLoading(false); }
  };

  const adjust = async (amt) => {
    if (!popup || busy) return;
    setBusy(true);
    const { emp, lt } = popup;
    const isAdd = amt > 0;
    try {
      await axios.post(`${BASE}/settings/leave-balance/${isAdd ? 'allocate' : 'deduct'}?user_id=${uid()}`, {
        employee_id: emp._id || emp.id, leave_type: lt.k,
        quantity: Math.abs(amt),
        reason: `${isAdd ? '+' : ''}${amt} ${lt.s} by ${uname()}`,
        period,
      });
      showToast('ok', `${isAdd ? '+' : ''}${amt} ${lt.s} → ${empName(emp)}`);
      await load();
      // reload history if on history tab
      if (popTab === 'history') loadHist(emp);
    } catch (x) {
      showToast('err', x.response?.data?.detail || 'Failed');
    } finally { setBusy(false); }
  };

  const loadHist = async (emp) => {
    setHistLoad(true); setHist([]);
    try {
      const id = (emp || popup?.emp)?._id || (emp || popup?.emp)?.id;
      const r = await axios.get(`${BASE}/settings/leave-balance/history/${id}?user_id=${uid()}&period=${period}`);
      setHist(Array.isArray(r.data) ? r.data : []);
    } catch { setHist([]); } finally { setHistLoad(false); }
  };

  const openPopup = (emp, lt, bal) => {
    setPopup({ emp, lt, bal }); setPopTab('adjust'); setBusy(false);
  };
  const closePopup = () => { setPopup(null); };

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };
  const gv = (b, lt, f) => parseFloat(b?.[`${lt.fp}_${f}`] ?? 0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(({ e }) =>
      `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(s) ||
      String(e.employee_code || e.employee_id || e.emp_id || '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  // popup helpers
  const pRem = popup ? gv(popup.bal, popup.lt, 'remaining') : 0;
  const pTot = popup ? gv(popup.bal, popup.lt, 'total') : 0;
  const pUsed = popup ? gv(popup.bal, popup.lt, 'used') : 0;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e4e4e7' }}>
      <style>{`
        .lm-r:hover { background: #111114 !important; }
        .lm-cell:hover { background: #18181b !important; transform: scale(1.05); }
        .lm-ab:hover:not(:disabled) { filter: brightness(1.3); transform: scale(1.08); }
        .lm-ab:active:not(:disabled) { transform: scale(0.95); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes modalIn { from { opacity:0; transform:translate(-50%,-50%) scale(.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
      `}</style>

      {/* ═══ Header ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>Leave Management</h3>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#52525b' }}>
            Click on any value to adjust &bull; {rows.length} employees &bull; <span style={{ color: '#38bdf8', fontWeight: 700 }}>{periodLabel(period)}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '5px 10px' }}>
            <input type="month" value={period} onChange={e => { if (e.target.value) setPeriod(e.target.value); }}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#52525b', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
              style={{ background: '#09090b', border: '1px solid #27272a', color: '#e4e4e7', padding: '7px 10px 7px 28px', borderRadius: 8, fontSize: 12, outline: 'none', width: 150 }}
              onFocus={e => e.target.style.borderColor = '#0ea5e9'} onBlur={e => e.target.style.borderColor = '#27272a'} />
          </div>
          <button onClick={load} title="Refresh"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', border: '1px solid #27272a', color: '#a1a1aa', padding: 7, borderRadius: 8, cursor: 'pointer' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* ═══ Toast ═══ */}
      {toast && (
        <div style={{ padding: '8px 14px', borderRadius: 8, marginBottom: 10, fontSize: 12, fontWeight: 600, animation: 'fadeIn .15s',
          background: toast.type === 'ok' ? '#052e16' : '#450a0a', border: `1px solid ${toast.type === 'ok' ? '#16a34a' : '#dc2626'}`,
          color: toast.type === 'ok' ? '#86efac' : '#fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{toast.type === 'ok' ? '✓' : '✗'} {toast.msg}</span>
          <span onClick={() => setToast(null)} style={{ cursor: 'pointer', opacity: .5, fontSize: 14 }}>×</span>
        </div>
      )}

      {/* ═══ Loading ═══ */}
      {loading && !popup && (
        <div style={{ textAlign: 'center', padding: 60, color: '#52525b' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #27272a', borderTopColor: '#0ea5e9', borderRadius: '50%', margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 12 }}>Loading...</div>
        </div>
      )}

      {/* ═══ Table ═══ */}
      {!loading && (
        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 10, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #1f1f22', background: '#0d0d10' }}>
            <span style={{ fontSize: 10, color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Employee</span>
            {LEAVES.map(lt => (
              <div key={lt.k} style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: lt.c }}>{lt.l}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0
            ? <div style={{ textAlign: 'center', padding: 50, color: '#3f3f46', fontSize: 13 }}>No employees found</div>
            : filtered.map(({ e: emp, b: bal }) => {
                const id = emp._id || emp.id;
                const name = empName(emp);
                return (
                  <div key={id} className="lm-r"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #151518', transition: 'background .1s' }}>

                    {/* Employee */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `hsl(${(name.charCodeAt(0) * 37) % 360},50%,35%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                        {empInit(emp)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#e4e4e7', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      </div>
                    </div>

                    {/* Leave cells — clickable values */}
                    {LEAVES.map(lt => {
                      const rem = gv(bal, lt, 'remaining');
                      const isActive = popup && (popup.emp._id || popup.emp.id) === id && popup.lt.k === lt.k;
                      return (
                        <div key={lt.k}
                          className="lm-cell"
                          onClick={() => openPopup(emp, lt, bal)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '6px 4px', borderRadius: 8, cursor: 'pointer', transition: 'all .12s',
                            background: isActive ? `${lt.dot}15` : 'transparent',
                            border: isActive ? `1px solid ${lt.dot}40` : '1px solid transparent',
                          }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: rem > 0 ? lt.c : '#3f3f46', lineHeight: 1 }}>{rem}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ═══════════ POPUP MODAL ═══════════ */}
      {popup && (
        <>
          {/* Backdrop */}
          <div onClick={closePopup}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }} />

          {/* Modal */}
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 380, maxWidth: '95vw', maxHeight: '85vh',
            background: '#0a0a0d', border: `1px solid ${popup.lt.dot}30`, borderRadius: 14, zIndex: 1001,
            display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.7)', animation: 'modalIn .2s ease' }}>

            {/* Header */}
            <div style={{ padding: '16px 18px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10,
                    background: `hsl(${(empName(popup.emp).charCodeAt(0) * 37) % 360},50%,35%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                    {empInit(popup.emp)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{empName(popup.emp)}</div>
                    <div style={{ fontSize: 11, color: popup.lt.c, fontWeight: 700, marginTop: 2 }}>{popup.lt.l}</div>
                  </div>
                </div>
                <button onClick={closePopup}
                  style={{ background: '#18181b', border: '1px solid #27272a', color: '#71717a', width: 28, height: 28, borderRadius: 6,
                    cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              {/* Tabs: Adjust | History */}
              <div style={{ display: 'flex', gap: 2, background: '#111113', borderRadius: 8, padding: 3 }}>
                {[
                  { id: 'adjust', label: '± Adjust' },
                  { id: 'history', label: '📋 History' },
                ].map(tab => (
                  <button key={tab.id}
                    onClick={() => { setPopTab(tab.id); if (tab.id === 'history') loadHist(popup.emp); }}
                    style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      background: popTab === tab.id ? popup.lt.dot : 'transparent',
                      color: popTab === tab.id ? '#fff' : '#52525b', transition: 'all .15s' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: '#1f1f22', margin: '12px 0 0' }} />

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 18px' }}>

              {/* ── ADJUST TAB ── */}
              {popTab === 'adjust' && (
                <>
                  {/* Balance summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 18, padding: '10px 0', background: '#111113', borderRadius: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#52525b', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#a1a1aa', lineHeight: 1, marginTop: 4 }}>{pTot}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#52525b', fontWeight: 700, textTransform: 'uppercase' }}>Used</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#ef4444', lineHeight: 1, marginTop: 4 }}>{pUsed}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#52525b', fontWeight: 700, textTransform: 'uppercase' }}>Remaining</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: popup.lt.c, lineHeight: 1, marginTop: 4 }}>{pRem}</div>
                    </div>
                  </div>

                  {/* Add buttons */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>➕ Add</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
                    {[0.5, 1, 2, 5].map(n => (
                      <button key={n} className="lm-ab" disabled={busy} onClick={() => adjust(n)}
                        style={{ padding: '10px 0', borderRadius: 8, border: 'none', cursor: busy ? 'wait' : 'pointer',
                          fontSize: 15, fontWeight: 900, transition: 'all .12s', opacity: busy ? .4 : 1,
                          background: '#052e16', color: '#4ade80' }}>
                        +{n}
                      </button>
                    ))}
                  </div>

                  {/* Subtract buttons */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>➖ Deduct</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {[0.5, 1, 2, 5].map(n => (
                      <button key={n} className="lm-ab" disabled={busy} onClick={() => adjust(-n)}
                        style={{ padding: '10px 0', borderRadius: 8, border: 'none', cursor: busy ? 'wait' : 'pointer',
                          fontSize: 15, fontWeight: 900, transition: 'all .12s', opacity: busy ? .4 : 1,
                          background: '#2a0a0a', color: '#f87171' }}>
                        −{n}
                      </button>
                    ))}
                  </div>

                  {busy && (
                    <div style={{ textAlign: 'center', marginTop: 14, color: '#52525b', fontSize: 11 }}>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #27272a', borderTopColor: popup.lt.dot, borderRadius: '50%', animation: 'spin .6s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />
                      Processing...
                    </div>
                  )}
                </>
              )}

              {/* ── HISTORY TAB ── */}
              {popTab === 'history' && (
                histLoad
                  ? <div style={{ textAlign: 'center', padding: 40, color: '#52525b' }}>
                      <div style={{ width: 22, height: 22, border: '3px solid #27272a', borderTopColor: '#0ea5e9', borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
                      Loading...
                    </div>
                  : hist.length === 0
                    ? <div style={{ textAlign: 'center', padding: 40, color: '#3f3f46', fontSize: 12 }}>No history found for this period</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {hist.filter(h => !popup || h.leave_type === popup.lt.k || !h.leave_type).map((h, i) => {
                          const qty = parseFloat(h.quantity ?? h.amount ?? 0);
                          const isA = (h.action || h.transaction_type || '').toLowerCase().includes('alloc') || qty > 0;
                          const lt = LEAVES.find(l => l.k === h.leave_type) || popup.lt;
                          const by = h.performed_by_name || h.updated_by_name || h.created_by_name || h.admin_name || '';
                          return (
                            <div key={h._id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#111113', border: '1px solid #1a1a1e', borderRadius: 6, borderLeft: `3px solid ${isA ? '#22c55e' : '#ef4444'}` }}>
                              <span style={{ fontWeight: 900, color: isA ? '#22c55e' : '#ef4444', fontSize: 15, width: 36, textAlign: 'center', flexShrink: 0 }}>
                                {isA ? '+' : '−'}{Math.abs(qty)}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 2 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: isA ? '#052e16' : '#450a0a', color: isA ? '#4ade80' : '#fca5a5' }}>
                                    {isA ? 'Added' : 'Deducted'}
                                  </span>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: lt.c }}>{lt.s}</span>
                                </div>
                                <div style={{ fontSize: 10, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {h.reason || h.note || '—'}
                                </div>
                                {by && <div style={{ fontSize: 9, color: '#3f3f46', marginTop: 2 }}>by {by}</div>}
                              </div>
                              <div style={{ fontSize: 9, color: '#3f3f46', flexShrink: 0, textAlign: 'right' }}>
                                {fmt(h.created_at || h.timestamp || h.date)}
                              </div>
                            </div>
                          );
                        })}
                        {hist.filter(h => !popup || h.leave_type === popup.lt.k || !h.leave_type).length === 0 && (
                          <div style={{ textAlign: 'center', padding: 30, color: '#3f3f46', fontSize: 12 }}>No {popup.lt.s} history found</div>
                        )}
                      </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PaidLeaveManagement;

