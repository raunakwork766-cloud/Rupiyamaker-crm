import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ALL_AGENTS, proc, toSec, hms, hmShort, fmtDate, MAX_WU_SEC, MAX_BRK_SEC } from '../data';
import { fetchWithAuth } from '../utils/auth';
import { getCurrentUser } from '../utils/auth';

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_DATES = [...new Set(ALL_AGENTS.map(a => a.date))].sort();
const LATEST_DATE = ALL_DATES[ALL_DATES.length - 1];

// ── IST date-time formatter ───────────────────────────────────────────────────
const fmtIST = (isoStr) => {
    if (!isoStr) return '—';
    try {
        // Backend stores UTC; force UTC parse then display in IST
        const s = String(isoStr).replace(' ', 'T');
        const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
        if (isNaN(d)) return isoStr;
        return d.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        });
    } catch { return isoStr; }
};

// ── Mini Components ────────────────────────────────────────────────────────────
function WaBtn({ text }) {
    const [done, setDone] = useState(false);
    return (
        <button
            onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800); })}
            className={`w-7 h-7 rounded-full text-sm flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-green-800' : 'bg-[#25d366] hover:bg-[#1aa756] hover:scale-110'}`}
        >{done ? '✓' : '📱'}</button>
    );
}

function CBox({ ok, neutral, children }) {
    const cls = neutral ? 'bg-[#0a0a0a] border-[#252525]' : ok ? 'bg-[#1e7e34] border-[#1e7e34]' : 'bg-[#c0392b] border-[#c0392b]';
    return <div className={`rounded-md font-bold ${cls} text-white`} style={{ padding: '7px 9px', border: '1.5px solid' }}>{children}</div>;
}

function SessionCell({ a }) {
    // Split datetime into date and time parts
    const splitDateTime = (str) => {
        if (!str) return { date: '', time: '' };
        const s = str.trim();
        // If the string IS just a time (e.g. "10:15 AM", "07:25 PM") — no date prefix
        if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?$/i.test(s)) {
            return { date: '', time: s };
        }
        // Find the time portion: look for HH:MM or HH:MM:SS optionally followed by AM/PM
        // Use a greedy approach so we grab the FULL time block including leading digit
        // The time block starts after at least one non-digit-colon character (the date part)
        const match = s.match(/^(.*?)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)$/i);
        if (match && match[1].trim()) {
            return { date: match[1].trim(), time: match[2].trim() };
        }
        return { date: '', time: s };
    };

    const loginParts = splitDateTime(a.loginTime);
    const logoutParts = splitDateTime(a.logoutTime);

    // ── IN/OUT shown on single row: badge + full time string ──
    return (
        <CBox ok={a.sessOk}>
            <div className="text-[15px] font-black leading-tight font-['Arial_Black',Arial,sans-serif] pb-1">{a.loginDur}</div>
            <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="bg-[#2196f3] text-white border border-[#2196f3] text-[10px] font-black px-1.5 py-0.5 rounded min-w-[32px] text-center flex-shrink-0">IN</span>
                    <span className="leading-tight whitespace-nowrap">{loginParts.time || a.loginTime}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="bg-[#f44336] text-white border border-[#f44336] text-[10px] font-black px-1.5 py-0.5 rounded min-w-[32px] text-center flex-shrink-0">OUT</span>
                    <span className="leading-tight whitespace-nowrap">{logoutParts.time || a.logoutTime}</span>
                </div>
            </div>
        </CBox>
    );
}

function CallsCell({ a }) {
    return (
        <CBox ok={true}>
            <div className="text-lg font-black font-['Arial_Black',Arial,sans-serif] pb-1">{a.tc}</div>
            <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="bg-[#2a4a75] text-[#70b3ff] border border-[#60a5fa] text-[11px] font-black px-1.5 py-0.5 rounded min-w-[30px] text-center">OB</span>
                    <span className="font-extrabold text-sm">{a.outCalls}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="bg-[#9c27b0] text-white border border-[#9c27b0] text-[11px] font-black px-1.5 py-0.5 rounded min-w-[30px] text-center">MN</span>
                    <span className="font-extrabold text-sm">{a.manCalls}</span>
                </div>
            </div>
        </CBox>
    );
}

function TalkTimeCell({ a }) {
    return (
        <CBox ok={!a.ttBad}>
            <div className="text-[15px] font-black font-['Arial_Black',Arial,sans-serif] pb-1">{a.totalTT}</div>
            <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="bg-[#2a4a75] text-[#70b3ff] border border-[#60a5fa] text-[11px] font-black px-1.5 py-0.5 rounded min-w-[30px] text-center">OB</span>
                    <span className="font-extrabold text-sm">{a.outTT}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="bg-[#9c27b0] text-white border border-[#9c27b0] text-[11px] font-black px-1.5 py-0.5 rounded min-w-[30px] text-center">MN</span>
                    <span className="font-extrabold text-sm">{a.manTT}</span>
                </div>
            </div>
            {a.ttBad && <div className="text-[11px] font-bold mt-1">⚠ Suspicious Talk Time</div>}
        </CBox>
    );
}

function WrapupCell({ a }) {
    const aw = a.avgWu;
    const awh = Math.floor(aw / 60), aws = aw % 60;
    const avgWuDisp = aw < 60 ? `${aw}s` : (aws > 0 ? `${awh}m ${aws}s` : `${awh}m`);
    const maxWuSec = a.tc * MAX_WU_SEC;
    const maxWuDisp = maxWuSec < 60 ? `${maxWuSec}s` : maxWuSec < 3600
        ? `${Math.floor(maxWuSec / 60)}m${maxWuSec % 60 > 0 ? ' ' + maxWuSec % 60 + 's' : ''}`
        : `${Math.floor(maxWuSec / 3600)}h ${Math.floor(maxWuSec % 3600 / 60)}m`;
    return (
        <CBox ok={!a.wuBad}>
            <div className="text-sm font-black font-['Arial_Black',Arial,sans-serif] leading-snug">{a.wrapup}<span className="opacity-[0.45]"> · </span>{avgWuDisp} / call</div>
            <div className="text-[11px] mt-1 font-bold opacity-[0.65] border-t border-white/20 pt-1">Max: {maxWuDisp} · 10s / call</div>
            {a.wuBad && <div className="text-xs mt-1 font-black bg-black/30 rounded px-1.5 py-0.5 inline-block">+ Extra: <strong>{hmShort(a.wuWaste)}</strong></div>}
        </CBox>
    );
}

function IdleCell({ val, bad, sub }) {
    return (
        <CBox ok={!bad} neutral={!bad && sub === undefined}>
            <div className="text-sm font-extrabold font-['Arial_Black',Arial,sans-serif]">{val}{bad ? ' ⚠' : ''}</div>
            {bad && sub && <div className="text-[11px] mt-0.5 font-bold">{sub}</div>}
        </CBox>
    );
}

function BreakCell({ a }) {
    return (
        <CBox ok={!a.brkBad}>
            <div className="text-sm font-extrabold font-['Arial_Black',Arial,sans-serif]">{a.breakTime}{a.brkBad ? ' ⚠' : ''}</div>
            {a.brkBad && <div className="text-[11px] mt-0.5 font-bold">+{hmShort(a.brkSec - MAX_BRK_SEC)} over</div>}
        </CBox>
    );
}

