import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { hrmsService } from '../../services/hrmsService';

const BASE = '/api';
const uid = () => { try { const u = JSON.parse(localStorage.getItem('userData') || 'null'); return u?.user_id || u?._id || ''; } catch { return ''; } };
const empName = e => `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown';
const empInit = e => empName(e).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const fmt = d => { if (!d) return '—'; try { return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }); } catch { return String(d); } };

const getISTMonth = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const periodLabel = p => { if (!p) return ''; const [y, m] = p.split('-'); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }); };

const LEAVES = [
  { k: 'earned', l: 'Earned Leave', s: 'EL', c: '#38bdf8', bg: 'rgba(56,189,248,0.10)', dot: '#0ea5e9', fp: 'earned_leaves' },
  { k: 'paid',   l: 'Paid Leave',   s: 'PL', c: '#4ade80', bg: 'rgba(74,222,128,0.10)', dot: '#22c55e', fp: 'paid_leaves' },
  { k: 'grace',  l: 'Grace Leave',  s: 'GR', c: '#c084fc', bg: 'rgba(192,132,252,0.10)', dot: '#a855f7', fp: 'grace_leaves' },
];

/* ─────────────────────────────── MAIN ─────────────────────────────── */
const PaidLeaveManagement = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);
  const [q, setQ]             = useState('');
  const [period, setPeriod]   = useState(getISTMonth); // YYYY-MM

  // Modal
  const [sel, setSel]             = useState(null);
  const [panelTab, setPanelTab]   = useState('overview');
  const [hist, setHist]           = useState([]);
  const [histLoad, setHistLoad]   = useState(false);

  // Allot / Deduct form (used inside panel)
  const [aType, setAType]     = useState('earned');
  const [aQty, setAQty]       = useState('');
  const [aReason, setAReason] = useState('');
  const [aLoad, setALoad]     = useState(false);
  const [aErr, setAErr]       = useState(null);
  const [ql, setQl]           = useState(null);

  useEffect(() => { load(); }, [period]);

  /* ── Data loading ── */  const load = async () => {
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
      // refresh selected employee's balance if panel is open
      if (sel) {
        const selId = sel.e._id || sel.e.id;
        const updated = newRows.find(r => (r.e._id || r.e.id) === selId);
        if (updated) setSel(updated);
      }
    } catch (x) {
      showToast('err', 'Load failed: ' + (x.response?.data?.detail || x.message));
    } finally { setLoading(false); }
  };

  const loadHist = async id => {
    setHistLoad(true);
    try {
      const r = await axios.get(`${BASE}/settings/leave-balance/history/${id}?user_id=${uid()}&period=${period}`);
      setHist(Array.isArray(r.data) ? r.data : []);
    } catch { setHist([]); } finally { setHistLoad(false); }
  };

  /* ── Actions ── */
  const doAction = async (mode) => {
    if (!aQty || !aReason.trim()) { setAErr('Quantity and reason are required'); return; }
    if (!sel) return;
    setALoad(true); setAErr(null);
    try {
      await axios.post(`${BASE}/settings/leave-balance/${mode === 'allot' ? 'allocate' : 'deduct'}?user_id=${uid()}`, {
        employee_id: sel.e._id || sel.e.id, leave_type: aType,
        quantity: parseFloat(aQty), reason: aReason.trim(), period,
      });
      showToast('ok', `${mode === 'allot' ? 'Allocated' : 'Deducted'} ${aQty} ${aType} leave for ${empName(sel.e)}`);
      setAQty(''); setAReason(''); setAErr(null);
      load();
      loadHist(sel.e._id || sel.e.id);
    } catch (x) { setAErr(x.response?.data?.detail || 'Operation failed'); }
    finally { setALoad(false); }
  };

  const quickEL = async (emp, amt) => {
    const id = emp._id || emp.id; setQl(id);
    try {
      await axios.post(`${BASE}/settings/leave-balance/allocate?user_id=${uid()}`, {
        employee_id: id, leave_type: 'earned', quantity: amt,
        reason: `Quick EL: ${amt === 1 ? 'Full day' : amt === 0.5 ? 'Half day' : amt + ' days'}`,
        period,
      });
      showToast('ok', `+${amt} EL → ${empName(emp)}`);
      load();
      if (sel && (sel.e._id || sel.e.id) === id) loadHist(id);
    } catch (x) { showToast('err', x.response?.data?.detail || 'Failed'); }
    finally { setQl(null); }
  };

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };
  const v = (b, lt, f) => parseFloat(b?.[`${lt.fp}_${f}`] ?? 0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(({ e }) =>
      `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(s) ||
      String(e.employee_code || e.employee_id || e.emp_id || '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  /* ── Modal helpers ── */
  const openModal = (row) => {
    setSel(row); setPanelTab('overview'); setAType('earned'); setAQty(''); setAReason(''); setAErr(null);
    loadHist(row.e._id || row.e.id);
  };
  const closeModal = () => { setSel(null); };

  const selId = sel ? (sel.e._id || sel.e.id) : null;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e4e4e7' }}>
      <style>{`
        .lm-row:hover { background: #111114 !important; }
        .lm-row:hover .lm-manage { opacity: 1 !important; }
        .lm-badge:hover { transform: scale(1.06); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .lm-tab { transition: all .15s !important; }
        .lm-tab:hover { background: #1a1a1e !important; }
        .lm-qbtn:hover:not(:disabled) { transform: scale(1.08); }
        .lm-action-btn:hover:not(:disabled) { filter: brightness(1.2); }
        .lm-panel::-webkit-scrollbar { width: 4px; }
        .lm-panel::-webkit-scrollbar-track { background: transparent; }
        .lm-panel::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
      `}</style>

      {/* ═══ Header ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Leave Management
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#52525b' }}>
            Manage employee leaves &bull; {rows.length} active employees &bull; <span style={{ color: '#38bdf8', fontWeight: 700 }}>{periodLabel(period)}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Month Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '6px 10px' }}>
            <svg width="14" height="14" fill="none" stroke="#52525b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <input
              type="month"
              value={period}
              onChange={e => { if (e.target.value) setPeriod(e.target.value); }}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#52525b', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee..."
              style={{ background: '#09090b', border: '1px solid #27272a', color: '#e4e4e7', padding: '8px 12px 8px 34px', borderRadius: 8, fontSize: 13, outline: 'none', width: 220, transition: 'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = '#0ea5e9'} onBlur={e => e.target.style.borderColor = '#27272a'}
            />
          </div>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#09090b', border: '1px solid #27272a', color: '#a1a1aa', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600, transition: 'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#18181b'} onMouseLeave={e => e.currentTarget.style.background = '#09090b'}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ═══ Summary Cards ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {LEAVES.map(lt => {
          const totalRem = rows.reduce((s, { b }) => s + v(b, lt, 'remaining'), 0);
          const totalUsed = rows.reduce((s, { b }) => s + v(b, lt, 'used'), 0);
          return (
            <div key={lt.k} style={{ background: lt.bg, border: `1px solid ${lt.dot}22`, borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${lt.dot}`, transition: 'transform .15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: lt.c }}>{lt.s}</span>
                <span style={{ fontSize: 9, color: '#52525b', fontWeight: 600 }}>{lt.l}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: lt.c, lineHeight: 1 }}>{totalRem}</div>
              <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 4 }}>Available &bull; {totalUsed} used</div>
            </div>
          );
        })}
      </div>

      {/* ═══ Toast ═══ */}
      {toast && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderRadius: 10, marginBottom: 14, fontSize: 12, fontWeight: 600,
          background: toast.type === 'ok' ? '#052e16' : '#450a0a', border: `1px solid ${toast.type === 'ok' ? '#16a34a' : '#dc2626'}`,
          color: toast.type === 'ok' ? '#86efac' : '#fca5a5', animation: 'fadeIn .2s' }}>
          <span>{toast.type === 'ok' ? '✓' : '✗'} {toast.msg}</span>
          <span onClick={() => setToast(null)} style={{ cursor: 'pointer', marginLeft: 12, opacity: .6, fontSize: 15, lineHeight: 1 }}>×</span>
        </div>
      )}

      {/* ═══ Loading ═══ */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#52525b' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#0ea5e9', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }`}</style>
          <div style={{ fontSize: 13 }}>Loading employees...</div>
        </div>
      )}

      {/* ═══ Employee List ═══ */}
      {!loading && (
        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden' }}>
          {/* List header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid #1f1f22', background: '#0d0d10' }}>
            <span style={{ width: 36, fontSize: 10, color: '#3f3f46', fontWeight: 700, textAlign: 'center' }}>#</span>
            <span style={{ flex: '1 1 180px', fontSize: 10, color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', paddingLeft: 4 }}>Employee</span>
            <span style={{ flex: '1 1 360px', fontSize: 10, color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Leave Balances</span>
            <span style={{ width: 80, fontSize: 10, color: '#3f3f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'center' }}>Action</span>
          </div>

          {filtered.length === 0
            ? <div style={{ textAlign: 'center', padding: 70, color: '#3f3f46', fontSize: 13 }}>No employees found</div>
            : filtered.map(({ e: emp, b: bal }, i) => {
                const id = emp._id || emp.id;
                const name = empName(emp);
                const code = emp.employee_code || emp.employee_id || emp.emp_id || '';
                const isSel = selId === id;
                return (
                  <div key={id} className="lm-row"
                    onClick={() => openModal({ e: emp, b: bal })}
                    style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #18181b', cursor: 'pointer', transition: 'all .15s',
                      background: isSel ? '#0c1929' : 'transparent', borderLeft: isSel ? '3px solid #0ea5e9' : '3px solid transparent' }}>

                    {/* # */}
                    <span style={{ width: 36, textAlign: 'center', fontSize: 11, color: '#3f3f46', fontWeight: 600 }}>{i + 1}</span>

                    {/* Employee info */}
                    <div style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 4 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `hsl(${(name.charCodeAt(0) * 37) % 360},50%,35%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '.02em' }}>
                        {empInit(emp)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#e4e4e7', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        {code && <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{code}</div>}
                      </div>
                    </div>

                    {/* Leave badges */}
                    <div style={{ flex: '1 1 360px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {LEAVES.map(lt => {
                        const tot  = v(bal, lt, 'total');
                        const used = v(bal, lt, 'used');
                        const rem  = v(bal, lt, 'remaining');
                        return (
                          <span key={lt.k} className="lm-badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                              background: rem > 0 ? lt.bg : '#18181b', color: rem > 0 ? lt.c : '#3f3f46',
                              border: `1px solid ${rem > 0 ? lt.dot + '30' : '#27272a'}`, transition: 'transform .12s, box-shadow .12s', cursor: 'default' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: rem > 0 ? lt.dot : '#3f3f46', flexShrink: 0 }} />
                            {lt.s} <b>{rem}</b><span style={{ color: '#3f3f46', fontWeight: 500 }}>/{tot}</span>
                          </span>
                        );
                      })}
                    </div>

                    {/* Manage button */}
                    <div style={{ width: 80, textAlign: 'center' }}>
                      <button className="lm-manage" onClick={e => { e.stopPropagation(); openModal({ e: emp, b: bal }); }}
                        style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid #1e3a5f', background: '#0c2d4a', color: '#38bdf8', fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', transition: 'all .15s', opacity: isSel ? 1 : 0.6 }}
                        onMouseEnter={ev => ev.currentTarget.style.background = '#1d4ed8'} onMouseLeave={ev => ev.currentTarget.style.background = '#0c2d4a'}>
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })
          }

          {/* Footer */}
          {filtered.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', borderTop: '1px solid #1f1f22', background: '#0d0d10' }}>
              <span style={{ fontSize: 11, color: '#3f3f46' }}>Showing {filtered.length} of {rows.length}</span>
              <div style={{ display: 'flex', gap: 12 }}>
                {LEAVES.map(lt => {
                  const tot = filtered.reduce((s, { b }) => s + v(b, lt, 'remaining'), 0);
                  return (
                    <span key={lt.k} style={{ fontSize: 11, color: '#52525b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: lt.dot }} />
                      {lt.s} <b style={{ color: lt.c, marginLeft: 2 }}>{tot}</b>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ CENTERED POPUP MODAL ═══════════════════ */}
      {sel && (
        <>
          {/* Backdrop */}
          <div onClick={closeModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', zIndex: 1000 }} />

          {/* Modal */}
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 620, maxWidth: '95vw', maxHeight: '90vh',
            background: '#0a0a0d', border: '1px solid #27272a', borderRadius: 16, zIndex: 1001,
            display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,.7)', animation: 'modalIn .2s ease' }}>
            <style>{`@keyframes modalIn { from { opacity:0; transform:translate(-50%,-50%) scale(.96); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }`}</style>

            {/* ── Modal Header ── */}
            <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: `hsl(${(empName(sel.e).charCodeAt(0) * 37) % 360},50%,35%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>
                    {empInit(sel.e)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.01em' }}>{empName(sel.e)}</div>
                    <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>{sel.e.employee_code || sel.e.employee_id || '—'}</div>
                  </div>
                </div>
                <button onClick={closeModal}
                  style={{ background: '#18181b', border: '1px solid #27272a', color: '#71717a', width: 34, height: 34, borderRadius: 8,
                    cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#27272a'} onMouseLeave={e => e.currentTarget.style.background = '#18181b'}>
                  ×
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 3, background: '#111113', borderRadius: 10, padding: 3, marginBottom: 0 }}>
                {[
                  { id: 'overview', label: 'Overview', icon: '◉' },
                  { id: 'allot', label: '+ Allot', icon: '' },
                  { id: 'deduct', label: '− Deduct', icon: '' },
                  { id: 'history', label: 'History', icon: '' },
                ].map(tab => (
                  <button key={tab.id} className="lm-tab"
                    onClick={() => {
                      setPanelTab(tab.id);
                      if (tab.id === 'allot' || tab.id === 'deduct') { setAType('earned'); setAQty(''); setAReason(''); setAErr(null); }
                      if (tab.id === 'history') loadHist(sel.e._id || sel.e.id);
                    }}
                    style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      background: panelTab === tab.id ? '#0ea5e9' : 'transparent', color: panelTab === tab.id ? '#fff' : '#52525b',
                      transition: 'all .15s' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#1f1f22', margin: '12px 0 0' }} />

            {/* ── Panel Body ── */}
            <div className="lm-panel" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>

              {/* ─── OVERVIEW TAB ─── */}
              {panelTab === 'overview' && (
                <>
                  {/* Leave balance cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
                    {LEAVES.map(lt => {
                      const b    = sel.b || {};
                      const tot  = parseFloat(b[`${lt.fp}_total`] ?? 0);
                      const used = parseFloat(b[`${lt.fp}_used`] ?? 0);
                      const rem  = parseFloat(b[`${lt.fp}_remaining`] ?? 0);
                      const pct  = tot > 0 ? Math.min((rem / tot) * 100, 100) : 0;
                      return (
                        <div key={lt.k} style={{ background: '#111113', border: '1px solid #1f1f22', borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                          {/* Top progress bar */}
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#1a1a1e' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${lt.dot}, ${lt.c})`, transition: 'width .5s ease', borderRadius: '0 2px 2px 0' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: lt.c, letterSpacing: '.04em' }}>{lt.s}</span>
                            <span style={{ fontSize: 9, color: '#3f3f46', fontWeight: 600 }}>{lt.l}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: 30, fontWeight: 900, color: rem > 0 ? lt.c : '#3f3f46', lineHeight: 1 }}>{rem}</span>
                            <span style={{ fontSize: 13, color: '#3f3f46', fontWeight: 500 }}>/ {tot}</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 6 }}>{used} used</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick EL allocation */}
                  <div style={{ background: '#111113', border: '1px solid #1f1f22', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9' }} />
                      Quick Earned Leave Allocation
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                      {[0.5, 1, 1.5, 2, 3, 5].map(n => (
                        <button key={n} className="lm-qbtn" onClick={() => quickEL(sel.e, n)} disabled={ql === selId}
                          style={{ padding: '10px 0', borderRadius: 8, border: '1px solid #1e3a5f', background: '#0c2d4a', color: '#38bdf8',
                            fontSize: 14, fontWeight: 800, cursor: ql === selId ? 'wait' : 'pointer', opacity: ql === selId ? .4 : 1,
                            transition: 'transform .12s, opacity .15s' }}>
                          +{n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="lm-action-btn" onClick={() => { setPanelTab('allot'); setAType('earned'); setAQty(''); setAReason(''); setAErr(null); }}
                      style={{ flex: 1, padding: '12px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13,
                        background: 'linear-gradient(135deg, #166534, #15803d)', color: '#4ade80', transition: 'filter .15s' }}>
                      + Allocate Leave
                    </button>
                    <button className="lm-action-btn" onClick={() => { setPanelTab('deduct'); setAType('earned'); setAQty(''); setAReason(''); setAErr(null); }}
                      style={{ flex: 1, padding: '12px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13,
                        background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', color: '#fca5a5', transition: 'filter .15s' }}>
                      − Deduct Leave
                    </button>
                  </div>
                </>
              )}

              {/* ─── ALLOT / DEDUCT TAB ─── */}
              {(panelTab === 'allot' || panelTab === 'deduct') && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                    {panelTab === 'allot' ? 'Allocate Leave' : 'Deduct Leave'}
                  </div>
                  <div style={{ fontSize: 12, color: '#52525b', marginBottom: 18 }}>
                    {panelTab === 'allot' ? 'Add leaves to' : 'Remove leaves from'} {empName(sel.e)}'s balance
                  </div>

                  {aErr && (
                    <div style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fca5a5', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, fontWeight: 600 }}>
                      ✗ {aErr}
                    </div>
                  )}

                  {/* Leave type picker */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Leave Type</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${LEAVES.length}, 1fr)`, gap: 6, marginBottom: 20 }}>
                    {LEAVES.map(lt => (
                      <button key={lt.k} onClick={() => setAType(lt.k)}
                        style={{ padding: '12px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
                          border: aType === lt.k ? `2px solid ${lt.dot}` : '2px solid #1f1f22',
                          background: aType === lt.k ? lt.bg : '#111113', color: aType === lt.k ? lt.c : '#52525b' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 2 }}>{lt.s}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, opacity: .7 }}>{lt.l}</div>
                      </button>
                    ))}
                  </div>

                  {/* Quantity */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Quantity</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {[0.5, 1, 1.5, 2, 3, 5].map(n => (
                      <button key={n} onClick={() => setAQty(String(n))}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .12s',
                          border: aQty === String(n) ? '2px solid #0ea5e9' : '2px solid #1f1f22',
                          background: aQty === String(n) ? '#0c3a5c' : '#111113', color: aQty === String(n) ? '#38bdf8' : '#52525b' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="0.5" step="0.5" value={aQty} onChange={e => setAQty(e.target.value)} placeholder="Or enter custom amount..."
                    style={{ width: '100%', background: '#111113', border: '1px solid #1f1f22', color: '#e4e4e7', padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 18, transition: 'border-color .15s' }}
                    onFocus={e => e.target.style.borderColor = '#27272a'} onBlur={e => e.target.style.borderColor = '#1f1f22'}
                  />

                  {/* Reason */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Reason <span style={{ color: '#ef4444' }}>*</span>
                  </div>
                  <textarea value={aReason} onChange={e => setAReason(e.target.value)} placeholder="Enter reason..." rows={3}
                    style={{ width: '100%', background: '#111113', border: '1px solid #1f1f22', color: '#e4e4e7', padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', marginBottom: 18, transition: 'border-color .15s' }}
                    onFocus={e => e.target.style.borderColor = '#27272a'} onBlur={e => e.target.style.borderColor = '#1f1f22'}
                  />

                  {/* Submit */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="lm-action-btn" onClick={() => doAction(panelTab)} disabled={aLoad}
                      style={{ flex: 1, padding: '12px 0', border: 'none', borderRadius: 8, cursor: aLoad ? 'wait' : 'pointer', fontWeight: 800, fontSize: 14, color: '#fff', opacity: aLoad ? .5 : 1, transition: 'filter .15s, opacity .15s',
                        background: panelTab === 'allot' ? 'linear-gradient(135deg, #166534, #15803d)' : 'linear-gradient(135deg, #7f1d1d, #991b1b)' }}>
                      {aLoad ? 'Processing...' : panelTab === 'allot' ? '+ Allocate' : '− Deduct'}
                    </button>
                    <button onClick={() => setPanelTab('overview')}
                      style={{ padding: '12px 20px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#71717a', transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#27272a'} onMouseLeave={e => e.currentTarget.style.background = '#18181b'}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ─── HISTORY TAB ─── */}
              {panelTab === 'history' && (
                histLoad
                  ? <div style={{ textAlign: 'center', padding: 60, color: '#52525b' }}>
                      <div style={{ width: 24, height: 24, border: '3px solid #27272a', borderTopColor: '#0ea5e9', borderRadius: '50%', margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
                      Loading history...
                    </div>
                  : hist.length === 0
                    ? <div style={{ textAlign: 'center', padding: 60, color: '#3f3f46' }}>
                        <div style={{ fontSize: 32, marginBottom: 8, opacity: .3 }}>📋</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>No history found</div>
                        <div style={{ fontSize: 11, color: '#27272a', marginTop: 4 }}>Leave transactions will appear here</div>
                      </div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {hist.map((h, i) => {
                          const qty = parseFloat(h.quantity ?? h.amount ?? 0);
                          const isA = (h.action || h.transaction_type || '').toLowerCase().includes('alloc') || qty > 0;
                          const lt  = LEAVES.find(l => l.k === h.leave_type) || LEAVES[0];
                          return (
                            <div key={h._id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#111113', border: '1px solid #1f1f22', borderRadius: 8, borderLeft: `3px solid ${isA ? '#22c55e' : '#ef4444'}` }}>
                              <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}>
                                <span style={{ fontWeight: 900, color: isA ? '#22c55e' : '#ef4444', fontSize: 16 }}>{isA ? '+' : '−'}{Math.abs(qty)}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isA ? '#052e16' : '#450a0a', color: isA ? '#4ade80' : '#fca5a5' }}>
                                    {isA ? 'Allocated' : 'Deducted'}
                                  </span>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: lt.bg, color: lt.c }}>{lt.s}</span>
                                </div>
                                <div style={{ fontSize: 12, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {h.reason || h.note || '—'}
                                </div>
                              </div>
                              <div style={{ fontSize: 10, color: '#3f3f46', textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                {fmt(h.created_at || h.timestamp || h.date)}
                              </div>
                            </div>
                          );
                        })}
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

