import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const BASE = '/api';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const uid = () => { try { const u = JSON.parse(localStorage.getItem('userData') || 'null'); return u?.user_id || u?._id || ''; } catch { return ''; } };
const fmt = d => { if (!d) return '—'; try { return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return String(d); } };
const empName = e => `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown';
const empInit = e => empName(e).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const LT = [
  { k: 'earned', l: 'Earned Leave', s: 'EL', c: '#60a5fa', bg: '#172554', fp: 'earned_leaves' },
  { k: 'paid',   l: 'Paid Leave',   s: 'PL', c: '#4ade80', bg: '#14532d', fp: 'paid_leaves' },
  { k: 'grace',  l: 'Grace Leave',  s: 'GR', c: '#c084fc', bg: '#3b0764', fp: 'grace_leaves' },
  { k: 'sick',   l: 'Sick Leave',   s: 'SL', c: '#fbbf24', bg: '#451a03', fp: 'sick_leaves' },
  { k: 'casual', l: 'Casual Leave', s: 'CL', c: '#22d3ee', bg: '#164e63', fp: 'casual_leaves' },
];
const TLT = LT.filter(x => ['earned', 'paid', 'grace'].includes(x.k));

/* ══════════════════════════ COMPONENT ══════════════════════════ */
const PaidLeaveManagement = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const [rows, setRows]   = useState([]);
  const [depts, setDepts] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState(null);
  const [ok, setOk]       = useState(null);
  const [q, setQ]         = useState('');

  const [sel, setSel]           = useState(null); // selected emp for detail
  const [detailTab, setDetailTab] = useState('bal');
  const [hist, setHist]         = useState([]);
  const [histLoad, setHistLoad] = useState(false);

  const [act, setAct]           = useState(null); // {emp, mode}
  const [aType, setAType]       = useState('earned');
  const [aQty, setAQty]         = useState('');
  const [aReason, setAReason]   = useState('');
  const [aLoad, setALoad]       = useState(false);

  const [ql, setQl] = useState(null); // quick loading empId
  const [grace, setGrace] = useState({ limit: 0 });

  useEffect(() => { loadDepts(); loadGrace(); }, []);
  useEffect(() => { load(); }, [month, year]);

  const loadGrace = async () => {
    try { const r = await axios.get(`${BASE}/settings/attendance-settings`, { params: { user_id: uid() } }); const d = r.data?.data || r.data || {}; setGrace({ limit: d.grace_usage_limit ?? 0 }); } catch {}
  };
  const loadDepts = async () => {
    try { const r = await axios.get(`${BASE}/departments/?user_id=${uid()}`); const a = Array.isArray(r.data) ? r.data : []; const m = {}; a.forEach(d => { m[d._id] = d.name; }); setDepts(m); } catch {}
  };
  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await axios.get(`${BASE}/users/?user_id=${uid()}`);
      const list = (Array.isArray(r.data) ? r.data : r.data.users || r.data.data || []).filter(e => e.is_employee !== false);
      const bals = await Promise.allSettled(list.map(e => axios.get(`${BASE}/settings/leave-balance/${e._id || e.id}?user_id=${uid()}`).then(r => r.data?.data || null)));
      setRows(list.map((e, i) => ({ e, b: bals[i].status === 'fulfilled' ? bals[i].value : null })));
    } catch (x) { setErr('Load failed: ' + (x.response?.data?.detail || x.message)); }
    finally { setLoading(false); }
  };
  const loadHist = async id => {
    setHistLoad(true);
    try { const r = await axios.get(`${BASE}/settings/leave-balance/history/${id}?user_id=${uid()}`); setHist(Array.isArray(r.data) ? r.data : []); } catch { setHist([]); }
    finally { setHistLoad(false); }
  };

  const doAction = async () => {
    if (!act || !aQty || !aReason.trim()) { setErr('Fill all fields'); return; }
    setALoad(true); setErr(null);
    try {
      const ep = act.mode === 'allot' ? 'allocate' : 'deduct';
      await axios.post(`${BASE}/settings/leave-balance/${ep}?user_id=${uid()}`, { employee_id: act.emp._id || act.emp.id, leave_type: aType, quantity: parseFloat(aQty), reason: aReason.trim() });
      flash(`${act.mode === 'allot' ? 'Allocated' : 'Deducted'} ${aQty} ${aType} leave`);
      setAct(null); setAQty(''); setAReason(''); load();
      if (sel) loadHist(sel.e._id || sel.e.id);
    } catch (x) { setErr(x.response?.data?.detail || 'Failed'); }
    finally { setALoad(false); }
  };

  const quickEL = async (emp, amt) => {
    const id = emp._id || emp.id; setQl(id);
    try {
      await axios.post(`${BASE}/settings/leave-balance/allocate?user_id=${uid()}`, { employee_id: id, leave_type: 'earned', quantity: amt, reason: `Quick EL: ${amt === 1 ? 'Full day' : 'Half day'}` });
      flash(`+${amt} EL → ${empName(emp)}`); load();
    } catch (x) { setErr(x.response?.data?.detail || 'Failed'); setTimeout(() => setErr(null), 3000); }
    finally { setQl(null); }
  };

  const flash = msg => { setOk(msg); setTimeout(() => setOk(null), 3000); };
  const dept = e => e.department_name || e.department || depts[e.department_id] || '—';
  const v = (b, lt, f) => parseFloat(b?.[`${lt.fp}_${f}`] ?? 0);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const filtered = useMemo(() => rows.filter(({ e }) => {
    const s = q.toLowerCase();
    return `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(s) ||
      (e.employee_code || e.employee_id || e.emp_id || '').toLowerCase().includes(s) ||
      dept(e).toLowerCase().includes(s);
  }), [rows, q, depts]);

  const openDetail = row => { setSel(row); setDetailTab('bal'); loadHist(row.e._id || row.e.id); };
  const openAct = (emp, mode) => { setAct({ emp, mode }); setAType('earned'); setAQty(''); setAReason(''); setErr(null); };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", minHeight: '60vh' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#e2e8f0', letterSpacing: -0.5 }}>Leave Management</h2>
          <span style={{ fontSize: 11, color: '#64748b', background: '#1e293b', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input placeholder="Search..." value={q} onChange={e => setQ(e.target.value)}
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '7px 12px', borderRadius: 8, fontSize: 13, outline: 'none', width: 160 }} />
          <select value={month} onChange={e => setMonth(+e.target.value)} style={selSt}>
            {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} style={selSt}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} style={{ background: '#4f46e5', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↻</button>
        </div>
      </div>

      {/* ── Defaults badge row ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Pill color="#60a5fa" bg="#172554">EL default: 0</Pill>
        <Pill color="#4ade80" bg="#14532d">PL default: 1</Pill>
        <span style={{ color: '#475569', fontSize: 11 }}>·</span>
        <Pill color="#93c5fd" bg="#1e3a5f">EL +0.5 half</Pill>
        <Pill color="#93c5fd" bg="#1e40af">EL +1 full</Pill>
      </div>

      {/* ── Alerts ── */}
      {ok && <Alert type="ok" msg={ok} onClose={() => setOk(null)} />}
      {err && !act && <Alert type="err" msg={err} onClose={() => setErr(null)} />}

      {loading && <div style={{ textAlign: 'center', padding: 50, color: '#64748b', fontSize: 13 }}>Loading...</div>}

      {/* ═══════════════════════ TABLE ═══════════════════════ */}
      {!loading && filtered.length > 0 && (
        <div style={{ background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, lineHeight: 1.4 }}>
              <thead>
                <tr>
                  <TH w={42} align="center">#</TH>
                  <TH w={220} align="left">Employee</TH>
                  {TLT.map(lt => <TH key={lt.k} w={90} align="center">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: lt.c }} />{lt.s}
                    </span>
                  </TH>)}
                  <TH w={90} align="center">Quick EL</TH>
                  <TH w={160} align="center">Actions</TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ e: emp, b: bal }, i) => {
                  const id = emp._id || emp.id;
                  const name = empName(emp);
                  const code = emp.employee_code || emp.employee_id || emp.emp_id || '';
                  const isQL = ql === id;

                  return (
                    <tr key={id}
                      onClick={() => openDetail({ e: emp, b: bal })}
                      style={{ background: i % 2 === 0 ? '#111827' : '#0f172a', cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={ev => ev.currentTarget.style.background = '#1e293b'}
                      onMouseLeave={ev => ev.currentTarget.style.background = i % 2 === 0 ? '#111827' : '#0f172a'}
                    >
                      {/* # */}
                      <td style={{ ...td, textAlign: 'center', color: '#475569', fontSize: 11, fontWeight: 600 }}>{i + 1}</td>

                      {/* Employee */}
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                            background: `hsl(${(name.charCodeAt(0) * 37) % 360}, 55%, 45%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, color: '#fff',
                          }}>{empInit(emp)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                              {code && <span style={{ marginRight: 6 }}>{code}</span>}
                              <span>{dept(emp)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Leave columns */}
                      {TLT.map(lt => {
                        const isG = lt.k === 'grace';
                        const tot = isG ? grace.limit : v(bal, lt, 'total');
                        const used = v(bal, lt, 'used');
                        const rem = isG ? Math.max(tot - used, 0) : v(bal, lt, 'remaining');
                        return (
                          <td key={lt.k} style={{ ...td, textAlign: 'center' }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: lt.c }}>{rem}</span>
                            <span style={{ fontSize: 10, color: '#475569', marginLeft: 3 }}>/ {tot}</span>
                          </td>
                        );
                      })}

                      {/* Quick EL */}
                      <td style={{ ...td, textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 3 }}>
                          <MiniBtn onClick={() => quickEL(emp, 0.5)} disabled={isQL} c="#3b82f6" bg="#172554">+.5</MiniBtn>
                          <MiniBtn onClick={() => quickEL(emp, 1)} disabled={isQL} c="#60a5fa" bg="#1e40af">+1</MiniBtn>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ ...td, textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <ActBtn onClick={() => openAct(emp, 'allot')} bg="#059669" hbg="#047857">Allot</ActBtn>
                          <ActBtn onClick={() => openAct(emp, 'deduct')} bg="#dc2626" hbg="#b91c1c">Deduct</ActBtn>
                          <ActBtn onClick={() => openDetail({ e: emp, b: bal })} bg="#4f46e5" hbg="#4338ca">View</ActBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Table footer ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #1e293b', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#475569' }}>{filtered.length} of {rows.length}</span>
            <div style={{ display: 'flex', gap: 14 }}>
              {TLT.map(lt => {
                const tot = lt.k === 'grace'
                  ? filtered.reduce((s, { b }) => s + Math.max(grace.limit - v(b, lt, 'used'), 0), 0)
                  : filtered.reduce((s, { b }) => s + v(b, lt, 'remaining'), 0);
                return <span key={lt.k} style={{ fontSize: 11, color: '#64748b' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: lt.c, display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
                  {lt.s}: <b style={{ color: lt.c }}>{tot}</b>
                </span>;
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 50, color: '#475569' }}>
          <p style={{ fontSize: 14, fontWeight: 600 }}>No employees found</p>
        </div>
      )}

      {/* ═══════════════ DETAIL MODAL ═══════════════ */}
      {sel && (
        <Overlay close={() => setSel(null)}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,.5)' }}>
            {/* header */}
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `hsl(${(empName(sel.e).charCodeAt(0) * 37) % 360}, 55%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>{empInit(sel.e)}</div>
                  <div>
                    <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>{empName(sel.e)}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sel.e.employee_code || sel.e.employee_id || '—'} · {dept(sel.e)}</div>
                  </div>
                </div>
                <XBtn onClick={() => setSel(null)} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
                <TabBtn active={detailTab === 'bal'} onClick={() => setDetailTab('bal')}>Balance</TabBtn>
                <TabBtn active={detailTab === 'hist'} onClick={() => { setDetailTab('hist'); loadHist(sel.e._id || sel.e.id); }}>History</TabBtn>
              </div>
            </div>

            {/* body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              {detailTab === 'bal' && <>
                {/* balance grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
                  {LT.map(lt => {
                    const b = sel.b || {};
                    const tot = lt.k === 'grace' ? grace.limit : parseFloat(b[`${lt.fp}_total`] ?? 0);
                    const used = parseFloat(b[`${lt.fp}_used`] ?? 0);
                    const rem = lt.k === 'grace' ? Math.max(tot - used, 0) : parseFloat(b[`${lt.fp}_remaining`] ?? 0);
                    const pct = tot > 0 ? Math.min((rem / tot) * 100, 100) : 0;
                    return (
                      <div key={lt.k} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '14px 12px', borderLeft: `3px solid ${lt.c}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: lt.c }}>{lt.s}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>{lt.l}</span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: lt.c, lineHeight: 1 }}>{rem}</div>
                        <div style={{ width: '100%', height: 3, background: '#1e293b', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: lt.c, borderRadius: 2, transition: 'width .3s' }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Used {used} of {tot}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick EL */}
                <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 10, padding: '14px 16px', marginBottom: 14, borderLeft: '3px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>Quick EL Allocation</span>
                    <span style={{ fontSize: 10, color: '#475569' }}>1 = full day · 0.5 = half day</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => quickEL(sel.e, 0.5)} disabled={ql === (sel.e._id || sel.e.id)}
                      style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid #3b82f6', background: '#172554', color: '#93c5fd', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>+0.5 Half Day</button>
                    <button onClick={() => quickEL(sel.e, 1)} disabled={ql === (sel.e._id || sel.e.id)}
                      style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid #2563eb', background: '#1e40af', color: '#bfdbfe', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>+1 Full Day</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openAct(sel.e, 'allot')}
                    style={{ flex: 1, padding: 11, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#fff', background: '#059669' }}>+ Allocate</button>
                  <button onClick={() => openAct(sel.e, 'deduct')}
                    style={{ flex: 1, padding: 11, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#fff', background: '#dc2626' }}>− Deduct</button>
                </div>
              </>}

              {detailTab === 'hist' && <>
                {histLoad ? <p style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Loading...</p>
                : hist.length === 0 ? <p style={{ textAlign: 'center', padding: 30, color: '#475569', fontWeight: 600 }}>No history</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {hist.map((h, i) => {
                      const qty = parseFloat(h.quantity ?? h.amount ?? 0);
                      const isA = (h.action || h.transaction_type || '').toLowerCase().includes('alloc') || qty > 0;
                      const lt = LT.find(l => l.k === h.leave_type) || LT[0];
                      return (
                        <div key={h._id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#111827', border: '1px solid #1e293b', borderRadius: 8, borderLeft: `3px solid ${isA ? '#10b981' : '#ef4444'}` }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isA ? '#10b981' : '#ef4444', width: 36, textAlign: 'center' }}>
                            {isA ? '+' : '−'}{Math.abs(qty)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: isA ? '#6ee7b7' : '#fca5a5', background: isA ? '#064e3b' : '#7f1d1d', padding: '1px 6px', borderRadius: 3 }}>{isA ? 'Alloc' : 'Deduct'}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: lt.c, background: lt.bg, padding: '1px 6px', borderRadius: 3 }}>{lt.s}</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.reason || h.note || '—'}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{fmt(h.created_at || h.timestamp || h.date)}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{h.performed_by_name || h.created_by_name || '—'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                }
              </>}
            </div>
          </div>
        </Overlay>
      )}

      {/* ═══════════════ ALLOCATE / DEDUCT MODAL ═══════════════ */}
      {act && (
        <Overlay close={() => { setAct(null); setErr(null); }} z={1100}>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 22, width: 420, maxWidth: '95vw', boxShadow: '0 25px 50px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>
                {act.mode === 'allot' ? 'Allocate Leave' : 'Deduct Leave'}
              </h3>
              <XBtn onClick={() => { setAct(null); setErr(null); }} />
            </div>

            {/* emp info */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: `hsl(${(empName(act.emp).charCodeAt(0) * 37) % 360}, 55%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>{empInit(act.emp)}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>{empName(act.emp)}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>{act.emp.employee_code || ''} · {dept(act.emp)}</div>
              </div>
            </div>

            {err && <div style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{err}</div>}

            {/* leave type */}
            <label style={lbl}>Leave Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 14 }}>
              {LT.map(lt => (
                <button key={lt.k} onClick={() => setAType(lt.k)}
                  style={{
                    padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                    border: aType === lt.k ? `2px solid ${lt.c}` : '2px solid #1e293b',
                    background: aType === lt.k ? lt.bg : '#111827',
                    color: aType === lt.k ? lt.c : '#64748b',
                  }}>{lt.l}</button>
              ))}
            </div>

            {/* quantity */}
            <label style={lbl}>Quantity</label>
            {aType === 'earned' && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {[0.5, 1, 1.5, 2, 3, 5].map(n => (
                  <button key={n} onClick={() => setAQty(String(n))}
                    style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: aQty === String(n) ? '2px solid #3b82f6' : '2px solid #1e293b',
                      background: aQty === String(n) ? '#172554' : '#111827',
                      color: aQty === String(n) ? '#93c5fd' : '#475569',
                    }}>{n}</button>
                ))}
              </div>
            )}
            <input type="number" min="0.5" step="0.5" value={aQty} onChange={e => setAQty(e.target.value)} placeholder="e.g. 1 or 0.5" style={inp} />

            {/* reason */}
            <label style={{ ...lbl, marginTop: 12 }}>Reason <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea value={aReason} onChange={e => setAReason(e.target.value)} placeholder="Enter reason..." rows={3} style={{ ...inp, resize: 'none' }} />

            {/* buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={doAction} disabled={aLoad}
                style={{
                  flex: 1, padding: 11, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13, color: '#fff',
                  background: act.mode === 'allot' ? '#059669' : '#dc2626', opacity: aLoad ? .5 : 1,
                }}>{aLoad ? 'Processing...' : act.mode === 'allot' ? '+ Allocate' : '− Deduct'}</button>
              <button onClick={() => { setAct(null); setErr(null); }}
                style={{ flex: 1, padding: 11, background: '#1e293b', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#94a3b8' }}>Cancel</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
};

/* ════════════ MICRO COMPONENTS ════════════ */
const Pill = ({ color, bg, children }) => (
  <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: '3px 8px', borderRadius: 4 }}>{children}</span>
);

const Alert = ({ type, msg, onClose }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, marginBottom: 10, fontSize: 12, fontWeight: 600,
    background: type === 'ok' ? '#052e16' : '#450a0a', border: `1px solid ${type === 'ok' ? '#16a34a' : '#dc2626'}`, color: type === 'ok' ? '#86efac' : '#fca5a5',
  }}>
    <span>{type === 'ok' ? '✓' : '✗'} {msg}</span>
    <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1, marginLeft: 8 }}>×</span>
  </div>
);

const TH = ({ children, w, align = 'left' }) => (
  <th style={{
    padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em',
    textAlign: align, whiteSpace: 'nowrap', borderBottom: '1px solid #1e293b', background: '#0f172a',
    ...(w ? { minWidth: w, width: w } : {}),
  }}>{children}</th>
);

const MiniBtn = ({ children, onClick, disabled, c, bg }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ padding: '3px 7px', borderRadius: 4, border: `1px solid ${c}`, background: bg, color: c, fontSize: 10, fontWeight: 800, cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? .4 : 1, lineHeight: 1.3 }}>
    {children}
  </button>
);

const ActBtn = ({ children, onClick, bg, hbg }) => {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: '4px 9px', borderRadius: 5, border: 'none', background: hov ? hbg : bg, color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'background .1s' }}>
      {children}
    </button>
  );
};

const Overlay = ({ children, close, z = 1000 }) => (
  <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: z, padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>
  </div>
);

const XBtn = ({ onClick }) => (
  <button onClick={onClick}
    style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}>×</button>
);

const TabBtn = ({ active, onClick, children }) => (
  <button onClick={onClick}
    style={{ padding: '7px 18px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: active ? '#4f46e5' : '#1e293b', color: active ? '#fff' : '#94a3b8' }}>
    {children}
  </button>
);

/* ════════════ STYLE TOKENS ════════════ */
const td = { padding: '10px 12px', borderBottom: '1px solid #1e293b', verticalAlign: 'middle' };
const selSt = { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '7px 10px', borderRadius: 8, fontSize: 12, outline: 'none', cursor: 'pointer' };
const lbl = { display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 };
const inp = { width: '100%', background: '#111827', border: '1.5px solid #1e293b', color: '#f1f5f9', padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' };

export default PaidLeaveManagement;