function WasteCell({ a }) {
    const issues = [];
    if (a.isLate) issues.push({ label: `Late Login: +${a.lateMins}m`, value: hmShort(a.lateWaste) });
    if (a.isEarly) issues.push({ label: `Early Exit: -${a.earlyMins}m`, value: hmShort(a.earlyWaste) });
    if (a.miBad) issues.push({ label: `Manual Idle`, value: hmShort(a.miSec) });
    if (a.wuBad) {
        const _d = a.avgWu < 60 ? `${a.avgWu}s` : `${Math.floor(a.avgWu / 60)}m ${a.avgWu % 60 > 0 ? a.avgWu % 60 + 's' : ''}`;
        issues.push({ label: `Wrapup Avg ${_d}/call (>10s)`, value: hmShort(a.wuWaste) });
    }
    if (a.ttBad) issues.push({ label: `⚠ Suspicious Talk Time (info only)`, value: hmShort(a.manTTs) });
    if (a.brkBad) issues.push({ label: `Break Exceeded (>1h)`, value: hmShort(a.brkWaste) });
    if (a.wasteSec === 0 && issues.length === 0) {
        return <div className="rounded-md p-2 border-2 bg-[#1e7e34] border-[#1e7e34] text-white font-['Arial_Black',Arial,sans-serif] font-black text-sm">✓ No Issues</div>;
    }
    const cpTxt = `📅 *${fmtDate(a.date)}*\n*Agent: ${a.name} (${a.ext})*\n\n`
        + issues.map((iss, i) => `${i + 1}. ${iss.label} → ${iss.value}`).join('\n')
        + `\n\n*Total Waste: ${hms(a.wasteSec)} (${a.wastePct}% of shift)*`;
    return (
        <div className="rounded-md p-2 border-2 bg-[#c0392b] border-[#c0392b] text-white font-['Arial_Black',Arial,sans-serif]">
            <div className="text-[15px] font-black mb-2 flex justify-between items-center gap-2">
                <span className="flex-1 leading-snug">
                    <span className="text-xs opacity-80">{issues.length} Issue{issues.length !== 1 ? 's' : ''} &nbsp;·&nbsp;</span>
                    Total: {hms(a.wasteSec)} ({a.wastePct}%)
                </span>
                <WaBtn text={cpTxt} />
            </div>
            <div className="flex flex-col gap-1.5">
                {issues.map((iss, i) => (
                    <div key={i} className="grid gap-2.5 items-center" style={{ gridTemplateColumns: '1fr auto' }}>
                        <div className="text-[13px] font-extrabold leading-snug">• {iss.label}</div>
                        <div className="text-[17px] font-black text-right whitespace-nowrap">{iss.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Agent Table ───────────────────────────────────────────────────────────────
function AgentTable({ list, sortKey, sortDir, onSort, isMultiDate, isSingleAgent, warnings, onWarn, warnToggle, warnToggleHistory, onToggle, agentSeqNum = {} }) {
    const [togglePopExt, setTogglePopExt] = useState(null); // ext whose history modal is open
    const SortTh = ({ k, children, cls = '' }) => (
        <th onClick={() => onSort(k)} className={`px-3 py-2.5 bg-white border-b-2 border-[#00BCD4] border-r border-gray-200 last:border-r-0 text-xs font-black uppercase tracking-widest text-[#00BCD4] cursor-pointer whitespace-nowrap select-none text-left transition-all hover:bg-blue-50 hover:text-[#0097a7] ${cls}`}>
            {children}{sortKey === k && <span className="ml-1 text-[10px]">{sortDir === -1 ? '▼' : '▲'}</span>}
        </th>
    );
    return (
        <div className="px-5 pb-8 overflow-x-auto">
            <table className="w-full border-collapse min-w-[2000px] bg-black">
                <thead className="sticky top-[44px] z-50">
                    <tr>
                        <th className="px-3 py-2.5 bg-white border-b-2 border-[#00BCD4] border-r border-gray-200 text-xs font-black uppercase tracking-widest text-[#00BCD4] w-14">#</th>
                        <SortTh k="name" cls="min-w-[240px]">Agent</SortTh>
                        <SortTh k="loginDur" cls="min-w-[230px]">Login Duration</SortTh>
                        <SortTh k="totalCalls" cls="min-w-[170px]">Calls</SortTh>
                        <SortTh k="totalTT" cls="min-w-[180px]">Talk Time</SortTh>
                        <SortTh k="wrapup" cls="min-w-[260px]">Wrapup</SortTh>
                        <SortTh k="autoIdle" cls="min-w-[180px]">Auto Idle</SortTh>
                        <SortTh k="manualIdle" cls="min-w-[210px]">Manual Idle</SortTh>
                        <SortTh k="breakTime" cls="min-w-[210px]">Break</SortTh>
                        <SortTh k="wasteSec" cls="min-w-[360px]">Waste Time</SortTh>
                        <th className="px-3 py-2.5 bg-white border-b-2 border-[#f59e0b] text-xs font-black uppercase tracking-widest text-[#f59e0b] whitespace-nowrap min-w-[180px]">⚠ Warning</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((a, idx) => {
                        // Serial number logic — matches dialer.html exactly:
                        //   • Single-agent view: sequential day rows 1, 2, 3...
                        //   • All-agents view:   permanent first-appearance order from dataset (never changes with sort)
                        const sn = isSingleAgent ? (idx + 1) : (agentSeqNum[a.ext] || idx + 1);
                        const extLine = (isMultiDate && !isSingleAgent)
                            ? <>{a.ext}&nbsp;·&nbsp;<span className="text-[#00BCD4] font-black">{fmtDate(a.date)}</span></>
                            : isSingleAgent ? <span className="text-[#00BCD4] font-black">{fmtDate(a.date)}</span> : a.ext;
                        return (
                            <tr key={`${a.ext}_${a.date}_${idx}`} className="border-b-2 border-[#1a1a1a] last:border-0 hover:bg-[#0a0a0a]">
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top">
                                    <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-black bg-[#111111] text-[#aaaaaa] border border-[#333333]">{sn}</span>
                                </td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top">
                                    <div className="font-black text-base text-white" style={{ letterSpacing: '.2px' }}>{a.name}</div>
                                    <div className="text-xs text-[#aaa] font-bold mt-0.5">{extLine}</div>
                                </td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><SessionCell a={a} /></td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><CallsCell a={a} /></td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><TalkTimeCell a={a} /></td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><WrapupCell a={a} /></td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><IdleCell val={a.autoIdle} bad={false} /></td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><IdleCell val={a.manualIdle} bad={a.miBad} /></td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><BreakCell a={a} /></td>
                                <td className="px-2.5 py-2 border-r border-[#1a1a1a] align-top"><WasteCell a={a} /></td>
                                <td className="px-2.5 py-2 align-top">
                                    {/* Warning Toggle + History only */}
                                    {(() => {
                                        const isOn = (warnToggle && warnToggle[a.ext]) || false;
                                        const hist = (warnToggleHistory && warnToggleHistory[a.ext]) || [];
                                        return (
                                            <div className="flex items-center gap-1.5">
                                                {/* Toggle pill with text inside */}
                                                <button onClick={() => onToggle(a.ext, a.name)}
                                                    title={isOn ? 'Warning ON — click to turn off' : 'Warning OFF — click to turn on'}
                                                    className={`relative inline-flex items-center justify-center px-3 py-1 rounded-md transition-all duration-200 focus:outline-none flex-shrink-0 min-w-[90px] ${isOn ? 'bg-[#f59e0b] border-2 border-[#f59e0b]' : 'bg-[#1a1a1a] border-2 border-[#555]'}`}>
                                                    <span className={`text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${isOn ? 'text-black' : 'text-[#888]'}`}>
                                                        {isOn ? 'Warned' : 'Not Warned'}
                                                    </span>
                                                </button>
                                                {/* History clock — always visible */}
                                                <button onClick={() => setTogglePopExt(a.ext)}
                                                    title="View toggle history"
                                                    className={`w-[20px] h-[20px] rounded-full bg-[#1a1a1a] border flex items-center justify-center text-[11px] transition-all ${hist.length > 0 ? 'border-[#f59e0b] hover:bg-[#1a1000]' : 'border-[#333] opacity-40 hover:opacity-70'}`}>
                                                    🕐
                                                </button>
                                                {/* Full-screen centred modal */}
                                                {togglePopExt === a.ext && (
                                                    <div className="fixed inset-0 z-[900] flex items-center justify-center"
                                                        onClick={() => setTogglePopExt(null)}>
                                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                                                        <div className="relative bg-[#0d0d0d] border-2 border-[#f59e0b] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,.95)] w-[320px] max-h-[70vh] flex flex-col"
                                                            onClick={e => e.stopPropagation()}>
                                                            {/* Header */}
                                                            <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between flex-shrink-0">
                                                                <div>
                                                                    <div className="text-[11px] font-black text-[#f59e0b] uppercase tracking-wider">🕐 Toggle History</div>
                                                                    <div className="text-[10px] text-[#aaa] font-bold mt-0.5">{a.name} · {a.ext}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] text-[#555] font-bold">{hist.length} event{hist.length !== 1 ? 's' : ''}</span>
                                                                    <button onClick={() => setTogglePopExt(null)}
                                                                        className="w-[22px] h-[22px] rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[12px] text-[#aaa] hover:border-[#f59e0b] hover:text-white transition-all">✕</button>
                                                                </div>
                                                            </div>
                                                            {/* Body */}
                                                            <div className="overflow-y-auto py-1">
                                                                {hist.length === 0 ? (
                                                                    <div className="px-4 py-6 text-center text-[11px] text-[#444] font-bold">No toggle history yet</div>
                                                                ) : (
                                                                    [...hist].reverse().map((h, i) => (
                                                                        <div key={i} className="px-4 py-2.5 border-b border-[#111] last:border-0 flex items-start gap-3">
                                                                            <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${h.action === 'on' ? 'bg-[#f59e0b]' : 'bg-[#444]'}`} />
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-[11px] font-black text-white">
                                                                                    {h.action === 'on' ? 'Warned' : 'Warning Disabled'}
                                                                                    &nbsp;<span className={`text-[10px] font-bold ${h.action === 'on' ? 'text-[#f59e0b]' : 'text-[#aaa]'}`}>by {h.toggled_by_name || h.by || '—'}</span>
                                                                                </div>
                                                                                <div className="text-[10px] text-[#555] font-bold mt-0.5">{fmtIST(h.at)}</div>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ filterFrom, filterTo, selectedAgent, agentCount, isUploaded, onClearUpload, onOpenRules, onOpenUpload, onOpenHistory }) {
    const isMultiDate = filterFrom !== filterTo;
    const dateLabel = isMultiDate ? `${fmtDate(filterFrom)} – ${fmtDate(filterTo)}` : fmtDate(filterFrom);
    const Badge = ({ children }) => (
        <div className="bg-black border border-[#00BCD4] px-2.5 py-0.5 rounded-full text-[11px] text-white font-bold">{children}</div>
    );
    return (
        <div className="sticky top-0 z-[100] bg-black border-b-2 border-[#00BCD4] px-5 py-2.5 flex items-center gap-2.5 flex-wrap shadow-[0_2px_20px_rgba(0,0,0,.8)]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#28A745] shadow-[0_0_0_3px_rgba(40,167,69,.3)] flex-shrink-0 animate-pulse" />
            <button onClick={onOpenRules}
                className="px-3.5 py-1.5 bg-[#003d4d] border-2 border-[#00BCD4] text-[#00BCD4] text-[11px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all hover:bg-[#00BCD4] hover:text-black font-['Arial_Black',Arial,sans-serif]">
                📋 Performance Rules
            </button>
            <button onClick={onOpenUpload}
                className="px-3.5 py-1.5 border-2 text-[11px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all font-['Arial_Black',Arial,sans-serif] bg-[#1a1a00] border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b] hover:text-black">
                📤 Upload Excel
            </button>
            <button onClick={onOpenHistory}
                className="px-3.5 py-1.5 bg-[#0d0020] border-2 border-[#a78bfa] text-[#a78bfa] text-[11px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all hover:bg-[#a78bfa] hover:text-black font-['Arial_Black',Arial,sans-serif]">
                📂 Upload History
            </button>
            <div className="ml-auto flex gap-1.5 flex-wrap">
                <Badge>Shift <b className="text-[#00BCD4] font-black">10:30 AM – 7:00 PM</b></Badge>
                <Badge>Agents <b className="text-[#00BCD4] font-black">{selectedAgent ? '1 agent' : agentCount}</b></Badge>
                <Badge>Break Limit <b className="text-[#00BCD4] font-black">1h</b></Badge>
                <Badge>Manual Idle <b className="text-[#00BCD4] font-black">Zero Tolerance</b></Badge>
            </div>
        </div>
    );
}

// ── KPI Row ───────────────────────────────────────────────────────────────────
const COLORS = { 'ck-b': 'bg-[#60a5fa]', 'ck-g': 'bg-[#1e7e34]', 'ck-p': 'bg-[#a78bfa]', 'ck-y': 'bg-[#00BCD4]', 'ck-r': 'bg-[#c0392b]', 'ck-o': 'bg-[#fb923c]' };
function KpiRow({ kpis }) {
    return (
        <div className="grid grid-cols-6 gap-2 px-5 py-3">
            {kpis.map(k => (
                <div key={k.id} className="bg-black border border-[#252525] rounded-xl px-3.5 py-3 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${COLORS[k.color]}`} />
                    <div className="text-[9px] font-extrabold text-[#00BCD4] uppercase tracking-widest mb-1">{k.label}</div>
                    <div className="text-[22px] font-black text-white leading-none">{k.value}</div>
                    <div className="text-[10px] text-white font-semibold mt-0.5">{k.sub}</div>
                </div>
            ))}
        </div>
    );
}

// ── LocalStorage helpers (warning notes only — toggle/upload go to backend) ──
const LS_WARN = 'dialer_warnings';
function lsGet(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {/* quota */ } }

// ── Warning Modal ─────────────────────────────────────────────────────────────
function WarningModal({ agent, show, onClose, warnings, onSave }) {
    const [note, setNote] = useState('');
    const [type, setType] = useState('verbal');
    if (!show || !agent) return null;
    const key = agent.ext;
    const agentWarns = warnings[key] || [];
    const typeLabels = { verbal: 'Verbal Warning', written: 'Written Warning', final: 'Final Warning', info: 'Note / Info' };
    const typeCls = { verbal: 'bg-[#f59e0b] text-black', written: 'bg-[#c0392b] text-white', final: 'bg-[#7c0000] text-white', info: 'bg-[#1e5a8f] text-white' };
    const handleAdd = () => {
        if (!note.trim()) return;
        const w = { id: Date.now(), type, note: note.trim(), issuedAt: new Date().toLocaleString('en-IN') };
        const updated = { ...warnings, [key]: [w, ...(warnings[key] || [])] };
        onSave(updated);
        setNote('');
    };
    const handleDelete = (id) => {
        const updated = { ...warnings, [key]: (warnings[key] || []).filter(w => w.id !== id) };
        onSave(updated);
    };
    return (
        <div className="fixed inset-0 z-[3000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-[#0d0d0d] border-2 border-[#f59e0b] rounded-xl w-full max-w-[560px] shadow-[0_0_40px_rgba(245,158,11,.2)]">
                <div className="px-5 py-3 bg-[#1a1000] rounded-t-xl flex justify-between items-center border-b-2 border-[#f59e0b]">
                    <div>
                        <div className="text-[13px] font-black text-[#f59e0b] uppercase tracking-widest">⚠ Warning History</div>
                        <div className="text-[11px] text-[#aaa] font-bold">{agent.name} &nbsp;·&nbsp; Ext: {agent.ext}</div>
                    </div>
                    <button onClick={onClose} className="border-2 border-[#f59e0b] text-[#f59e0b] w-8 h-8 rounded-full flex items-center justify-center font-black text-base hover:bg-[#f59e0b] hover:text-black transition-all">✕</button>
                </div>
                <div className="px-5 py-4 space-y-3">
                    {/* Add new warning */}
                    <div className="bg-[#111] border border-[#333] rounded-lg p-3 space-y-2">
                        <div className="text-[11px] font-black text-[#f59e0b] uppercase tracking-wider">+ Issue New Warning</div>
                        <div className="flex gap-1.5 flex-wrap">
                            {Object.entries(typeLabels).map(([v, l]) => (
                                <button key={v} onClick={() => setType(v)}
                                    className={`px-2.5 py-1 text-[10px] font-black rounded-full border-2 transition-all ${type === v ? typeCls[v] + ' border-transparent' : 'border-[#333] text-[#aaa] hover:border-[#555]'
                                        }`}>{l}</button>
                            ))}
                        </div>
                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                            placeholder="Enter warning details / reason..."
                            className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-3 py-2 text-xs text-white font-bold resize-none focus:outline-none focus:border-[#f59e0b] placeholder:text-[#444]" />
                        <button onClick={handleAdd} disabled={!note.trim()}
                            className="px-4 py-1.5 bg-[#f59e0b] text-black text-[11px] font-black rounded-md hover:bg-[#fbbf24] disabled:opacity-40 disabled:cursor-not-allowed transition-all">Issue Warning</button>
                    </div>
                    {/* History list */}
                    <div className="max-h-60 overflow-y-auto space-y-1.5">
                        {agentWarns.length === 0
                            ? <div className="text-center text-[11px] text-[#555] font-bold py-4">No warnings on record for this agent.</div>
                            : agentWarns.map(w => (
                                <div key={w.id} className="bg-[#0d0d0d] border border-[#252525] rounded-lg px-3 py-2 flex gap-2 items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${typeCls[w.type] || 'bg-[#333] text-white'}`}>{typeLabels[w.type] || w.type}</span>
                                            <span className="text-[9px] text-[#555] font-bold">{w.issuedAt}</span>
                                        </div>
                                        <div className="text-[11px] text-[#ccc] font-bold leading-snug">{w.note}</div>
                                    </div>
                                    <button onClick={() => handleDelete(w.id)} className="text-[#c0392b] text-xs hover:text-red-400 font-black flex-shrink-0 mt-0.5" title="Delete">🗑</button>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Upload History Panel ──────────────────────────────────────────────────────
function UploadHistoryPanel({ show, onClose, history, onLoad, onDelete, onUpdate }) {
    const fileRefs = useRef({});
    if (!show) return null;
    const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + 'MB' : (b / 1024).toFixed(0) + 'KB';
    return (
        <div className="fixed inset-0 z-[2500] bg-black/85 backdrop-blur-sm flex items-start justify-center p-6 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-[#0d0d0d] border-2 border-[#a78bfa] rounded-xl w-full max-w-[680px] shadow-[0_0_50px_rgba(167,139,250,.15)] my-4">
                <div className="px-6 py-4 bg-[#0d0020] rounded-t-xl flex justify-between items-center border-b-2 border-[#a78bfa]">
                    <div>
                        <div className="text-[14px] font-black text-[#a78bfa] uppercase tracking-widest">📂 Upload History</div>
                        <div className="text-[10px] text-[#666] font-bold mt-0.5">Saved to server — {history.length} saved upload{history.length !== 1 ? 's' : ''}</div>
                    </div>
                    <button onClick={onClose} className="border-2 border-[#a78bfa] text-[#a78bfa] w-8 h-8 rounded-full flex items-center justify-center font-black text-base hover:bg-[#a78bfa] hover:text-black transition-all">✕</button>
                </div>
                <div className="px-6 py-5">
                    {history.length === 0 ? (
                        <div className="text-center py-10 text-[#444] font-bold text-sm">No upload history yet.<br /><span className="text-[10px]">Uploads via the Upload Excel button will appear here.</span></div>
                    ) : (
                        <div className="space-y-2">
                            {history.map((h, i) => (
                                <div key={h.id} className="bg-[#111] border border-[#252525] rounded-xl px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <div className="text-[28px] flex-shrink-0">📊</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-black text-white truncate">{h.filename}</div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                                <span className="text-[10px] text-[#a78bfa] font-bold">{h.record_count ?? h.recordCount} records</span>
                                                <span className="text-[10px] text-[#555] font-bold">{fmtIST(h.uploaded_at || h.uploadedAt)}</span>
                                                {(h.file_size ?? h.fileSize) && <span className="text-[10px] text-[#555] font-bold">{fmtSize(h.file_size ?? h.fileSize)}</span>}
                                                {h.uploaded_by_name && <span className="text-[10px] text-[#f59e0b] font-bold">by {h.uploaded_by_name}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 flex-shrink-0">
                                            <button onClick={() => onLoad(h)}
                                                className="px-2.5 py-1 bg-[#1e3a5f] border border-[#60a5fa] text-[#60a5fa] text-[10px] font-black rounded-md hover:bg-[#60a5fa] hover:text-black transition-all">Load</button>
                                            <label className="px-2.5 py-1 bg-[#1a1000] border border-[#f59e0b] text-[#f59e0b] text-[10px] font-black rounded-md hover:bg-[#f59e0b] hover:text-black transition-all cursor-pointer">
                                                Update
                                                <input type="file" accept=".xlsx,.xls" className="hidden"
                                                    ref={el => fileRefs.current[h.id] = el}
                                                    onChange={e => { if (e.target.files[0]) onUpdate(h.id, e.target.files[0]); e.target.value = ''; }} />
                                            </label>
                                            <button onClick={() => onDelete(h.id)}
                                                className="px-2.5 py-1 bg-[#1a0606] border border-[#c0392b] text-[#c0392b] text-[10px] font-black rounded-md hover:bg-[#c0392b] hover:text-white transition-all">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Column name aliases → internal field names (all keys are lowercase for case-insensitive lookup)
const COLUMN_MAP = {
    // ── serial number ──
    '##': '_sn', '#': '_sn', 'sr no': '_sn', 'sr. no': '_sn', 'sr. no.': '_sn',
    'sl no': '_sn', 'sl. no': '_sn', 'sl. no.': '_sn', 'sl.no.': '_sn',
    's no': '_sn', 's.no': '_sn', 's.no.': '_sn',
    'serial no': '_sn', 'serial no.': '_sn', 'serial number': '_sn',
    'sno': '_sn', 'srno': '_sn', 'slno': '_sn', 'no.': '_sn', 'no': '_sn',
    // ── date ──
    'date': 'date',
    // ── name / agent ──
    'name': 'name', 'agent name': 'name', 'agent': 'name', 'agentname': 'name',
    // ── ext / agent id ──
    'ext': 'ext', 'extension': 'ext', 'agent id': 'ext', 'agentid': 'ext', 'agent_id': 'ext',
    'id': 'ext', 'agent no': 'ext', 'agentno': 'ext', 'sip': 'ext',
    // ── login time ──
    'logintime': 'loginTime', 'login time': 'loginTime', 'login': 'loginTime',
    'start time': 'loginTime', 'starttime': 'loginTime', 'in time': 'loginTime',
    'first login': 'loginTime', 'firstlogin': 'loginTime', 'first login time': 'loginTime',
    // ── logout time ──
    'logouttime': 'logoutTime', 'logout time': 'logoutTime', 'logout': 'logoutTime',
    'end time': 'logoutTime', 'endtime': 'logoutTime', 'out time': 'logoutTime',
    'last logout': 'logoutTime', 'lastlogout': 'logoutTime', 'last logout time': 'logoutTime',
    // ── login duration / session ──
    'logindur': 'loginDur', 'login duration': 'loginDur', 'login dur': 'loginDur',
    'duration': 'loginDur', 'session': 'loginDur', 'session duration': 'loginDur',
    'total login duration': 'loginDur', 'mode duration': 'loginDur', 'modeduration': 'loginDur',
    'login session': 'loginDur', 'total duration': 'loginDur',
    // ── outbound calls ──
    'outcalls': 'outCalls', 'ob calls': 'outCalls', 'outbound calls': 'outCalls',
    'out calls': 'outCalls', 'ob': 'outCalls', 'dialed calls': 'outCalls',
    'total outbound calls': 'outCalls', 'outbound call': 'outCalls',
    // ── outbound talk time ──
    'outtt': 'outTT', 'ob tt': 'outTT', 'outbound tt': 'outTT', 'ob talk time': 'outTT',
    'out tt': 'outTT', 'outbound talk time': 'outTT', 'dialed talk time': 'outTT',
    'outbound duration': 'outTT', 'ob duration': 'outTT',
    // ── manual / inbound calls ──
    'mancalls': 'manCalls', 'mn calls': 'manCalls', 'manual calls': 'manCalls',
    'mn': 'manCalls', 'inbound calls': 'manCalls', 'ib calls': 'manCalls',
    'total manual calls': 'manCalls', 'inbound call': 'manCalls', 'ib call': 'manCalls',
    'manual call': 'manCalls', 'Manual Call': 'manCalls', 'Manual Calls': 'manCalls',
    'manual_call': 'manCalls', 'manual_calls': 'manCalls', 'man calls': 'manCalls', 'man call': 'manCalls',
    'manualcall': 'manCalls', 'manualcalls': 'manCalls', // no-space variants
    // ── manual / inbound talk time ──
    'mantt': 'manTT', 'mn tt': 'manTT', 'manual tt': 'manTT', 'manual talk time': 'manTT',
    'inbound talk time': 'manTT', 'ib tt': 'manTT',
    'ib duration': 'manTT', 'inbound duration': 'manTT', 'manual duration': 'manTT',
    'manual call duration': 'manTT', 'Manual Call Duration': 'manTT', 'Manual Duration': 'manTT',
    // ── total talk time (optional — computed from outTT+manTT if absent) ──
    'totaltt': 'totalTT', 'total tt': 'totalTT', 'total talk time': 'totalTT',
    'total time': 'totalTT', 'talk time': 'totalTT', 'talktime': 'totalTT',
    'att': 'totalTT', 'aht': 'totalTT',
    // ── auto idle ──
    'autoidle': 'autoIdle', 'auto idle': 'autoIdle', 'system idle': 'autoIdle',
    'idle time': 'autoIdle', 'idletime': 'autoIdle', 'idle duration': 'autoIdle',
    'auto idle duration': 'autoIdle',
    // ── manual idle ──
    'manualIdle': 'manualIdle', 'manual idle': 'manualIdle', 'mn idle': 'manualIdle',
    'manual idle duration': 'manualIdle',
    // ── break ──
    'breaktime': 'breakTime', 'break time': 'breakTime', 'break': 'breakTime',
    'break duration': 'breakTime', 'total break duration': 'breakTime',
    'total break': 'breakTime',
    // ── wrapup ──
    'wrapup': 'wrapup', 'wrap up': 'wrapup', 'wrap-up': 'wrapup',
    'after call work': 'wrapup', 'acw': 'wrapup', 'wrapup duration': 'wrapup',
    'wrap up duration': 'wrapup',
    // ── loginMin / logoutMin — optional, auto-computed ──
    'loginmin': 'loginMin', 'login min': 'loginMin',
    'logoutmin': 'logoutMin', 'logout min': 'logoutMin',
    // ── ignored columns (extra data from reports) ──
    'campaign': '_ignore', 'transfer': '_ignore', 'transfer duration': '_ignore',
    'conf': '_ignore', 'conf.': '_ignore', 'conf. duration': '_ignore',
    'recall': '_ignore', 'recall duration': '_ignore', 'hold': '_ignore',
    'hold duration': '_ignore', 'review': '_ignore', 'review duration': '_ignore',
    'sms': '_ignore', 'e-mail': '_ignore', 'email': '_ignore',
    'in_meeting duration': '_ignore', 'in_disbursal duration': '_ignore',
    'in_discussion duration': '_ignore', 'on_other_call duration': '_ignore',
    'total calls': '_ignore',
};

// Required columns. Reduced to essential fields only.
// Optional fields (outCalls, manCalls, breakTime, wrapup, autoIdle, manualIdle) use ||0 defaults
const REQUIRED_FIELDS = [
    'name', 'ext',
    'loginTime', 'logoutTime', 'loginDur',
];

// Normalise any duration/HH value → "HH:MM:SS"
function parseTimeToHMS(val) {
    if (val === '' || val === null || val === undefined) return '00:00:00';
    if (typeof val === 'number') {
        // If large number (datetime serial like 46048.4333), extract only the fractional time part.
        // If pure fraction (< 1, e.g. 0.1389 = 3h20m), use as-is.
        const timeFrac = val > 1 ? val % 1 : val;
        const totalSec = Math.round(timeFrac * 86400);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const s = String(val).trim();
    // "HH:MM:SS" — already good
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
        const [h, m, sc] = s.split(':');
        return `${String(parseInt(h)).padStart(2, '0')}:${m}:${sc}`;
    }
    // "HH:MM" — add :00 seconds
    if (/^\d{1,2}:\d{2}$/.test(s)) return `${String(parseInt(s.split(':')[0])).padStart(2, '0')}:${s.split(':')[1]}:00`;
    return '00:00:00';
}

// Parse loginTime / logoutTime into { display: "10:21 AM", minutes: 621 }
// Accepts: pure time fraction (0.4333 = 10:24), datetime serial (46048.4333 = Feb20 10:24),
//          combined datetime string ("2/20/2026 10:24:31 AM"),
//          "HH:MM AM/PM", "HH:MM:SS AM/PM", "HH:MM" (24h), "HH:MM:SS" (24h)
function parseDisplayTime(val) {
    if (val === '' || val === null || val === undefined) return { display: '—', minutes: 0 };
    if (typeof val === 'number') {
        // For datetime serials (e.g. 46048.4333), extract only the fractional time part.
        // For pure time fractions (< 1), use as-is.
        const timeFrac = val > 1 ? val % 1 : val;
        const totalMin = Math.round(timeFrac * 1440);
        const h24 = Math.floor(totalMin / 60) % 24;
        const mn = totalMin % 60;
        const ap = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return {
            display: `${String(h12).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${ap}`,
            minutes: h24 * 60 + mn,
        };
    }
    const s = String(val).trim();
    // Extract the TIME portion after the first space or anywhere in the string that follows a date-like prefix
    // Also handling complex ordinals e.g "24th Feb 2026 10:21:56 AM"
    const dtm = s.match(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)$/i);
    if (dtm && s.length > dtm[1].length) {
        // Recurse with just the time part
        return parseDisplayTime(dtm[1].trim());
    }
    // "10:21 AM", "7:07 PM", "10:21:34 AM", "07:07:00 PM"
    const m12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (m12) {
        let h = parseInt(m12[1]), mn = parseInt(m12[2]);
        const ap = m12[3].toUpperCase();
        if (ap === 'AM' && h === 12) h = 0;
        else if (ap === 'PM' && h !== 12) h += 12;
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return {
            display: `${String(h12).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${ap}`,
            minutes: h * 60 + mn,
        };
    }
    // "19:07", "10:21", "07:07:45" (24-hour)
    const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m24) {
        let h24 = parseInt(m24[1]), mn = parseInt(m24[2]);
        if (h24 >= 24) h24 = h24 % 24; // safety
        const ap = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return {
            display: `${String(h12).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${ap}`,
            minutes: h24 * 60 + mn,
        };
    }
    // Fallback: keep as-is
    return { display: s, minutes: 0 };
}

function parseDate(val) {
    if (!val) return '';
    if (typeof val === 'number') {
        // For datetime serials (e.g. 46048.4333 = Feb 20 10:24), use only the integer (date) part.
        // For pure date serials (e.g. 46048), the floor is identity.
        const dateSerial = Math.floor(val);
        if (dateSerial < 1) return ''; // 0 or negative = no date
        try {
            const d = XLSX.SSF.parse_date_code(dateSerial);
            if (d && d.y > 1900) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        } catch { /* fallthrough */ }
        // Fallback: JS epoch conversion
        const jsDate = new Date(Math.round((dateSerial - 25569) * 86400 * 1000));
        if (!isNaN(jsDate))
            return `${jsDate.getUTCFullYear()}-${String(jsDate.getUTCMonth() + 1).padStart(2, '0')}-${String(jsDate.getUTCDate()).padStart(2, '0')}`;
        return '';
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Text month formats dictionary (moved up for ordinal date handling)
    const MONTHS = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
        january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8,
        september: 9, october: 10, november: 11, december: 12,
    };

    // Handle ordinal dates: "20th Feb 2026 09:54:22 AM", "1st January 2026", "31st Dec 2026"
    const ordMatch = s.match(/^(\d{1,2})(?:st|nd|rd|th)\s+([a-zA-Z]+)\s+(\d{4})/i);
    if (ordMatch) {
        const mon = MONTHS[ordMatch[2].toLowerCase()];
        if (mon) {
            return `${ordMatch[3]}-${String(mon).padStart(2, '0')}-${String(parseInt(ordMatch[1])).padStart(2, '0')}`;
        }
    }

    // Datetime string: "2/20/2026 10:24:31 AM", "2026-02-20T10:24:31", etc. — strip time, parse date part only
    if (s.includes(' ') || s.includes('T')) {
        const datePart = s.split(/[\sT]/)[0];
        if (/\d/.test(datePart) && datePart !== s) {
            const inner = parseDate(datePart);
            if (inner && /^\d{4}-\d{2}-\d{2}$/.test(inner)) return inner;
        }
    }
    // DD/MM/YYYY, MM/DD/YYYY or DD-MM-YYYY — detect format by magnitude
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
        const a = parseInt(m[1]), b = parseInt(m[2]);
        // If second number > 12 → must be MM/DD/YYYY (a=month, b=day)
        // If first number > 12 → must be DD/MM/YYYY (a=day, b=month)
        // Otherwise assume DD/MM/YYYY (Indian convention)
        if (b > 12) {
            return `${m[3]}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`; // MM/DD/YYYY
        } else {
            return `${m[3]}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`; // DD/MM/YYYY
        }
    }
    // Day-Month-Year: "24 Feb 2026", "24-Feb-2026", "24/Feb/2026", "24 February 2026"
    // Day-Month-Year: "24 Feb 2026", "24-Feb-2026", "24/Feb/2026", "24 February 2026"
    const mt1 = s.match(/^(\d{1,2})[\s\-\/]([a-zA-Z]+)[\s\-\/,]?\s*(\d{2,4})$/);
    if (mt1) {
        const mon = MONTHS[mt1[2].toLowerCase()];
        if (mon) {
            const yr = mt1[3].length === 2 ? 2000 + parseInt(mt1[3]) : parseInt(mt1[3]);
            return `${yr}-${String(mon).padStart(2, '0')}-${String(parseInt(mt1[1])).padStart(2, '0')}`;
        }
    }
    // Month-Day-Year: "Feb 24, 2026", "Feb 24 2026"
    const mt2 = s.match(/^([a-zA-Z]+)[\s\-\/,]?\s*(\d{1,2}),?\s*(\d{2,4})$/);
    if (mt2) {
        const mon = MONTHS[mt2[1].toLowerCase()];
        if (mon) {
            const yr = mt2[3].length === 2 ? 2000 + parseInt(mt2[3]) : parseInt(mt2[3]);
            return `${yr}-${String(mon).padStart(2, '0')}-${String(parseInt(mt2[2])).padStart(2, '0')}`;
        }
    }
    // DD-MM-YY (two-digit year)
    const m2 = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
    if (m2) {
        const yr = 2000 + parseInt(m2[3]);
        return `${yr}-${String(parseInt(m2[2])).padStart(2, '0')}-${String(parseInt(m2[1])).padStart(2, '0')}`;
    }
    return s;
}

function sanitize(val) {
    if (val === null || val === undefined) return '';
    return String(val).replace(/<[^>]*>/g, '').trim();
}

function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 10 * 1024 * 1024) {
            reject(new Error('File too large. Max 10MB allowed.'));
            return;
        }
        const fileExt = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(fileExt)) {
            reject(new Error('Invalid file type. Only .xlsx and .xls files are accepted.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (rawRows.length < 2) {
                    reject(new Error('File is empty or has no data rows.'));
                    return;
                }
                // Map headers case-insensitively — first matching column wins
                // (prevents later columns like 'Agent' from overwriting earlier 'Name' column)
                // We also sanitize whitespace like newlines in headers
                const headerRow = rawRows[0].map(h => String(h).replace(/\s+/g, ' ').trim());
                const fieldMap = {}; // colIndex → fieldName
                const unmapped = [];
                const mappedFieldSet = new Set();

                // Debug: log exact raw headers so any column-name mismatch is visible
                console.log('[parseExcelFile] raw headers:', headerRow);

                headerRow.forEach((h, i) => {
                    const key = h.toLowerCase();
                    // Also try with all spaces removed (e.g. "ManualCall","manual call","MANUAL CALL" all → "manualcall")
                    const keyNoSpace = key.replace(/\s+/g, '');
                    const cleanKey = key.replace(/[^a-z0-9]/g, '');
                    let f = COLUMN_MAP[key] || COLUMN_MAP[h] || COLUMN_MAP[keyNoSpace] || COLUMN_MAP[cleanKey];

                    // Ultra-aggressive fallback: if it contains "manual" and "call", force map to manCalls
                    if (!f && cleanKey.includes('manual') && (cleanKey.includes('call') || cleanKey.includes('mn'))) {
                        f = cleanKey.includes('duration') || cleanKey.includes('time') ? 'manTT' : 'manCalls';
                    }
                    // Ultra-aggressive fallback for duration specifically
                    if (!f && cleanKey.includes('manual') && cleanKey.includes('duration')) f = 'manTT';

                    if (f) {
                        // _ignore columns: always include in fieldMap (so the column is consumed),
                        // but do NOT add 'ignore' to mappedFieldSet — this ensures _ignore never
                        // blocks any real field that happens to come later.
                        if (f === '_ignore') {
                            fieldMap[i] = f;
                        } else if (!mappedFieldSet.has(f)) {
                            fieldMap[i] = f;
                            mappedFieldSet.add(f);
                        }
                    } else if (h !== '') {
                        unmapped.push(h);
                    }
                });

                // Debug: show what each column index resolved to
                const fieldMapDebug = {};
                Object.entries(fieldMap).forEach(([ci, fn]) => {
                    fieldMapDebug[headerRow[parseInt(ci)]] = fn;
                });
                console.log('[parseExcelFile] fieldMap (header → field):', fieldMapDebug);
                console.log('[parseExcelFile] unmapped headers:', unmapped);
                // Log first data row values for each mapped field
                if (rawRows[1]) {
                    const firstRowDebug = {};
                    Object.entries(fieldMap).forEach(([ci, fn]) => {
                        if (fn !== '_ignore') firstRowDebug[fn] = rawRows[1][parseInt(ci)];
                    });
                    console.log('[parseExcelFile] first data row values:', firstRowDebug);
                }

                const mappedFields = Object.values(fieldMap);
                const missing = REQUIRED_FIELDS.filter(f => !mappedFields.includes(f));
                if (missing.length > 0) {
                    reject(new Error(
                        `Missing required columns: ${missing.join(', ')}\n\n` +
                        `Unrecognized headers in your file: ${unmapped.length > 0 ? unmapped.join(', ') : 'none'}\n\n` +
                        `Tip: Click "Expected Column Names" below to see accepted aliases.`
                    ));
                    return;
                }
                const agents = [];
                const rowErrors = [];
                // Track what date to use if the file has no date column
                const hasDateCol = mappedFields.includes('date');
                rawRows.slice(1).forEach((row, ri) => {
                    const rowNum = ri + 2;
                    if (row.every(c => c === '' || c === null || c === undefined)) return;
                    const rec = {};
                    Object.entries(fieldMap).forEach(([ci, fn]) => { rec[fn] = row[parseInt(ci)]; });

                    const errs = [];
                    const loginParsed = parseDisplayTime(rec.loginTime);
                    const logoutParsed = parseDisplayTime(rec.logoutTime);

                    // Resolve date
                    let dateVal = hasDateCol ? parseDate(rec.date) : '';
                    if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) dateVal = '';
                    if (!dateVal) {
                        // Try extract date from loginTime (works for both number serials AND datetime strings)
                        if (rec.loginTime) {
                            if (typeof rec.loginTime === 'number' && rec.loginTime > 1) {
                                dateVal = parseDate(Math.floor(rec.loginTime));
                            } else if (typeof rec.loginTime === 'string') {
                                dateVal = parseDate(rec.loginTime); // parseDate now handles "2/20/2026 10:24 AM"
                            }
                        }
                        if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) dateVal = '';
                    }
                    if (!dateVal) {
                        // Absolute last resort
                        const t = new Date();
                        dateVal = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                    }

                    const outTTstr = parseTimeToHMS(rec.outTT);
                    const manTTstr = parseTimeToHMS(rec.manTT);

                    // totalTT — use column if present, otherwise sum outTT + manTT
                    let totalTTstr;
                    if (rec.totalTT !== undefined && rec.totalTT !== '') {
                        totalTTstr = parseTimeToHMS(rec.totalTT);
                    } else {
                        const sumSec = toSec(outTTstr) + toSec(manTTstr);
                        totalTTstr = hms(sumSec);
                    }

                    // name fallback → use ext if name column absent
                    const nameVal = sanitize(rec.name) || sanitize(rec.ext);
                    const extVal = sanitize(rec.ext) || sanitize(rec.name);

                    // Skip only repeated header rows and fully blank rows
                    const isHeaderRepeat = /^\s*sl\.?\s*no\.?\s*$/i.test(nameVal) || /^\s*sr\.?\s*no\.?\s*$/i.test(nameVal);
                    const isBlankRow = !nameVal && !extVal;
                    const isTotalRow = /^(grand\s*)?totals?$/i.test(nameVal)
                        || /^(grand\s*)?totals?$/i.test(extVal)
                        || (/total/i.test(nameVal) && (extVal === '' || extVal === nameVal));
                    if (isHeaderRepeat || isBlankRow || isTotalRow) return;

                    // Serial number from Excel — use as-is if present
                    const excelSN = rec._sn !== undefined && rec._sn !== '' ? String(rec._sn).trim() : null;

                    const parsed = {
                        date: dateVal,
                        name: nameVal,
                        ext: extVal,
                        loginTime: loginParsed.display,
                        logoutTime: logoutParsed.display,
                        loginDur: parseTimeToHMS(rec.loginDur || 0),
                        outCalls: parseInt(rec.outCalls) || 0,
                        outTT: outTTstr,
                        manCalls: parseInt(rec.manCalls) || 0,
                        manTT: manTTstr,
                        totalTT: totalTTstr,
                        autoIdle: parseTimeToHMS(rec.autoIdle || 0),
                        manualIdle: parseTimeToHMS(rec.manualIdle || 0),
                        breakTime: parseTimeToHMS(rec.breakTime || 0),
                        wrapup: parseTimeToHMS(rec.wrapup || 0),
                        loginMin: (rec.loginMin !== undefined && rec.loginMin !== '') ? parseInt(rec.loginMin) : loginParsed.minutes,
                        logoutMin: (rec.logoutMin !== undefined && rec.logoutMin !== '') ? parseInt(rec.logoutMin) : logoutParsed.minutes,
                        _sn: excelSN,
                    };

                    if (!parsed.name) errs.push('name/agent id empty');
                    if (!parsed.ext) errs.push('ext/agent id empty');
                    if (errs.length > 0) rowErrors.push(`Row ${rowNum}: ${errs.join(', ')}`);
                    else agents.push(parsed);
                });
                // Debug: capture first raw data row for display
                const firstDataRow = rawRows[1] || [];
                const debugSample = {};
                Object.entries(fieldMap).forEach(([ci, fn]) => {
                    const rawVal = firstDataRow[parseInt(ci)];
                    debugSample[fn] = `[${typeof rawVal}] ${JSON.stringify(rawVal)}`;
                });
                resolve({ agents, rowErrors, totalRows: rawRows.length - 1, unmapped, debugSample });
            } catch (err) {
                reject(new Error('Failed to parse file: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsArrayBuffer(file);
    });
}

function ExcelUploadModal({ show, onClose, onUpload, existingAgents, uploadHistory }) {
    const fileRef = useRef(null);
    const [status, setStatus] = useState('idle'); // idle | parsing | success | error | all_duplicate | partial_duplicate | file_duplicate
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('');
    const [rowErrors, setRowErrors] = useState([]);
    const [stats, setStats] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [dupInfo, setDupInfo] = useState(null); // { dupCount, newCount, newAgents, allAgents, filename, fileSize }
    const [debugSample, setDebugSample] = useState(null);

    const reset = () => { setStatus('idle'); setProgress(0); setMessage(''); setRowErrors([]); setStats(null); setDupInfo(null); setDebugSample(null); };
    const handleClose = () => { reset(); onClose(); };

    const processFile = useCallback(async (file) => {
        if (!file) return;
        reset();
        setStatus('parsing');
        setProgress(20);
        try {
            setProgress(50);
            const result = await parseExcelFile(file);
            setProgress(90);
            setStats({ loaded: result.agents.length, total: result.totalRows, unmapped: result.unmapped });
            setDebugSample(result.debugSample || null);
            setRowErrors(result.rowErrors);
            if (result.agents.length === 0) {
                setStatus('error');
                setMessage('No valid rows found in the file.');
                return;
            }

            // ── File-level duplicate detection (same filename & similar record count) ──────
            if (uploadHistory && uploadHistory.length > 0) {
                const duplicate = uploadHistory.find(h =>
                    h.filename === file.name &&
                    Math.abs(h.record_count - result.agents.length) <= 2 // Allow ±2 records difference
                );
                if (duplicate) {
                    setProgress(100);
                    setStatus('file_duplicate');
                    setMessage(`⚠️ This file "${file.name}" was already uploaded on ${new Date(duplicate.uploaded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}\n\nRecord count: ${duplicate.record_count}\n\nPlease upload a different file or load from Upload History.`);
                    return;
                }
            }

            // ── File-level duplicate detection — WARN only, do NOT block re-upload ──────
            let fileDupWarning = '';
            if (uploadHistory && uploadHistory.length > 0) {
                const duplicate = uploadHistory.find(h =>
                    h.filename === file.name &&
                    Math.abs(h.record_count - result.agents.length) <= 2
                );
                if (duplicate) {
                    fileDupWarning = `ℹ️ "${file.name}" was previously uploaded. Re-uploading with fresh data.`;
                }
            }

            // ── Duplicate detection against currently loaded data ──────────
            if (existingAgents && existingAgents.length > 0) {
                const existingKeys = new Set(existingAgents.map(a => `${a.ext}__${a.date}`));
                const newAgents = result.agents.filter(a => !existingKeys.has(`${a.ext}__${a.date}`));
                const dupCount = result.agents.length - newAgents.length;
                if (dupCount > 0) {
                    setProgress(100);
                    if (newAgents.length === 0) {
                        // All records already exist — show duplicate warning
                        setStatus('all_duplicate');
                    } else {
                        // Some new, some old — show merge options
                        setStatus('partial_duplicate');
                        setDupInfo({ dupCount, newCount: newAgents.length, newAgents, allAgents: result.agents, filename: file.name, fileSize: file.size });
                    }
                    return;
                }
            }

            // ── No duplicates — proceed with upload ──────────────────────────
            setProgress(100);
            setStatus('success');
            // Show a preview of what was parsed for the first agent so user can verify
            const firstAgent = result.agents[0];
            const parsePreview = firstAgent
                ? ` | 1st row: OB=${firstAgent.outCalls} MN=${firstAgent.manCalls} MN-TT=${firstAgent.manTT}`
                : '';
            setMessage(`✅ Loaded ${result.agents.length} records.${fileDupWarning ? ' ' + fileDupWarning : ''}${parsePreview}`);
            onUpload(result.agents, file.name, file.size, false);
        } catch (err) {
            setStatus('error');
            setMessage(err.message);
            setProgress(0);
        }

    }, [onUpload, existingAgents, uploadHistory]);

    const handleFile = (file) => processFile(file);
    const handleInputChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
    const handleDrop = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };

    // Merge — add only new records to existing dataset
    const handleMerge = () => {
        if (!dupInfo) return;
        onUpload(dupInfo.newAgents, dupInfo.filename, dupInfo.fileSize, true);
        setStatus('success');
        setMessage(`✅ Added ${dupInfo.newCount} new record${dupInfo.newCount !== 1 ? 's' : ''}. (${dupInfo.dupCount} duplicate${dupInfo.dupCount !== 1 ? 's' : ''} skipped)`);
        setDupInfo(null);
    };

    // Replace all — upload all records from new file
    const handleReplaceAll = () => {
        if (!dupInfo) return;
        onUpload(dupInfo.allAgents, dupInfo.filename, dupInfo.fileSize, false);
        setStatus('success');
        setMessage(`✅ Replaced with ${dupInfo.allAgents.length} records from new file.`);
        setDupInfo(null);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && handleClose()}>
            <div className="bg-[#0d0d0d] border-2 border-[#00BCD4] rounded-xl w-full max-w-[620px] shadow-[0_0_60px_rgba(0,188,212,.2)]">
                {/* Header */}
                <div className="px-6 py-4 bg-[#003d4d] rounded-t-xl flex justify-between items-center border-b-2 border-[#00BCD4]">
                    <h2 className="text-[15px] font-black text-[#00BCD4] uppercase tracking-widest">📊 Upload Excel Data</h2>
                    <button onClick={handleClose} className="border-2 border-[#00BCD4] text-[#00BCD4] w-8 h-8 rounded-full text-lg flex items-center justify-center font-black transition-all hover:bg-[#00BCD4] hover:text-black">✕</button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => status !== 'parsing' && status !== 'partial_duplicate' && fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl py-8 px-4 text-center transition-all ${status !== 'parsing' && status !== 'partial_duplicate' ? 'cursor-pointer' : ''
                            } ${dragging ? 'border-[#00BCD4] bg-[#003d4d]' :
                                status === 'success' ? 'border-[#1e7e34] bg-[#0d240d]' :
                                    status === 'error' || status === 'file_duplicate' ? 'border-[#c0392b] bg-[#1a0606]' :
                                        status === 'all_duplicate' || status === 'partial_duplicate' ? 'border-[#f59e0b] bg-[#1a1000]' :
                                            'border-[#252525] hover:border-[#00BCD4] hover:bg-[#111]'
                            }`}
                    >
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInputChange} />
                        {status === 'parsing' ? (
                            <div className="space-y-3">
                                <div className="text-[#00BCD4] text-[22px]">⏳</div>
                                <div className="text-sm font-bold text-white">Parsing file...</div>
                                <div className="w-full bg-[#111] rounded-full h-2 mt-2">
                                    <div className="bg-[#00BCD4] h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="text-[11px] text-[#00BCD4] font-bold">{progress}%</div>
                            </div>
                        ) : status === 'success' ? (
                            <div className="space-y-1">
                                <div className="text-[28px]">✅</div>
                                <div className="text-sm font-black text-[#28A745]">{message}</div>
                                {stats?.unmapped?.length > 0 && <div className="text-[11px] text-[#aaa] mt-1">Ignored columns: {stats.unmapped.join(', ')}</div>}
                                <div className="text-[11px] text-[#00BCD4] mt-2 font-bold cursor-pointer">Click to replace with a new file</div>
                                {/* DEBUG: raw first-row values */}
                                {debugSample && (
                                    <details className="mt-2">
                                        <summary className="text-[10px] font-black text-[#f59e0b] cursor-pointer">🔍 DEBUG: Raw Excel values (first data row)</summary>
                                        <div className="mt-1 bg-[#0a0a0a] border border-[#333] rounded p-2 max-h-48 overflow-y-auto">
                                            {Object.entries(debugSample).map(([k, v]) => (
                                                <div key={k} className="text-[10px] font-mono mb-0.5">
                                                    <span className="text-[#00BCD4]">{k}:</span> <span className="text-[#ccc]">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        ) : status === 'error' ? (
                            <div className="space-y-1">
                                <div className="text-[28px]">❌</div>
                                <div className="text-sm font-black text-[#c0392b] whitespace-pre-wrap">{message}</div>
                                <div className="text-[11px] text-[#aaa] mt-2">Click to try another file</div>
                            </div>
                        ) : status === 'file_duplicate' ? (
                            <div className="space-y-1">
                                <div className="text-[28px]">⚠️</div>
                                <div className="text-sm font-black text-[#f59e0b]">Duplicate File!</div>
                                <div className="text-[11px] text-[#ccc] font-bold whitespace-pre-wrap">{message}</div>
                                <div className="text-[11px] text-[#00BCD4] mt-2 font-bold">Click to upload a different file</div>
                            </div>
                        ) : status === 'all_duplicate' ? (
                            <div className="space-y-2">
                                <div className="text-[32px]">📋</div>
                                <div className="text-sm font-black text-[#f59e0b]">Excel File Already Uploaded!</div>
                                <div className="text-[11px] text-[#ccc] font-bold">
                                    All <span className="text-[#f59e0b] font-black">{stats?.loaded}</span> records in this file are already present in the current dataset.
                                </div>
                                <div className="text-[10px] text-[#666] font-bold mt-1">No new data to add.</div>
                                <div className="text-[11px] text-[#00BCD4] mt-3 font-bold">Click to try a different file</div>
                            </div>
                        ) : status === 'file_duplicate' ? (
                            <div className="space-y-2">
                                <div className="text-[32px]">⚠️</div>
                                <div className="text-sm font-black text-[#f59e0b]">Duplicate File Detected!</div>
                                <div className="text-[11px] text-[#ccc] font-bold whitespace-pre-line">
                                    {message}
                                </div>
                                <div className="text-[11px] text-[#00BCD4] mt-3 font-bold">Click to try a different file</div>
                            </div>
                        ) : status === 'partial_duplicate' ? (
                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                <div className="text-[32px]">🔄</div>
                                <div className="text-sm font-black text-[#f59e0b]">Partial Duplicate Detected</div>
                                <div className="text-[12px] text-[#ccc] font-bold">
                                    <span className="text-[#c0392b] font-black">{dupInfo?.dupCount} record{dupInfo?.dupCount !== 1 ? 's' : ''}</span> already exist
                                    &nbsp;·&nbsp;
                                    <span className="text-[#28A745] font-black">{dupInfo?.newCount} new record{dupInfo?.newCount !== 1 ? 's' : ''}</span> found
                                </div>
                                <div className="text-[10px] text-[#555] font-bold">Choose how to handle below ↓</div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="text-[32px]">📂</div>
                                <div className="text-sm font-black text-white">Drop Excel file here or click to browse</div>
                                <div className="text-[11px] text-[#aaa]">.xlsx or .xls &nbsp;·&nbsp; Max 10MB &nbsp;·&nbsp; Up to 1000+ rows supported</div>
                            </div>
                        )}
                    </div>

                    {/* Partial duplicate merge options */}
                    {status === 'partial_duplicate' && dupInfo && (
                        <div className="bg-[#111] border-2 border-[#f59e0b] rounded-xl p-4 space-y-3">
                            <div className="text-[11px] font-black text-[#f59e0b] uppercase tracking-wider">⚠ Duplicate Records — Choose Action</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-[#0d1a0d] rounded-lg p-2.5 border border-[#1e7e34]">
                                    <div className="text-[#28A745] font-black text-[11px] mb-1">✅ Add New Records Only</div>
                                    <div className="text-[10px] text-[#aaa] font-bold">Add <span className="text-[#28A745] font-black">{dupInfo.newCount}</span> new record{dupInfo.newCount !== 1 ? 's' : ''} to current data.</div>
                                    <div className="text-[10px] text-[#555] font-bold">Skip {dupInfo.dupCount} duplicate{dupInfo.dupCount !== 1 ? 's' : ''}.</div>
                                </div>
                                <div className="bg-[#0d1a2a] rounded-lg p-2.5 border border-[#1e5a8f]">
                                    <div className="text-[#60a5fa] font-black text-[11px] mb-1">🔄 Replace All Data</div>
                                    <div className="text-[10px] text-[#aaa] font-bold">Load all <span className="text-[#60a5fa] font-black">{dupInfo.allAgents.length}</span> records from new file.</div>
                                    <div className="text-[10px] text-[#555] font-bold">Current data will be replaced.</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleMerge}
                                    className="flex-1 py-2 bg-[#1e7e34] border border-[#1e7e34] text-white text-[11px] font-black rounded-lg hover:bg-[#28a745] transition-all">
                                    ✅ Add {dupInfo.newCount} New Record{dupInfo.newCount !== 1 ? 's' : ''}
                                </button>
                                <button onClick={handleReplaceAll}
                                    className="flex-1 py-2 bg-[#1e3a5f] border border-[#60a5fa] text-[#60a5fa] text-[11px] font-black rounded-lg hover:bg-[#60a5fa] hover:text-black transition-all">
                                    🔄 Replace All ({dupInfo.allAgents.length})
                                </button>
                                <button onClick={reset}
                                    className="px-3 py-2 bg-[#1a0606] border border-[#c0392b] text-[#c0392b] text-[11px] font-black rounded-lg hover:bg-[#c0392b] hover:text-white transition-all" title="Cancel">
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Row-wise errors */}
                    {rowErrors.length > 0 && (
                        <div className="bg-[#1a0606] border border-[#c0392b] rounded-lg p-3 max-h-36 overflow-y-auto">
                            <div className="text-[11px] font-black text-[#c0392b] uppercase mb-2">⚠ {rowErrors.length} Row Error{rowErrors.length !== 1 ? 's' : ''} (skipped)</div>
                            {rowErrors.map((e, i) => <div key={i} className="text-[11px] text-[#ff8866] font-bold">{e}</div>)}
                        </div>
                    )}

                    {/* Column format guide */}
                    <details className="group">
                        <summary className="text-[11px] font-black text-[#00BCD4] cursor-pointer uppercase tracking-wider select-none">📋 Expected Column Names (click to expand)</summary>
                        <div className="mt-2 space-y-1">
                            <div className="text-[10px] text-[#aaa] font-bold mb-1">Column names are matched case-insensitively. Extra columns in your file are ignored.</div>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-[#ccc] font-bold">
                                {[
                                    ['name ✱', 'Name, Agent Name, Agent'],
                                    ['ext ✱', 'Ext, Extension, Agent ID'],
                                    ['date', 'Date  (optional — defaults to today)'],
                                    ['loginTime ✱', 'Login Time, Login, First Login, Start Time, In Time'],
                                    ['logoutTime ✱', 'Logout Time, Logout, Last Logout, End Time, Out Time'],
                                    ['loginDur ✱', 'Login Duration, Duration, Session, Mode Duration'],
                                    ['outCalls ✱', 'OB Calls, Outbound Calls, Outbound Call, Dialed Calls'],
                                    ['outTT ✱', 'OB TT, Outbound TT, Outbound Duration, Dialed Talk Time'],
                                    ['manCalls ✱', 'MN Calls, Manual Calls, Manual Call, Inbound Call, IB Calls'],
                                    ['manTT ✱', 'MN TT, Manual TT, Manual Duration, IB Duration, Inbound Duration'],
                                    ['totalTT', 'Total TT, Total Talk Time, ATT, AHT  (optional — computed)'],
                                    ['autoIdle ✱', 'Auto Idle, Auto Idle Duration, Idle Duration, Idle Time'],
                                    ['manualIdle ✱', 'Manual Idle, Manual Idle Duration'],
                                    ['breakTime ✱', 'Break Time, Break, Total Break Duration'],
                                    ['wrapup ✱', 'Wrapup, Wrapup Duration, Wrap Up, ACW'],
                                ].map(([field, aliases]) => (
                                    <div key={field} className="bg-[#111] rounded px-2 py-1"><span className="text-[#00BCD4]">{field}:</span> {aliases}</div>
                                ))}
                            </div>
                            <div className="text-[10px] text-[#666] font-bold mt-1">
                                ✱ required &nbsp;·&nbsp; 💡 <span className="text-[#f59e0b]">loginMin/logoutMin</span> are always auto-computed from the login/logout times.
                            </div>
                        </div>
                    </details>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-1">
                        <button onClick={handleClose} className="px-4 py-1.5 border border-[#333] text-[#aaa] text-xs font-bold rounded-md hover:border-[#555] transition-all">Close</button>
                        {status === 'success' && (
                            <button onClick={handleClose} className="px-4 py-1.5 bg-[#1e7e34] border border-[#1e7e34] text-white text-xs font-black rounded-md hover:bg-[#28a745] transition-all">✓ Apply & Close</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Controls Bar ──────────────────────────────────────────────────────────────
const selectCls = "px-3.5 py-1.5 bg-[#003d4d] border-2 border-[#00BCD4] text-white text-xs font-bold rounded-md cursor-pointer font-['Arial_Black',Arial,sans-serif]";
function ControlsBar({ agents, dates, selectedAgent, filterFrom, filterTo, onAgentChange, onFromChange, onToChange, isUploaded, warningFilter, onWarningFilter, warnings }) {
    const [warnOpen, setWarnOpen] = useState(false);
    const warnRef = useRef(null);
    useEffect(() => {
        const handler = e => { if (warnRef.current && !warnRef.current.contains(e.target)) setWarnOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    // Count agents with/without warnings
    const agentsWithWarn = agents.filter(a => (warnings[a.ext] || []).length > 0).length;
    const agentsNoWarn = agents.length - agentsWithWarn;
    return (
        <div className="px-5 py-2.5 flex items-center gap-3.5 flex-wrap bg-black border-b border-[#1a1a1a]">
            {/* Warning filter dropdown */}
            <div className="relative" ref={warnRef}>
                <button onClick={() => setWarnOpen(p => !p)}
                    className={`px-3.5 py-1.5 border-2 text-[11px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all font-['Arial_Black',Arial,sans-serif] ${warningFilter !== 'all'
                        ? 'bg-[#f59e0b] border-[#f59e0b] text-black'
                        : 'bg-[#1a1000] border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b] hover:text-black'
                        }`}>
                    ⚠ Warning Filter {warnOpen ? '▲' : '▼'}
                </button>
                {warnOpen && (
                    <div className="absolute top-full left-0 mt-1 z-[500] bg-[#0d0d0d] border-2 border-[#f59e0b] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,.8)] min-w-[210px]">
                        {[
                            { v: 'all', icon: '👥', label: 'All Agents', sub: `${agents.length} total` },
                            { v: 'warned', icon: '⚠', label: 'Warning Issued', sub: `${agentsWithWarn} agents` },
                            { v: 'clean', icon: '✅', label: 'No Warning Issued', sub: `${agentsNoWarn} agents` },
                            { v: 'issues', icon: '🔴', label: 'Has Performance Issues', sub: 'Late/Idle/Break/etc.' },
                        ].map(opt => (
                            <button key={opt.v} onClick={() => { onWarningFilter(opt.v); setWarnOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all ${warningFilter === opt.v ? 'bg-[#f59e0b] text-black' : 'text-white hover:bg-[#1a1000]'
                                    }`}>
                                <span className="text-base">{opt.icon}</span>
                                <span>
                                    <div className="text-[11px] font-black">{opt.label}</div>
                                    <div className={`text-[9px] font-bold ${warningFilter === opt.v ? 'text-black/70' : 'text-[#666]'}`}>{opt.sub}</div>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <span className="text-xs font-black text-[#00BCD4] uppercase tracking-wider">👤 Agent:</span>
            <select id="agentSelect" value={selectedAgent} onChange={e => onAgentChange(e.target.value)} className={selectCls}>
                <option value="">All Agents</option>
                {agents.map(a => <option key={a.ext} value={a.ext}>{a.name}</option>)}
            </select>
            <span className="text-xs font-black text-[#00BCD4] uppercase tracking-wider">📅 From:</span>
            <select id="dateFrom" value={filterFrom} onChange={e => onFromChange(e.target.value)} className={selectCls}>
                {[...dates].reverse().map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
            <span className="text-xs font-black text-[#00BCD4] uppercase tracking-wider">To:</span>
            <select id="dateTo" value={filterTo} onChange={e => onToChange(e.target.value)} className={selectCls}>
                {[...dates].reverse().map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
        </div>
    );
}

// ── Rules Modal ───────────────────────────────────────────────────────────────
function RuleCard({ title, badge, badgeCls, borderCls, desc, eg }) {
    return (
        <div className={`bg-[#111] border border-[#1a1a1a] border-l-4 ${borderCls} rounded-md p-3.5 mb-2 grid gap-3`} style={{ gridTemplateColumns: '200px 1fr' }}>
            <div>
                <div className="text-xs font-black text-white uppercase tracking-wide leading-snug">{title}</div>
                <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full mt-1 uppercase ${badgeCls}`}>{badge}</span>
            </div>
            <div className="text-[11.5px] text-[#ccc] leading-relaxed font-semibold"
                dangerouslySetInnerHTML={{ __html: desc + (eg ? `<span class="block text-[#888] text-[11px] mt-1">${eg}</span>` : '') }} />
        </div>
    );
}

function RulesModal({ show, onClose }) {
    const SHdr = ({ children }) => <div className="text-[11px] font-black text-[#00BCD4] uppercase tracking-widest mt-4 mb-2 pb-1.5 border-b border-[#1a3a40]">{children}</div>;
    return (
        <div className={`fixed inset-0 z-[1000] bg-black/85 backdrop-blur-sm items-start justify-center overflow-y-auto p-10 ${show ? 'flex' : 'hidden'}`}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-[#0d0d0d] border-2 border-[#00BCD4] rounded-xl w-full max-w-[980px] shadow-[0_0_60px_rgba(0,188,212,.15)] animate-[modalIn_.2s_ease]">
                <div className="px-6 py-4 bg-[#003d4d] rounded-t-xl flex justify-between items-center border-b-2 border-[#00BCD4]">
                    <h2 className="text-base font-black text-[#00BCD4] uppercase tracking-widest m-0">📋 Performance Rules & Thresholds</h2>
                    <button onClick={onClose} className="bg-transparent border-2 border-[#00BCD4] text-[#00BCD4] w-8 h-8 rounded-full text-lg cursor-pointer flex items-center justify-center font-black transition-all hover:bg-[#00BCD4] hover:text-black">✕</button>
                </div>
                <div className="px-6 py-5">
                    <SHdr>🕐 1. Login / Logout Rule</SHdr>
                    <RuleCard title="Login Timing" badge="🔴 Critical" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="Agent must log in <strong>before 10:30 AM</strong> and log out at or after <strong>7:00 PM</strong>.<br/>If either fails, the <strong>Login Duration cell turns RED</strong> and waste time is added."
                        eg="Example: Login at 10:45 AM → +15 min late waste. Exit at 6:45 PM → +15 min early waste." />
                    <SHdr>📞 2. Calls (OB + MN)</SHdr>
                    <RuleCard title="Call Count" badge="ℹ Info Only" badgeCls="bg-[#60a5fa] text-black" borderCls="border-l-[#60a5fa]"
                        desc="Calls column shows <strong>Outbound (OB) + Manual (MN)</strong> combined count.<br/><strong>No red/green threshold</strong> applies on call count — it is for reference only." />
                    <SHdr>⏱️ 3. Talk Time Rule</SHdr>
                    <RuleCard title="Suspicious Talk Time" badge="🔴 Critical" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="Marked <strong>⚠ Suspicious</strong> (red) if:<br/><strong>Manual Talk Time ≥ 40% of Outbound Talk Time</strong>."
                        eg="Example: OB TT = 2h, MN TT ≥ 48m → RED ⚠" />
                    <SHdr>📝 4. Wrap-up Time Rule</SHdr>
                    <RuleCard title="Wrapup Per Call" badge="🔴 Critical" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="Average wrap-up time must be <strong>≤ 10 seconds per call</strong>.<br/>If exceeded, the Wrapup cell turns <strong>RED</strong> and excess goes to waste."
                        eg="Example: 20 calls, max allowed = 200s. Anything above = waste." />
                    <SHdr>⏸️ 5. Auto Idle</SHdr>
                    <RuleCard title="System Idle" badge="ℹ Info Only" badgeCls="bg-[#60a5fa] text-black" borderCls="border-l-[#60a5fa]"
                        desc="Auto Idle is <strong>system-generated</strong> and shown for reference only.<br/>No performance threshold is applied." />
                    <SHdr>🚫 6. Manual Idle Rule</SHdr>
                    <RuleCard title="Manual Idle Limit" badge="🔴 Critical" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="<strong>Zero tolerance</strong> — any manual idle at all is a violation.<br/>The entire duration is added directly to waste time."
                        eg="Example: 3 min manual idle → RED, 3 min added to waste." />
                    <SHdr>☕ 7. Break Time Rule</SHdr>
                    <RuleCard title="Break Limit" badge="🔴 Critical" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="Break cell turns <strong>RED</strong> if total break time exceeds <strong>1 hour</strong>.<br/>Any break over 1h counts fully as wasted time."
                        eg="Example: Break = 1h 30m → 30 min wasted." />
                    <SHdr>⚠️ Waste Time Summary</SHdr>
                    <RuleCard title="Total Waste" badge="⚠ Summary" badgeCls="bg-[#f59e0b] text-black" borderCls="border-l-[#f59e0b]"
                        desc="Waste cell shows <strong>issue count + total waste time</strong>. Aggregated from:<br/>🔴 Late Login &nbsp;|&nbsp; 🔴 Early Exit &nbsp;|&nbsp; 🚫 Manual Idle &nbsp;|&nbsp; 📝 Wrapup &gt;10s/call &nbsp;|&nbsp; ☕ Break &gt;1h &nbsp;|&nbsp; ⚠ Suspicious Talk" />
                </div>
            </div>
        </div>
    );
}

// ── Main Dashboard (default export) ──────────────────────────────────────────
export default function Dashboard() {
    const [selectedAgent, setSelectedAgent] = useState('');
    const [filterFrom, setFilterFrom] = useState(LATEST_DATE);
    const [filterTo, setFilterTo] = useState(LATEST_DATE);
    const [sortKey, setSortKey] = useState('totalCalls');
    const [sortDir, setSortDir] = useState(-1);
    const [rulesOpen, setRulesOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadedAgents, setUploadedAgents] = useState(null); // null = use default data
    const [currentHistoryId, setCurrentHistoryId] = useState(null); // Track which history item is currently loaded
    const [warnings, setWarnings] = useState(() => lsGet(LS_WARN) || {});
    const [uploadHistory, setUploadHistory] = useState([]);
    const [warnToggle, setWarnToggle] = useState({});   // { ext: bool } — current state
    const [warnToggleHistory, setWarnToggleHistory] = useState({});  // { ext: [events] }
    const [warningFilter, setWarningFilter] = useState('all');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [warnAgent, setWarnAgent] = useState(null);
    const [pendingHistoryId, setPendingHistoryId] = useState(null);

    // ── Backend: load toggle state, toggle history + upload history on mount ──
    useEffect(() => {
        // Toggle current state
        fetchWithAuth('/api/dialer/toggle/state')
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.success) setWarnToggle(d.state || {}); })
            .catch(() => { });
        // Toggle history — grouped by ext
        fetchWithAuth('/api/dialer/toggle/history')
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d?.success) {
                    const grouped = {};
                    (d.history || []).forEach(ev => {
                        if (!grouped[ev.ext]) grouped[ev.ext] = [];
                        grouped[ev.ext].push(ev);
                    });
                    setWarnToggleHistory(grouped);
                }
            })
            .catch(() => { });
        // Upload history + auto-load last upload's agents
        fetchWithAuth('/api/dialer/upload/history')
            .then(r => r.ok ? r.json() : null)
            .then(async d => {
                if (!d?.success) return;
                setUploadHistory(d.history || []);
                // Auto-load the most recent upload's agents on mount
                const latest = (d.history || [])[0];
                if (latest?.id) {
                    try {
                        const r2 = await fetchWithAuth(`/api/dialer/upload/${latest.id}/agents`);
                        const d2 = await r2.json();
                        if (d2?.success && d2.agents?.length) {
                            setUploadedAgents(d2.agents);
                            setCurrentHistoryId(latest.id);
                            const dates = [...new Set(d2.agents.map(a => a.date))].sort();
                            const earliest = dates[0]; // Use earliest date from uploaded data
                            if (earliest) { setFilterFrom(earliest); setFilterTo(earliest); }
                        }
                    } catch { /* ignore */ }
                }
            })
            .catch(() => { });
    }, []);

    // Persist warning notes to localStorage
    const updateWarnings = useCallback(updated => {
        setWarnings(updated);
        lsSet(LS_WARN, updated);
    }, []);

    // ── Warning toggle — calls backend ───────────────────────────────────────
    const handleToggleWarn = useCallback(async (ext, agentName) => {
        const currentState = warnToggle[ext] || false;
        const newAction = currentState ? 'off' : 'on';
        const uid = getCurrentUser()?._id || getCurrentUser()?.id || getCurrentUser()?.user_id || '';
        try {
            const res = await fetchWithAuth('/api/dialer/toggle', {
                method: 'POST',
                body: JSON.stringify({ ext, agent_name: agentName, action: newAction, user_id: uid }),
            });
            const data = await res.json();
            if (data.success) {
                // Optimistically update local state
                setWarnToggle(prev => ({ ...prev, [ext]: newAction === 'on' }));
                // Refresh history for this agent
                fetchWithAuth(`/api/dialer/toggle/history?ext=${encodeURIComponent(ext)}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.success) {
                            setWarnToggleHistory(prev => ({ ...prev, [ext]: d.history || [] }));
                        }
                    }).catch(() => { });
            }
        } catch (e) {
            console.error('Toggle error', e);
        }
    }, [warnToggle]);

    // Derived dataset: use uploaded if present, else default
    // null uploadedAgents = no file uploaded yet → empty dataset
    const activeAgents = uploadedAgents || [];

    const handleUpload = useCallback(async (agents, filename, fileSize, existingId, isMerge = false) => {
        // When isMerge=true, agents contains only NEW records; merge them with current data
        let finalAgents = agents;
        if (isMerge && uploadedAgents?.length) {
            finalAgents = [...uploadedAgents, ...agents];
        }
        setUploadedAgents(finalAgents);
        const dates = [...new Set(finalAgents.map(a => a.date))].sort();
        const earliest = dates[0]; // Use first date (Excel file date) instead of latest
        setFilterFrom(earliest);
        setFilterTo(earliest);
        setSelectedAgent('');
        const uid = getCurrentUser()?._id || getCurrentUser()?.id || getCurrentUser()?.user_id || '';
        // For merge: update the most recent upload entry
        const targetId = existingId || (isMerge && uploadHistory.length > 0 ? uploadHistory[0].id : null);
        let savedId = targetId;
        try {
            if (targetId) {
                await fetchWithAuth(`/api/dialer/upload/${targetId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ filename: filename || 'upload.xlsx', record_count: finalAgents.length, file_size: fileSize || null, user_id: uid, agents: finalAgents }),
                });
            } else {
                const res = await fetchWithAuth('/api/dialer/upload', {
                    method: 'POST',
                    body: JSON.stringify({ filename: filename || 'upload.xlsx', record_count: finalAgents.length, file_size: fileSize || null, user_id: uid, agents: finalAgents }),
                });
                const resData = await res.json();
                if (resData.success && resData.upload?.id) savedId = resData.upload.id;
            }
            setCurrentHistoryId(savedId); // Track which history item is currently loaded
            const r = await fetchWithAuth('/api/dialer/upload/history');
            const d = await r.json();
            if (d.success) setUploadHistory(d.history || []);
        } catch (e) { console.error('Upload save error', e); }
    }, [uploadedAgents, uploadHistory]);

    const handleClearUpload = useCallback(() => {
        setUploadedAgents(null);
        setCurrentHistoryId(null);
        setFilterFrom(LATEST_DATE);
        setFilterTo(LATEST_DATE);
        setSelectedAgent('');
    }, []);

    // Upload History handlers — all via backend
    const handleHistoryLoad = useCallback(async h => {
        try {
            const r = await fetchWithAuth(`/api/dialer/upload/${h.id}/agents`);
            const d = await r.json();
            if (!d.success || !d.agents?.length) { alert('Cannot reload: data not found. Please re-upload the file.'); return; }
            setUploadedAgents(d.agents);
            setCurrentHistoryId(h.id); // Track which history item is loaded
            const dates = [...new Set(d.agents.map(a => a.date))].sort();
            setFilterFrom(dates[0]); // Use first date (Excel file date)
            setFilterTo(dates[0]);
            setSelectedAgent('');
            setHistoryOpen(false);
        } catch { alert('Failed to load upload data.'); }
    }, []);
    const handleHistoryDelete = useCallback(async id => {
        try {
            await fetchWithAuth(`/api/dialer/upload/${id}`, { method: 'DELETE' });
            const newHistory = uploadHistory.filter(h => h.id !== id);
            setUploadHistory(newHistory);
            // If the currently loaded data is from this history item, clear it
            if (currentHistoryId === id) {
                setUploadedAgents(null);
                setCurrentHistoryId(null);
                setFilterFrom(LATEST_DATE);
                setFilterTo(LATEST_DATE);
                setSelectedAgent('');
            }
            // If all history deleted, clear uploaded data
            else if (newHistory.length === 0) {
                setUploadedAgents(null);
                setCurrentHistoryId(null);
                setFilterFrom(LATEST_DATE);
                setFilterTo(LATEST_DATE);
                setSelectedAgent('');
            }
        } catch { console.error('Delete error'); }
    }, [uploadHistory, currentHistoryId]);
    const handleHistoryUpdate = useCallback((id) => {
        setPendingHistoryId(id);
        setHistoryOpen(false);
        setUploadOpen(true);
    }, []);

    const setFrom = v => { if (v > filterTo) { setFilterFrom(filterTo); setFilterTo(v); } else setFilterFrom(v); };
    const setTo = v => { if (v < filterFrom) { setFilterTo(filterFrom); setFilterFrom(v); } else setFilterTo(v); };
    const isMultiDate = filterFrom !== filterTo;
    const isSingleAgent = !!selectedAgent;

    // Derived lists from active dataset
    const activeDates = useMemo(() => [...new Set(activeAgents.map(a => a.date))].sort(), [activeAgents]);
    const activeUniqueAgents = useMemo(() => {
        const seen = new Set(), list = [];
        activeAgents.forEach(a => { if (!seen.has(a.ext)) { seen.add(a.ext); list.push({ ext: a.ext, name: a.name }); } });
        return list;
    }, [activeAgents]);
    const activeAgentOrder = useMemo(() => {
        const arr = [];
        activeAgents.forEach(a => { if (!arr.includes(a.ext)) arr.push(a.ext); });
        return arr;
    }, [activeAgents]);
    const activeAgentSN = useMemo(() => {
        const map = {}; let n = 1;
        activeAgents.forEach(a => { if (map[a.ext] === undefined) map[a.ext] = n++; });
        return map;
    }, [activeAgents]);

    useEffect(() => {
        document.body.style.overflow = rulesOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [rulesOpen]);

    const processed = useMemo(() => {
        let raw = activeAgents.filter(a => a.date >= filterFrom && a.date <= filterTo && (!selectedAgent || a.ext === selectedAgent));
        // Deduplicate by (ext, date) — keep last occurrence
        const seen = new Map();
        raw.forEach(a => seen.set(`${a.ext}__${a.date}`, a));
        raw = [...seen.values()];
        if (isSingleAgent) raw.sort((a, b) => a.date.localeCompare(b.date));
        else if (isMultiDate) raw.sort((a, b) => {
            const ai = activeAgentOrder.indexOf(a.ext), bi = activeAgentOrder.indexOf(b.ext);
            return ai !== bi ? ai - bi : a.date.localeCompare(b.date);
        });
        // Run proc() on all rows
        let pd = raw.map(a => proc(a));
        const rkMap = {};
        [...pd].sort((a, b) => b.outCalls - a.outCalls).forEach((a, i) => { rkMap[`${a.ext}_${a.date}`] = i + 1; });
        pd.forEach(a => { a._rank = rkMap[`${a.ext}_${a.date}`] || 99; });
        return pd;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterFrom, filterTo, selectedAgent, uploadedAgents, activeAgentOrder]);

    const sortedList = useMemo(() => {
        let base = processed;
        // Apply warning filter
        if (warningFilter === 'warned') {
            base = base.filter(a => (warnings[a.ext] || []).length > 0 || !!warnToggle[a.ext]);
        } else if (warningFilter === 'clean') {
            base = base.filter(a => (warnings[a.ext] || []).length === 0 && !warnToggle[a.ext]);
        } else if (warningFilter === 'issues') {
            base = base.filter(a => a.isLate || a.isEarly || a.miBad || a.brkBad || a.wuBad || a.ttBad);
        }
        if (isMultiDate && !isSingleAgent) return base;
        const kfn = {
            rank: x => x.outCalls, name: x => x.name.toLowerCase(),
            loginDur: x => x.ldSec, totalCalls: x => x.tc, totalTT: x => x.ttSec,
            wrapup: x => x.avgWu, autoIdle: x => toSec(x.autoIdle),
            manualIdle: x => x.miSec, breakTime: x => x.brkSec, wasteSec: x => x.wasteSec,
        };
        return [...base].sort((a, b) => {
            const f = kfn[sortKey] || (() => 0);
            const av = f(a), bv = f(b);
            return av < bv ? -sortDir : av > bv ? sortDir : 0;
        });
    }, [processed, sortKey, sortDir, isMultiDate, isSingleAgent, warningFilter, warnings, warnToggle]);

    // Sequential SN: 1, 2, 3... per unique agent in the sorted visible list
    const agentSeqNum = useMemo(() => {
        const map = {}; let n = 1;
        sortedList.forEach(a => { if (!(a.ext in map)) map[a.ext] = n++; });
        return map;
    }, [sortedList]);

    const kpis = useMemo(() => {
        const pd = processed;
        const totalCalls = pd.reduce((s, a) => s + a.tc, 0);
        const totalTTSec = pd.reduce((s, a) => s + a.ttSec, 0);
        const avgLdH = pd.length > 0 ? (pd.reduce((s, a) => s + a.ldSec, 0) / pd.length / 3600).toFixed(1) : '0.0';
        const lateCount = pd.filter(a => a.isLate || a.isEarly).length;
        const miCount = pd.filter(a => a.miBad).length;
        const totalWaste = (pd.reduce((s, a) => s + a.wasteSec, 0) / 3600).toFixed(1);
        return [
            { id: 'k1', label: 'Total Calls', value: totalCalls.toLocaleString('en-IN'), sub: 'Team total', color: 'ck-b' },
            { id: 'k2', label: 'Total Talk Time', value: (totalTTSec / 3600).toFixed(1) + 'h', sub: 'hrs across team', color: 'ck-g' },
            { id: 'k3', label: 'Avg Login Duration', value: avgLdH + 'h', sub: 'Target 8:30 hrs', color: 'ck-p' },
            { id: 'k4', label: 'Late Logins', value: lateCount, sub: 'After 10:30 AM', color: 'ck-y' },
            { id: 'k5', label: 'Manual Idle Issues', value: miCount, sub: 'any idle agents', color: 'ck-r' },
            { id: 'k6', label: 'Total Team Waste', value: totalWaste + 'h', sub: 'hrs wasted today', color: 'ck-o' },
        ];
    }, [processed]);

    const agentCount = useMemo(() => {
        const visible = activeAgents.filter(a => a.date >= filterFrom && a.date <= filterTo && (!selectedAgent || a.ext === selectedAgent));
        return [...new Set(visible.map(a => a.ext))].length;
    }, [activeAgents, filterFrom, filterTo, selectedAgent]);

    const handleSort = k => { if (sortKey === k) setSortDir(d => d * -1); else { setSortKey(k); setSortDir(-1); } };

    return (
        <div id="dialer-root" className="bg-black text-white min-h-full w-full" style={{ fontSize: '11px', fontWeight: 600, fontFamily: '"Segoe UI", system-ui, sans-serif', minWidth: '1240px', lineHeight: 1.5 }}>
            <style>{`
                /* Reset rem base inside dialer to standard 16px so all rem calcs are correct */
                #dialer-root { font-size: 13px !important; }
                #dialer-root * { box-sizing: border-box; }

                /* Override global zoom-scaled Tailwind text classes back to real px values */
                #dialer-root .text-xs    { font-size: 12px  !important; line-height: 1rem    !important; }
                #dialer-root .text-sm    { font-size: 14px  !important; line-height: 1.25rem !important; }
                #dialer-root .text-base  { font-size: 16px  !important; line-height: 1.5rem  !important; }
                #dialer-root .text-lg    { font-size: 18px  !important; line-height: 1.75rem !important; }
                #dialer-root .text-xl    { font-size: 20px  !important; line-height: 1.75rem !important; }
                #dialer-root .text-2xl   { font-size: 24px  !important; line-height: 2rem    !important; }
                #dialer-root .text-3xl   { font-size: 30px  !important; }
                #dialer-root .text-4xl   { font-size: 36px  !important; }

                /* Arbitrary size overrides */
                #dialer-root .text-\[9px\]     { font-size: 9px    !important; }
                #dialer-root .text-\[10px\]    { font-size: 10px   !important; }
                #dialer-root .text-\[11px\]    { font-size: 11px   !important; }
                #dialer-root .text-\[11\.5px\] { font-size: 11.5px !important; }
                #dialer-root .text-\[12px\]    { font-size: 12px   !important; }
                #dialer-root .text-\[13px\]    { font-size: 13px   !important; }
                #dialer-root .text-\[14px\]    { font-size: 14px   !important; }
                #dialer-root .text-\[15px\]    { font-size: 15px   !important; }
                #dialer-root .text-\[16px\]    { font-size: 16px   !important; }
                #dialer-root .text-\[17px\]    { font-size: 17px   !important; }
                #dialer-root .text-\[18px\]    { font-size: 18px   !important; }
                #dialer-root .text-\[22px\]    { font-size: 22px   !important; }

                /* Override the global h/h1-h6 font-size: inherit so headings stay their set size */
                #dialer-root h1, #dialer-root h2, #dialer-root h3,
                #dialer-root h4, #dialer-root h5, #dialer-root h6 { font-size: inherit !important; }

                /* Scrollbar */
                #dialer-root ::-webkit-scrollbar { width: 5px; height: 5px; }
                #dialer-root ::-webkit-scrollbar-track { background: #000; }
                #dialer-root ::-webkit-scrollbar-thumb { background: #252525; border-radius: 3px; }
                #dialer-root ::-webkit-scrollbar-thumb:hover { background: #444; }

                /* KPI border-top colour strips */
                #dialer-root .kpi-strip-b { background: #60a5fa; }
                #dialer-root .kpi-strip-g { background: #1e7e34; }
                #dialer-root .kpi-strip-p { background: #a78bfa; }
                #dialer-root .kpi-strip-y { background: #00BCD4; }
                #dialer-root .kpi-strip-r { background: #c0392b; }
                #dialer-root .kpi-strip-o { background: #fb923c; }

                /* Table thead sticky inside scroll container */
                #dialer-root thead { position: sticky; top: 0; z-index: 50; }
                #dialer-root thead tr { background: #ffffff !important; }
                #dialer-root thead th {
                    background: #ffffff;
                    border-bottom: 2px solid #00BCD4;
                    border-right: 1px solid #e0e0e0;
                    font-size: 12px !important;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: .8px;
                    color: #00BCD4;
                    cursor: pointer;
                    white-space: nowrap;
                    user-select: none;
                    text-align: left;
                    padding: 10px 12px;
                    transition: all .15s;
                }
                #dialer-root thead th:last-child { border-right: none; }
                #dialer-root thead th:hover { background: #f0f8ff; color: #0097a7; }
                #dialer-root tbody tr { border-bottom: 2px solid #1a1a1a; }
                #dialer-root tbody tr:last-child { border-bottom: none; }
                #dialer-root tbody tr:hover td { background: #0a0a0a; }
                #dialer-root td { padding: 8px 10px; border-right: 1px solid #1a1a1a; vertical-align: top; background: transparent; }
                #dialer-root td:last-child { border-right: none; }
            `}</style>
            <Topbar filterFrom={filterFrom} filterTo={filterTo} selectedAgent={selectedAgent} agentCount={agentCount} isUploaded={!!uploadedAgents} onClearUpload={handleClearUpload} onOpenRules={() => setRulesOpen(true)} onOpenUpload={() => setUploadOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />
            <KpiRow kpis={kpis} />
            <ControlsBar agents={activeUniqueAgents} dates={activeDates} selectedAgent={selectedAgent} filterFrom={filterFrom} filterTo={filterTo}
                onAgentChange={setSelectedAgent} onFromChange={setFrom} onToChange={setTo}
                isUploaded={!!uploadedAgents} warningFilter={warningFilter} onWarningFilter={setWarningFilter} warnings={warnings} />
            <RulesModal show={rulesOpen} onClose={() => setRulesOpen(false)} />
            <ExcelUploadModal show={uploadOpen} onClose={() => { setUploadOpen(false); setPendingHistoryId(null); }}
                onUpload={(agents, filename, fileSize, isMerge) => handleUpload(agents, filename, fileSize, pendingHistoryId, isMerge)}
                existingAgents={uploadedAgents} uploadHistory={uploadHistory} />
            <UploadHistoryPanel show={historyOpen} onClose={() => setHistoryOpen(false)} history={uploadHistory}
                onLoad={handleHistoryLoad} onDelete={handleHistoryDelete} onUpdate={handleHistoryUpdate} />

            <WarningModal show={!!warnAgent} agent={warnAgent} warnings={warnings} onSave={updateWarnings} onClose={() => setWarnAgent(null)} />
            {!uploadedAgents ? (
                <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                    <div className="text-[52px] mb-4">📂</div>
                    <div className="text-[16px] font-black text-white mb-2">No Data Uploaded</div>
                    <div className="text-[12px] text-[#555] font-bold mb-6">Upload an Excel file to view agent performance data.<br />Previous uploads can be reloaded from Upload History.</div>
                    <div className="flex gap-3">
                        <button onClick={() => setUploadOpen(true)}
                            className="px-5 py-2 bg-[#00BCD4] text-black text-[12px] font-black rounded-lg hover:bg-[#0097a7] transition-all">
                            📤 Upload Excel
                        </button>
                        <button onClick={() => setHistoryOpen(true)}
                            className="px-5 py-2 bg-[#1a1a1a] border border-[#333] text-white text-[12px] font-black rounded-lg hover:border-[#a78bfa] transition-all">
                            📂 Upload History
                        </button>
                    </div>
                </div>
            ) : (
                <AgentTable list={sortedList} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} isMultiDate={isMultiDate} isSingleAgent={isSingleAgent}
                    warnings={warnings} onWarn={setWarnAgent} warnToggle={warnToggle} warnToggleHistory={warnToggleHistory} onToggle={handleToggleWarn} agentSeqNum={activeAgentSN} />
            )}
        </div>
    );
}
