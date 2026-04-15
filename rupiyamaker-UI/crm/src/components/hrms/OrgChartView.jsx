import React, { useState, useEffect, useCallback } from 'react';
import hrmsService from '../../services/hrmsService';
import { getProfilePictureUrlWithCacheBusting } from '../../utils/mediaUtils';

// ─── Inject CSS once ────────────────────────────────────────────────────────
(() => {
    if (typeof document === 'undefined' || document.getElementById('oc3-css')) return;
    const s = document.createElement('style');
    s.id = 'oc3-css';
    s.textContent = `
  /* Siblings horizontal connector */
  .oc3-level { display:flex; align-items:flex-start; justify-content:center; flex-wrap:nowrap; }
  .oc3-item  { display:flex; flex-direction:column; align-items:center; position:relative; padding:0 8px; }
  .oc3-level:not(.one) > .oc3-item::before,
  .oc3-level:not(.one) > .oc3-item::after {
    content:''; position:absolute; top:0; height:2px; width:50%; background:#2d333b;
  }
  .oc3-level:not(.one) > .oc3-item::before { right:50%; }
  .oc3-level:not(.one) > .oc3-item::after  { left:50%; }
  .oc3-level:not(.one) > .oc3-item:first-child::before { display:none; }
  .oc3-level:not(.one) > .oc3-item:last-child::after   { display:none; }

  /* Vertical bar */
  .oc3-vbar { width:2px; background:#2d333b; flex-shrink:0; height:20px; }

  /* Role card */
  .oc3-card {
    background:#0d1117; border:1.5px solid #21262d; border-left-width:3px;
    border-radius:10px; min-width:160px; max-width:220px; width:max-content;
    cursor:pointer;
    transition: border-color .2s, box-shadow .15s, transform .15s;
    user-select:none;
  }
  .oc3-card:hover      { border-color:#4493f8 !important; box-shadow:0 0 0 3px rgba(68,147,248,.12); transform:translateY(-1px); }
  .oc3-card.sup        { border-color:rgba(245,158,11,.45) !important; }
  .oc3-card.sup:hover  { border-color:#f59e0b !important; box-shadow:0 0 0 3px rgba(245,158,11,.15); }
  .oc3-card:focus-visible { outline:2px solid #4493f8; outline-offset:2px; }

  /* Member list — shows all members, no scroll limit */
  .oc3-mlist { border-top:1px solid #21262d; }
  @keyframes oc3-in { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .oc3-mlist { animation:oc3-in .15s ease; }

  /* Spinner */
  @keyframes oc3-spin { to{transform:rotate(360deg)} }
  .oc3-spinner { width:34px;height:34px;border:3px solid #21262d;border-top-color:#4493f8;border-radius:50%;animation:oc3-spin .8s linear infinite; }

  /* Toolbar btns */
  .oc3-btn:hover { background:#21262d !important; color:#c9d1d9 !important; }
`;
    document.head.appendChild(s);
})();

// ─── Pure helpers ───────────────────────────────────────────────────────────
const isSuper  = (r) => (r.permissions || []).some(p => p.page === '*' || p.actions === '*' || p === '*');
const initials = (f = '', l = '') => `${f[0] || ''}${l[0] || ''}`.toUpperCase() || '?';
const PALETTE  = ['#818cf8','#a78bfa','#f472b6','#fb923c','#34d399','#60a5fa','#f87171','#2dd4bf','#e879f9'];
const clr      = (i) => PALETTE[i % PALETTE.length];

/** Build tree: role.reporting_ids contains parent role IDs (this role REPORTS TO them). */
const buildTree = (roles) => {
    const map = {};
    roles.forEach(r => { map[r.id] = { role: r, children: [] }; });
    const roots = [];
    const seenRoots = new Set();

    roles.forEach(r => {
        const pids = (r.reporting_ids || []).map(String);
        if (!pids.length) {
            if (!seenRoots.has(r.id)) { roots.push(map[r.id]); seenRoots.add(r.id); }
        } else {
            pids.forEach(pid => {
                if (map[pid]) {
                    if (!map[pid].children.find(c => c.role.id === r.id)) map[pid].children.push(map[r.id]);
                } else {
                    if (!seenRoots.has(r.id)) { roots.push(map[r.id]); seenRoots.add(r.id); }
                }
            });
        }
    });

    const sort = arr => {
        arr.sort((a, b) => {
            if (isSuper(a.role) !== isSuper(b.role)) return isSuper(a.role) ? -1 : 1;
            return a.role.name.localeCompare(b.role.name);
        });
        arr.forEach(n => sort(n.children));
        return arr;
    };
    return sort(roots);
};

// ─── Avatar circle ──────────────────────────────────────────────────────────
const Av = ({ emp, idx, size }) => {
    const [err, setErr] = useState(false);
    const url = !err ? getProfilePictureUrlWithCacheBusting(emp.profile_picture || emp.photo) : null;
    const S = size || 32;
    return (
        <div style={{
            width: S, height: S, borderRadius: '50%', flexShrink: 0,
            background: url ? 'transparent' : clr(idx),
            border: '2px solid #0d1117',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: S * 0.33, fontWeight: 700, color: '#fff',
        }}>
            {url
                ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErr(true)} />
                : initials(emp.first_name, emp.last_name)
            }
        </div>
    );
};

// ─── Member row in the expanded list ───────────────────────────────────────
const MemberRow = ({ emp, idx }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 12px',
        borderBottom: '1px solid #161b22',
        background: idx % 2 ? 'rgba(255,255,255,.025)' : 'transparent',
    }}>
        <Av emp={emp} idx={idx} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '.83rem', fontWeight: 700, color: '#e6edf3', marginBottom: 1 }}>
                {`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'}
            </div>
            <div style={{ fontSize: '.74rem', color: '#a0aec0', marginBottom: 4 }}>
                {emp.designation || emp.position || '—'}
            </div>
            <div style={{
                display: 'inline-block', fontSize: '.68rem', fontWeight: 700,
                color: '#60a5fa', background: 'rgba(96,165,250,.1)',
                border: '1px solid rgba(96,165,250,.25)', borderRadius: 4,
                padding: '1px 6px', fontFamily: 'monospace', letterSpacing: '.03em',
            }}>
                RM{String(emp.employee_id || '').padStart(3, '0')}
            </div>
        </div>
    </div>
);

// ─── Single role node (recursive) ──────────────────────────────────────────
const RoleNode = ({ node, allEmployees }) => {
    const { role, children } = node;
    const sup    = isSuper(role);
    const accent = sup ? '#f59e0b' : '#4493f8';
    const rEmps  = allEmployees.filter(e => String(e.role_id) === String(role.id));
    const [open, setOpen] = useState(false);  // member list toggle

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {/* ── Role Card ─────────────────────────────────────────── */}
            <div
                className={`oc3-card${sup ? ' sup' : ''}`}
                style={{ borderLeftColor: accent }}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => rEmps.length > 0 && setOpen(v => !v)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rEmps.length > 0 && setOpen(v => !v); } }}
            >
                {/* Card top: role name */}
                <div style={{ padding: '9px 12px 7px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                        {sup && <span style={{ fontSize: '.85rem' }}>👑</span>}
                        <div style={{
                            fontSize: '.77rem', fontWeight: 800,
                            color: sup ? '#f59e0b' : '#e6edf3',
                            textTransform: 'uppercase', letterSpacing: '.04em',
                            lineHeight: 1.3, wordBreak: 'break-word',
                        }}>
                            {role.name}
                        </div>
                    </div>

                    {/* Member count badge */}
                    {rEmps.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: sup ? 'rgba(245,158,11,.12)' : 'rgba(68,147,248,.1)',
                                border: `1px solid ${sup ? 'rgba(245,158,11,.3)' : 'rgba(68,147,248,.25)'}`,
                                borderRadius: 20, padding: '3px 9px',
                            }}>
                                <span style={{ fontSize: '.72rem' }}>👥</span>
                                <span style={{ fontSize: '.75rem', fontWeight: 700, color: accent }}>
                                    {rEmps.length} {rEmps.length === 1 ? 'Member' : 'Members'}
                                </span>
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: '.72rem', color: accent }}>
                                {open ? '▲' : '▼'}
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '.7rem', color: '#464f5a', fontStyle: 'italic' }}>No members</div>
                    )}
                </div>

                {/* Member list — expands inside card on click */}
                {open && rEmps.length > 0 && (
                    <div className="oc3-mlist">
                        {rEmps.map((e, i) => <MemberRow key={e._id || i} emp={e} idx={i} />)}
                    </div>
                )}
            </div>
            {/* ── END Card ──────────────────────────────────────────── */}

            {/* ── Connector to children — always visible, no +/- dot ─ */}
            {children.length > 0 && (
                <>
                    <div className="oc3-vbar" />
                    <div className={`oc3-level${children.length === 1 ? ' one' : ''}`}>
                        {children.map(c => (
                            <div key={c.role.id} className="oc3-item">
                                <div className="oc3-vbar" />
                                <RoleNode node={c} allEmployees={allEmployees} />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ─── Stat chip ──────────────────────────────────────────────────────────────
const Stat = ({ num, label }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#e6edf3', lineHeight: 1 }}>{num}</span>
        <span style={{ fontSize: '.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
    </div>
);

// ─── Main export ────────────────────────────────────────────────────────────
const OrgChartView = () => {
    const [roles,     setRoles]     = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(null);
    const [search,    setSearch]    = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [rr, er] = await Promise.all([hrmsService.getRoles(), hrmsService.getAllEmployees()]);

            const INACTIVE = [false, 'false', 'inactive', 'Inactive', 0, '0'];
            setRoles(
                (Array.isArray(rr?.data) ? rr.data : []).map(r => ({
                    ...r,
                    id: String(r.id || r._id || ''),
                    reporting_ids: (r.reporting_ids || (r.reporting_id ? [r.reporting_id] : [])).map(String),
                }))
            );
            setEmployees(
                (Array.isArray(er?.data) ? er.data : []).filter(e => !INACTIVE.includes(e.employee_status))
            );
        } catch {
            setError('Failed to load. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filteredEmps = search.trim()
        ? employees.filter(e => {
            const q = search.toLowerCase();
            return `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(q)
                || (e.designation || '').toLowerCase().includes(q)
                || String(e.employee_id || '').includes(q);
        })
        : employees;

    const tree = buildTree(roles);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, background: '#000', gap: 14 }}>
            <div className="oc3-spinner" />
            <span style={{ color: '#8b949e', fontSize: '.95rem' }}>Building org chart…</span>
        </div>
    );

    if (error) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, background: '#000', gap: 14 }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <span style={{ color: '#ef4444' }}>{error}</span>
            <button onClick={load} style={{ padding: '.45rem 1.4rem', background: '#4493f8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '.9rem' }}>
                Retry
            </button>
        </div>
    );

    return (
        <div style={{ background: '#000', minHeight: '100%' }}>

            {/* ── Toolbar ───────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
                padding: '13px 20px', background: '#0d1117',
                borderBottom: '1px solid #21262d',
                position: 'sticky', top: 0, zIndex: 20,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <Stat num={filteredEmps.length} label="Active Members" />
                    <div style={{ width: 1, height: 28, background: '#21262d' }} />
                    <Stat num={roles.length} label="Total Roles" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#64748b' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
                        </svg>
                        <input
                            type="text" value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search member…"
                            aria-label="Search members"
                            style={{ background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 8, padding: '.42rem .9rem .42rem 2rem', fontSize: '.88rem', width: 195, outline: 'none' }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '1rem', padding: 0, lineHeight: 1 }}>×</button>
                        )}
                    </div>
                    <button className="oc3-btn" onClick={load} style={{ padding: '.42rem 1rem', background: '#161b22', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, cursor: 'pointer', fontSize: '.83rem' }}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ── Legend ─────────────────────────────────────────────── */}
            <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', borderBottom: '1px solid #161b22' }}>
                {[['#f59e0b', 'Super Admin'], ['#4493f8', 'Other Roles']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.73rem', color: '#64748b' }}>
                        <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                        {l}
                    </div>
                ))}
                <span style={{ fontSize: '.73rem', color: '#464f5a' }}>
                    Click role card to view members · Click <b style={{ color: '#8b949e' }}>＋/−</b> to expand/collapse sub-roles
                </span>
            </div>

            {/* ── Chart canvas ────────────────────────────────────────── */}
            <div style={{ overflowX: 'auto', padding: '28px 32px 56px', background: '#000' }}>
                {tree.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#464f5a', padding: '60px 0' }}>
                        <div style={{ fontSize: '3rem', opacity: .3, marginBottom: 12 }}>🏢</div>
                        <div>No roles found. Create roles to build the org chart.</div>
                    </div>
                ) : tree.length === 1 ? (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <RoleNode node={tree[0]} allEmployees={filteredEmps} />
                    </div>
                ) : (
                    <div className="oc3-level">
                        {tree.map(n => (
                            <div key={n.role.id} className="oc3-item">
                                <RoleNode node={n} allEmployees={filteredEmps} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrgChartView;
