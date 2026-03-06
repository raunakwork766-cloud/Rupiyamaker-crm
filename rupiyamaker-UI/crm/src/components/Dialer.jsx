import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    
    const handleCopy = async (e) => {
        e.stopPropagation(); // Prevent any parent handlers
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                setDone(true);
                setTimeout(() => setDone(false), 1800);
            } else {
                // Fallback for older browsers or non-HTTPS
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        setDone(true);
                        setTimeout(() => setDone(false), 1800);
                    }
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                }
                document.body.removeChild(textarea);
            }
        } catch (err) {
            console.error('Copy failed:', err);
            // Try execCommand as final fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                document.execCommand('copy');
                setDone(true);
                setTimeout(() => setDone(false), 1800);
            } catch (fallbackErr) {
                console.error('All copy methods failed:', fallbackErr);
            }
            document.body.removeChild(textarea);
        }
    };
    
    return (
        <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all border ${
                done
                    ? 'bg-[#16a34a] border-[#16a34a] text-white'
                    : 'bg-[#1a1a1a] border-[#444] text-[#aaa] hover:bg-[#2a2a2a] hover:border-[#888] hover:text-white hover:scale-110'
            }`}>
            {done
                ? <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                : <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.378 4.5H7v-1z" /><path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" /></svg>
            }
        </button>
    );
}

function CBox({ ok, neutral, children }) {
    const cls = neutral ? 'bg-[#0a0a0a] border-[#252525]' : ok ? 'bg-[#1e7e34] border-[#1e7e34]' : 'bg-[#c0392b] border-[#c0392b]';
    return <div className={`rounded-md font-bold ${cls} text-white`} style={{ padding: '4px 8px', border: '1.5px solid' }}>{children}</div>;
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
            <div className="text-[13px] font-black leading-tight font-['Arial_Black',Arial,sans-serif] pb-0.5">{a.loginDur}</div>
            <div className="flex flex-col gap-1 mt-0.5">
                <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                    <span className="bg-[#2196f3] text-white border border-[#2196f3] text-[10px] font-black px-1.5 py-0 rounded min-w-[32px] text-center flex-shrink-0">IN</span>
                    <span className="leading-tight whitespace-nowrap">{loginParts.time || a.loginTime}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                    <span className="bg-[#f44336] text-white border border-[#f44336] text-[10px] font-black px-1.5 py-0 rounded min-w-[32px] text-center flex-shrink-0">OUT</span>
                    <span className="leading-tight whitespace-nowrap">{logoutParts.time || a.logoutTime}</span>
                </div>
            </div>
        </CBox>
    );
}

function CallsCell({ a }) {
    // Debug: log manual calls value
    useEffect(() => {
        if (a.manCalls > 0) {
            console.log('[CallsCell] Agent with manual calls:', {
                name: a.name,
                ext: a.ext,
                manCalls: a.manCalls,
                outCalls: a.outCalls,
                tc: a.tc
            });
        }
    }, [a.manCalls, a.name, a.ext, a.outCalls, a.tc]);
    
    return (
        <CBox ok={true}>
            <div className="text-[13px] font-black font-['Arial_Black',Arial,sans-serif] pb-0.5 whitespace-nowrap">{a.tc}</div>
            <div className="flex flex-col gap-0.5 mt-0.5">
                <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                    <span className="bg-[#2a4a75] text-[#70b3ff] border border-[#60a5fa] text-[9px] font-black px-1 py-0 rounded min-w-[24px] text-center">OB</span>
                    <span className="font-extrabold text-[11px]">{a.outCalls}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                    <span className="bg-[#9c27b0] text-white border border-[#9c27b0] text-[9px] font-black px-1 py-0 rounded min-w-[24px] text-center">MN</span>
                    <span className="font-extrabold text-[11px]">{a.manCalls}</span>
                </div>
            </div>
        </CBox>
    );
}

function TalkTimeCell({ a }) {
    // Debug: log manual talk time value
    useEffect(() => {
        if (a.manTT && a.manTT !== '00:00:00') {
            console.log('[TalkTimeCell] Agent with manual TT:', {
                name: a.name,
                ext: a.ext,
                manTT: a.manTT,
                outTT: a.outTT,
                totalTT: a.totalTT
            });
        }
    }, [a.manTT, a.name, a.ext, a.outTT, a.totalTT]);
    
    return (
        <CBox ok={!a.ttBad}>
            <div className="text-[13px] font-black font-['Arial_Black',Arial,sans-serif] pb-0.5 whitespace-nowrap">{a.totalTT}</div>
            <div className="flex flex-col gap-0.5 mt-0.5">
                <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                    <span className="bg-[#2a4a75] text-[#70b3ff] border border-[#60a5fa] text-[9px] font-black px-1 py-0 rounded min-w-[24px] text-center">OB</span>
                    <span className="font-extrabold text-[11px]">{a.outTT}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                    <span className="bg-[#9c27b0] text-white border border-[#9c27b0] text-[9px] font-black px-1 py-0 rounded min-w-[24px] text-center">MN</span>
                    <span className="font-extrabold text-[11px]">{a.manTT}</span>
                </div>
            </div>
            {a.ttBad && <div className="text-[10px] font-bold mt-0.5 whitespace-nowrap">⚠ Suspicious TT</div>}
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
            <div className="text-[11px] font-black font-['Arial_Black',Arial,sans-serif] leading-snug whitespace-nowrap">{a.wrapup}<span className="opacity-[0.45]"> · </span>{avgWuDisp} / call</div>
            <div className="text-[10px] mt-0.5 font-bold opacity-[0.65] border-t border-white/20 pt-0.5 whitespace-nowrap">Max: {maxWuDisp} · 10s / call</div>
            {a.wuBad && <div className="text-[10px] mt-0.5 font-black bg-black/30 rounded px-1 py-0 inline-block whitespace-nowrap">+ Extra: <strong>{hmShort(a.wuWaste)}</strong></div>}
        </CBox>
    );
}

function IdleCell({ val, bad, sub }) {
    return (
        <CBox ok={!bad} neutral={!bad && sub === undefined}>
            <div className="text-[11px] font-extrabold font-['Arial_Black',Arial,sans-serif] whitespace-nowrap">{val}{bad ? ' ⚠' : ''}</div>
            {bad && sub && <div className="text-[10px] mt-0 font-bold whitespace-nowrap">{sub}</div>}
        </CBox>
    );
}

function BreakCell({ a }) {
    return (
        <CBox ok={!a.brkBad}>
            <div className="text-[11px] font-extrabold font-['Arial_Black',Arial,sans-serif] whitespace-nowrap">{a.breakTime}{a.brkBad ? ' ⚠' : ''}</div>
            {a.brkBad && <div className="text-[10px] mt-0 font-bold whitespace-nowrap">+{hmShort(a.brkSec - MAX_BRK_SEC)} over</div>}
        </CBox>
    );
}

function WasteCell({ a }) {
    const issues = [];
    if (a.isLate) issues.push({ label: `Late Login: +${a.lateMins >= 60 ? Math.floor(a.lateMins/60) + 'h ' + (a.lateMins%60 > 0 ? a.lateMins%60 + 'm' : '') : a.lateMins + 'm'}`, value: hmShort(a.lateWaste) });
    if (a.isEarly) issues.push({ label: `Early Exit: -${a.earlyMins >= 60 ? Math.floor(a.earlyMins/60) + 'h ' + (a.earlyMins%60 > 0 ? a.earlyMins%60 + 'm' : '') : a.earlyMins + 'm'}`, value: hmShort(a.earlyWaste) });
    if (a.miBad) issues.push({ label: `Manual Idle`, value: hmShort(a.miSec) });
    if (a.wuBad) {
        const _d = a.avgWu < 60 ? `${a.avgWu}s` : `${Math.floor(a.avgWu / 60)}m ${a.avgWu % 60 > 0 ? a.avgWu % 60 + 's' : ''}`;
        issues.push({ label: `Wrapup Avg ${_d}/call (>10s)`, value: hmShort(a.wuWaste) });
    }
    if (a.ttBad) issues.push({ label: `⚠ Suspicious Talk Time (info only)`, value: hmShort(a.manTTs) });
    if (a.brkBad) issues.push({ label: `Break Exceeded (>1h)`, value: hmShort(a.brkWaste) });
    if (a.wasteSec === 0 && issues.length === 0) {
        return <div className="rounded-md border-2 bg-[#1e7e34] border-[#1e7e34] text-white font-['Arial_Black',Arial,sans-serif] font-black text-xs whitespace-nowrap" style={{ padding: '4px 8px' }}>✓ No Issues</div>;
    }
    const cpTxt = `📅 *${fmtDate(a.date)}*\n*Agent: ${a.name} (${a.ext})*\n\n`
        + issues.map((iss, i) => `${i + 1}. ${iss.label} → ${iss.value}`).join('\n')
        + `\n\n*Total Waste: ${hms(a.wasteSec)} (${a.wastePct}% of shift)*`;
    return (
        <div className="rounded-md border-2 bg-[#c0392b] border-[#c0392b] text-white font-['Arial_Black',Arial,sans-serif]" style={{ padding: '4px 8px' }}>
            <div className="text-[12px] font-black mb-1 flex justify-between items-center gap-2">
                <span className="flex-1 leading-snug">
                    <span className="text-[10px] opacity-80">{issues.length} Issue{issues.length !== 1 ? 's' : ''} &nbsp;·&nbsp;</span>
                    Total: {hms(a.wasteSec)} ({a.wastePct}%)
                </span>
                <WaBtn text={cpTxt} />
            </div>
            <div className="flex flex-col gap-1">
                {issues.map((iss, i) => (
                    <div key={i} className="grid gap-2 items-center whitespace-nowrap" style={{ gridTemplateColumns: 'auto auto' }}>
                        <div className="text-[11px] font-bold leading-none">• {iss.label}</div>
                        <div className="text-[13px] font-black text-right whitespace-nowrap">{iss.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Agent Table ───────────────────────────────────────────────────────────────
function AgentTable({ list, sortKey, sortDir, onSort, isMultiDate, isSingleAgent, warnings, onWarn, warnToggle, warnToggleHistory, onToggle, agentSeqNum = {}, agentRemarks = {}, onAddRemark, onDeleteRemark, agentMappings = {} }) {
    const [togglePopExt, setTogglePopExt] = useState(null); // ext whose history modal is open
    const [warnPopup, setWarnPopup] = useState(null); // { ext, name, date, isMultiDate, warnKey } — agent being warned
    const [warnRemarks, setWarnRemarks] = useState('');
    const [justifyPopup, setJustifyPopup] = useState(null); // { ext, name, date, isMultiDate, warnKey } — agent being justified
    const [justifyRemarks, setJustifyRemarks] = useState('');
    const [remarkPopup, setRemarkPopup] = useState(null); // { ext, name, date } — agent getting a remark
    const [remarkType, setRemarkType] = useState('Training');
    const [remarkText, setRemarkText] = useState('');
    const [remarkMins, setRemarkMins] = useState('');
    const [justDetailPopup, setJustDetailPopup] = useState(null); // { ext, name, date } — view justification details
    const remarkTypes = ['Training', 'Disbursal Call', 'Talking to Customer', 'System Issue', 'Other'];
    const SortTh = ({ k, children }) => (
        <th onClick={() => onSort(k)} className={`px-3 py-2 bg-white border-b-2 border-[#00BCD4] border-r border-gray-200 last:border-r-0 text-xs font-black uppercase tracking-widest text-[#00BCD4] cursor-pointer whitespace-nowrap select-none text-left transition-all hover:bg-blue-50 hover:text-[#0097a7]`}>
            {children}{sortKey === k && <span className="ml-1 text-[10px]">{sortDir === -1 ? '▼' : '▲'}</span>}
        </th>
    );
    return (
        <div className="px-5 pb-8 dialer-table-wrap">
            <table className="border-separate border-spacing-0 bg-black" style={{ tableLayout: 'auto', width: '100%', minWidth: '1400px' }}>
                <thead className="sticky top-0 z-50">
                    <tr>
                        <th className="sticky-col-0 px-3 py-2 bg-white border-b-2 border-[#00BCD4] border-r border-gray-200 text-xs font-black uppercase tracking-widest text-[#00BCD4] whitespace-nowrap w-10">#</th>
                        <th onClick={() => onSort('name')} className="sticky-col-1 px-3 py-2 bg-white border-b-2 border-[#00BCD4] border-r border-gray-200 text-xs font-black uppercase tracking-widest text-[#00BCD4] cursor-pointer whitespace-nowrap select-none text-left transition-all hover:bg-blue-50 hover:text-[#0097a7]">Agent{sortKey === 'name' && <span className="ml-1 text-[10px]">{sortDir === -1 ? '▼' : '▲'}</span>}</th>
                        <SortTh k="loginDur">Login Duration</SortTh>
                        <SortTh k="totalCalls">Calls</SortTh>
                        <SortTh k="totalTT">Talk Time</SortTh>
                        <SortTh k="wrapup">Wrapup</SortTh>
                        <SortTh k="autoIdle">Auto Idle</SortTh>
                        <SortTh k="manualIdle">Manual Idle</SortTh>
                        <SortTh k="breakTime">Break</SortTh>
                        <SortTh k="wasteSec">Waste Time</SortTh>
                        <th className="px-3 py-2 bg-white border-b-2 border-[#22c55e] text-xs font-black uppercase tracking-widest text-[#22c55e] whitespace-nowrap">⏱ Justification</th>
                        <th className="px-3 py-2 bg-white border-b-2 border-[#f59e0b] text-xs font-black uppercase tracking-widest text-[#f59e0b] whitespace-nowrap">⚡ Status</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((a, idx) => {
                        // Serial number logic — true sequential numbering (1,2,3,4...)
                        // Use composite key for multi-date to get unique serial per row
                        const snKey = isMultiDate ? `${a.ext}_${a.date}` : a.ext;
                        const sn = agentSeqNum[snKey] || idx + 1;
                        return (
                            <tr key={`${a.ext}_${a.date}_${idx}`} className="hover:bg-[#0a0a0a]">
                                <td className="sticky-col-0 px-2 py-1.5 border-r border-[#1a1a1a] align-middle bg-black">
                                    <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-black bg-[#111111] text-[#aaaaaa] border border-[#333333]">{sn}</span>
                                </td>
                                <td className="sticky-col-1 px-2.5 py-1.5 border-r border-[#1a1a1a] align-middle bg-black">
                                    {(() => {
                                        const mp = agentMappings[a.ext];
                                        return <>
                                            <div className="font-black text-[12px] text-white leading-tight whitespace-nowrap" style={{ letterSpacing: '.2px' }}>{mp?.mapped_name || a.name}</div>
                                            {!isSingleAgent && (
                                                <>
                                                    <div className="text-[10px] text-[#777] font-bold mt-0.5 whitespace-nowrap">Ext: {a.ext}</div>
                                                    {mp?.mapped_name && a.name !== mp.mapped_name && (
                                                        <div className="text-[10px] text-[#666] font-bold mt-0 whitespace-nowrap truncate" style={{ maxWidth: '130px' }}>{a.name}</div>
                                                    )}
                                                </>
                                            )}
                                            {(mp?.designation || mp?.team) && (
                                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                    {mp.designation && <span className="text-[9px] font-black bg-[#60a5fa]/15 text-[#60a5fa] border border-[#60a5fa]/30 px-1 py-0 rounded">{mp.designation}</span>}
                                                    {mp.team && <span className="text-[9px] font-black bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 px-1 py-0 rounded">{mp.team}</span>}
                                                </div>
                                            )}
                                            <div className="text-[9px] text-[#00BCD4] font-black mt-0.5 whitespace-nowrap">{fmtDate(a.date)}</div>
                                        </>;
                                    })()}
                                </td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><SessionCell a={a} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><CallsCell a={a} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><TalkTimeCell a={a} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><WrapupCell a={a} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><IdleCell val={a.autoIdle} bad={false} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><IdleCell val={a.manualIdle} bad={a.miBad} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><BreakCell a={a} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle"><WasteCell a={a} /></td>
                                <td className="px-2 py-1.5 border-r border-[#1a1a1a] align-middle">
                                    {/* Justification column — WasteCell style */}
                                    {(() => {
                                        const remarkKey = `${a.ext}__${a.date}`;
                                        const myRemarks = (agentRemarks && agentRemarks[remarkKey]) || [];
                                        const totalMins = myRemarks.reduce((s, r) => s + (r.time_minutes || 0), 0);
                                        const fmtMins = m => {
                                            if (m <= 0) return '0m';
                                            const h = Math.floor(m / 60), rm = m % 60;
                                            if (h > 0 && rm > 0) return `${h}h ${rm}m`;
                                            if (h > 0) return `${h}h`;
                                            return `${rm}m`;
                                        };
                                        if (myRemarks.length === 0) {
                                            return (
                                                <button onClick={() => { setRemarkPopup({ ext: a.ext, name: a.name, date: a.date }); setRemarkType('Training'); setRemarkText(''); setRemarkMins(''); }}
                                                    className="w-7 h-7 rounded-lg bg-[#0a1a0e] border border-[#22c55e]/30 hover:border-[#22c55e] hover:bg-[#22c55e]/15 text-[#22c55e]/50 hover:text-[#22c55e] transition-all flex items-center justify-center"
                                                    title="Add justification">
                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" /></svg>
                                                </button>
                                            );
                                        }
                                        return (
                                            <div className="rounded-md border-2 bg-[#052a0e] border-[#22c55e] text-white font-['Arial_Black',Arial,sans-serif] cursor-pointer"
                                                style={{ padding: '5px 8px' }}
                                                onDoubleClick={() => setJustDetailPopup({ ext: a.ext, name: a.name, date: a.date })}
                                                title="Double-click to view details">
                                                {/* Header: single row — count + total + add button */}
                                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                                    <span className="text-[11px] font-black text-[#22c55e] whitespace-nowrap leading-none">
                                                        {myRemarks.length}&nbsp;·&nbsp;{fmtMins(totalMins)}
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); setRemarkPopup({ ext: a.ext, name: a.name, date: a.date }); setRemarkType('Training'); setRemarkText(''); setRemarkMins(''); }}
                                                        className="w-5 h-5 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/50 hover:bg-[#22c55e]/40 text-[#22c55e] flex items-center justify-center transition-all flex-shrink-0"
                                                        title="Add justification">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5"><path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" /></svg>
                                                    </button>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    {myRemarks.slice(0, 4).map((r, ri) => (
                                                        <div key={ri} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '1fr auto' }}>
                                                            <div className="text-[10px] font-bold leading-none text-white truncate">• {r.remark_type}</div>
                                                            <div className="text-[11px] font-black text-right text-white whitespace-nowrap">{fmtMins(r.time_minutes)}</div>
                                                        </div>
                                                    ))}
                                                    {myRemarks.length > 4 && (
                                                        <div className="text-[9px] text-[#22c55e]/60 font-bold text-left mt-0.5">+{myRemarks.length - 4} more — double-click to see all</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className="px-2 py-1.5 align-middle">
                                    {/* 3-State Status: No Review / Warned / Justified */}
                                    {(() => {
                                        const warnKey = isMultiDate ? `${a.ext}_${a.date}` : a.ext;
                                        const status = (warnToggle && warnToggle[warnKey]) || 'off';
                                        const isWarned = status === 'on';
                                        const isJustified = status === 'justified';
                                        const hist = (warnToggleHistory && warnToggleHistory[warnKey]) || [];
                                        const allHist = hist.filter(h => h.action === 'on' || h.action === 'justified');
                                        return (
                                            <div className="flex flex-col gap-1.5">
                                                {isWarned ? (
                                                    <button onClick={() => onToggle(a.ext, a.name, a.date, isMultiDate, 'off')}
                                                        title="Click to remove warning"
                                                        className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] shadow-[0_0_12px_rgba(245,158,11,.4)] text-black transition-all hover:shadow-[0_0_18px_rgba(245,158,11,.6)] whitespace-nowrap">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                                                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="text-[10px] font-black uppercase tracking-wide">Warned</span>
                                                        <span className="text-[9px] font-black opacity-70 ml-0.5 group-hover:opacity-100">✕</span>
                                                    </button>
                                                ) : isJustified ? (
                                                    <button onClick={() => onToggle(a.ext, a.name, a.date, isMultiDate, 'off')}
                                                        title="Click to remove justified status"
                                                        className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] shadow-[0_0_12px_rgba(34,197,94,.35)] text-black transition-all hover:shadow-[0_0_18px_rgba(34,197,94,.5)] whitespace-nowrap">
                                                        <span className="text-[10px]">✓</span>
                                                        <span className="text-[10px] font-black uppercase tracking-wide">Justified</span>
                                                        <span className="text-[9px] font-black opacity-70 ml-0.5 group-hover:opacity-100">✕</span>
                                                    </button>
                                                ) : (
                                                    <div className="flex gap-1">
                                                        <button onClick={() => { setWarnPopup({ ext: a.ext, name: a.name, date: a.date, isMultiDate, warnKey }); setWarnRemarks(''); }}
                                                            title="Issue a warning"
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#111] border border-[#2a2a2a] hover:border-[#f59e0b]/60 text-[#555] hover:text-[#f59e0b] transition-all whitespace-nowrap">
                                                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 flex-shrink-0">
                                                                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="text-[9px] font-black uppercase">Warn</span>
                                                        </button>
                                                        <button onClick={() => { setJustifyPopup({ ext: a.ext, name: a.name, date: a.date, isMultiDate, warnKey }); setJustifyRemarks(''); }}
                                                            title="Mark as justified"
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#111] border border-[#2a2a2a] hover:border-[#22c55e]/60 text-[#555] hover:text-[#22c55e] transition-all whitespace-nowrap">
                                                            <span className="text-[9px]">✓</span>
                                                            <span className="text-[9px] font-black uppercase">Justify</span>
                                                        </button>
                                                    </div>
                                                )}
                                                {/* Status History button — only show if there's actual history */}
                                                {allHist.length > 0 && (
                                                    <button onClick={() => setTogglePopExt(warnKey)}
                                                        title={`View status history (${allHist.length} entries)`}
                                                        className="relative flex items-center justify-center w-6 h-6 rounded-full transition-all bg-[#0d0d1a] border border-[#a78bfa] hover:bg-[#a78bfa]/20 text-[#a78bfa]">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#a78bfa] text-black text-[7px] font-black rounded-full flex items-center justify-center leading-none">{allHist.length}</span>
                                                    </button>
                                                )}
                                                {/* Status History Modal */}
                                                {togglePopExt === warnKey && (
                                                    <div className="fixed inset-0 z-[900] flex items-center justify-center"
                                                        onClick={() => setTogglePopExt(null)}>
                                                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                                                        <div className="relative bg-[#0d0d0d] border-2 border-[#a78bfa] rounded-2xl shadow-[0_20px_60px_rgba(167,139,250,.15)] w-[360px] max-h-[70vh] flex flex-col overflow-hidden"
                                                            onClick={e => e.stopPropagation()}>
                                                            <div className="px-4 py-3 bg-gradient-to-r from-[#0d0020] to-[#0d0d0d] border-b border-[#1a1040] flex items-center justify-between flex-shrink-0">
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className="w-7 h-7 rounded-full bg-[#a78bfa]/15 border border-[#a78bfa]/40 flex items-center justify-center flex-shrink-0">
                                                                        <svg viewBox="0 0 20 20" fill="#a78bfa" className="w-3.5 h-3.5">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[11px] font-black text-[#a78bfa] uppercase tracking-wider leading-none">Status History</div>
                                                                        <div className="text-[10px] text-[#888] font-bold mt-0.5">{a.name} &nbsp;·&nbsp; Ext: {a.ext}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] bg-[#a78bfa]/10 border border-[#a78bfa]/30 text-[#a78bfa] font-black px-2 py-0.5 rounded-full">{allHist.length} entr{allHist.length !== 1 ? 'ies' : 'y'}</span>
                                                                    <button onClick={() => setTogglePopExt(null)}
                                                                        className="w-[22px] h-[22px] rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[11px] text-[#aaa] hover:border-[#a78bfa] hover:text-white transition-all">✕</button>
                                                                </div>
                                                            </div>
                                                            <div className="overflow-y-auto">
                                                                {allHist.length === 0 ? (
                                                                    <div className="px-5 py-8 text-center">
                                                                        <div className="text-[#333] text-2xl mb-2">○</div>
                                                                        <div className="text-[11px] text-[#444] font-bold">No status changes yet</div>
                                                                    </div>
                                                                ) : (
                                                                    [...allHist].reverse().map((h, i) => {
                                                                        const isW = h.action === 'on';
                                                                        const clr = isW ? '#f59e0b' : '#22c55e';
                                                                        return (
                                                                            <div key={i} className="px-4 py-3 border-b border-[#111] last:border-0 flex items-start gap-3 hover:bg-[#0a0a15] transition-colors">
                                                                                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: clr, boxShadow: `0 0 6px ${clr}88` }} />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="text-[11px] font-black text-white leading-tight">
                                                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full mr-1" style={{ background: `${clr}22`, color: clr, border: `1px solid ${clr}44` }}>
                                                                                            {isW ? '⚠ Warned' : '✓ Justified'}
                                                                                        </span>
                                                                                        by&nbsp;
                                                                                        <span style={{ color: clr }}>{h.toggled_by_name || h.by || '—'}</span>
                                                                                        {h.toggled_by_employee_id && (
                                                                                            <span className="text-[9px] text-[#888] font-bold ml-1">({h.toggled_by_employee_id})</span>
                                                                                        )}
                                                                                    </div>
                                                                                    {h.remarks && (
                                                                                        <div className="text-[10px] text-[#ccc] font-bold mt-0.5 bg-[#111] rounded px-2 py-1 border-l-2" style={{ borderColor: clr, whiteSpace: 'pre-wrap' }}>
                                                                                            {h.remarks}
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="text-[10px] text-[#555] font-bold mt-0.5">{fmtIST(h.at)}</div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
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
            {/* ── Warn Popup Modal — captures remarks before warning ── */}
            {warnPopup && (
                <div className="fixed inset-0 z-[950] flex items-center justify-center p-4" onClick={() => setWarnPopup(null)}>
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
                    <div className="relative bg-gradient-to-b from-[#1a0e00] to-[#0d0d0d] border border-[#f59e0b]/40 rounded-3xl shadow-[0_30px_80px_rgba(245,158,11,.25),0_0_0_1px_rgba(245,158,11,.15)] w-[480px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Glow strip */}
                        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent" />
                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#f59e0b]/20 border border-[#f59e0b]/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(245,158,11,.2)]">
                                <span className="text-[22px]">⚠️</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[15px] font-black text-white leading-tight">Issue Warning</div>
                                <div className="text-[11px] text-[#f59e0b]/80 font-bold mt-0.5">Documenting a performance concern for this agent</div>
                            </div>
                            <button onClick={() => setWarnPopup(null)} className="w-8 h-8 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[12px] text-[#888] hover:border-[#f59e0b]/50 hover:text-white hover:bg-[#f59e0b]/10 transition-all flex-shrink-0">✕</button>
                        </div>
                        {/* Agent info chip */}
                        <div className="mx-6 mb-4 px-4 py-2.5 bg-[#f59e0b]/10 border border-[#f59e0b]/25 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/30 flex items-center justify-center text-[11px] font-black text-[#f59e0b] shrink-0">
                                {(warnPopup.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[12px] font-black text-white truncate">{warnPopup.name}</div>
                                <div className="text-[10px] text-[#888] font-semibold">Ext: {warnPopup.ext} &nbsp;·&nbsp; {fmtDate(warnPopup.date)}</div>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="px-6 pb-6 space-y-3">
                            <div className="text-[11px] font-black text-[#ccc] tracking-wide uppercase">Action / Reason <span className="text-[#f59e0b]">*</span></div>
                            <textarea value={warnRemarks} onChange={e => { setWarnRemarks(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} rows={3}
                                placeholder="Describe the performance issue and action taken..."
                                autoFocus
                                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[12px] text-white font-semibold resize-none focus:outline-none focus:border-[#f59e0b]/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,.1)] placeholder:text-[#444] transition-all" style={{ minHeight: '80px', maxHeight: '200px', overflow: 'auto' }} />
                            <div className="flex gap-2.5 justify-end pt-1">
                                <button onClick={() => setWarnPopup(null)}
                                    className="px-4 py-2 bg-[#111] border border-[#2a2a2a] text-[#888] text-[11px] font-bold rounded-xl hover:border-[#444] hover:text-white transition-all">Cancel</button>
                                <button onClick={() => {
                                    if (!warnRemarks.trim()) return;
                                    onToggle(warnPopup.ext, warnPopup.name, warnPopup.date, warnPopup.isMultiDate, 'on', warnRemarks.trim());
                                    setWarnPopup(null);
                                    setWarnRemarks('');
                                }} disabled={!warnRemarks.trim()}
                                    className="px-5 py-2 bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-black text-[11px] font-black rounded-xl hover:from-[#fbbf24] hover:to-[#f59e0b] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_16px_rgba(245,158,11,.35)] flex items-center gap-1.5">
                                    <span className="text-[13px]">⚠</span> Submit Warning
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Justify Popup Modal — captures remarks before justification ── */}
            {justifyPopup && (
                <div className="fixed inset-0 z-[950] flex items-center justify-center p-4" onClick={() => setJustifyPopup(null)}>
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
                    <div className="relative bg-gradient-to-b from-[#001a0a] to-[#0d0d0d] border border-[#22c55e]/40 rounded-3xl shadow-[0_30px_80px_rgba(34,197,94,.2),0_0_0_1px_rgba(34,197,94,.12)] w-[480px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Glow strip */}
                        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#22c55e] to-transparent" />
                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#22c55e]/20 border border-[#22c55e]/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(34,197,94,.15)]">
                                <span className="text-[22px]">✅</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[15px] font-black text-white leading-tight">Justify Agent</div>
                                <div className="text-[11px] text-[#22c55e]/80 font-bold mt-0.5">Provide a reason to clear this agent's status</div>
                            </div>
                            <button onClick={() => setJustifyPopup(null)} className="w-8 h-8 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[12px] text-[#888] hover:border-[#22c55e]/50 hover:text-white hover:bg-[#22c55e]/10 transition-all flex-shrink-0">✕</button>
                        </div>
                        {/* Agent info chip */}
                        <div className="mx-6 mb-4 px-4 py-2.5 bg-[#22c55e]/10 border border-[#22c55e]/25 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#22c55e]/20 border border-[#22c55e]/30 flex items-center justify-center text-[11px] font-black text-[#22c55e] shrink-0">
                                {(justifyPopup.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[12px] font-black text-white truncate">{justifyPopup.name}</div>
                                <div className="text-[10px] text-[#888] font-semibold">Ext: {justifyPopup.ext} &nbsp;·&nbsp; {fmtDate(justifyPopup.date)}</div>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="px-6 pb-6 space-y-3">
                            <div className="text-[11px] font-black text-[#ccc] tracking-wide uppercase">Justification Reason <span className="text-[#22c55e]">*</span></div>
                            <textarea value={justifyRemarks} onChange={e => { setJustifyRemarks(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} rows={3}
                                placeholder="Explain why this agent's performance is justified..."
                                autoFocus
                                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[12px] text-white font-semibold resize-none focus:outline-none focus:border-[#22c55e]/60 focus:shadow-[0_0_0_3px_rgba(34,197,94,.1)] placeholder:text-[#444] transition-all" style={{ minHeight: '80px', maxHeight: '200px', overflow: 'auto' }} />
                            <div className="flex gap-2.5 justify-end pt-1">
                                <button onClick={() => setJustifyPopup(null)}
                                    className="px-4 py-2 bg-[#111] border border-[#2a2a2a] text-[#888] text-[11px] font-bold rounded-xl hover:border-[#444] hover:text-white transition-all">Cancel</button>
                                <button onClick={() => {
                                    if (!justifyRemarks.trim()) return;
                                    onToggle(justifyPopup.ext, justifyPopup.name, justifyPopup.date, justifyPopup.isMultiDate, 'justified', justifyRemarks.trim());
                                    setJustifyPopup(null);
                                    setJustifyRemarks('');
                                }} disabled={!justifyRemarks.trim()}
                                    className="px-5 py-2 bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-black text-[11px] font-black rounded-xl hover:from-[#4ade80] hover:to-[#22c55e] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_16px_rgba(34,197,94,.3)] flex items-center gap-1.5">
                                    <span className="text-[13px]">✓</span> Submit Justified
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Remark Popup Modal — add justification for waste time ── */}
            {remarkPopup && (
                <div className="fixed inset-0 z-[950] flex items-center justify-center" onClick={() => setRemarkPopup(null)}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                    <div className="relative bg-[#0d0d0d] border-2 border-[#a78bfa] rounded-2xl shadow-[0_20px_60px_rgba(167,139,250,.2)] w-[420px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 bg-gradient-to-r from-[#0d0020] to-[#0d0d0d] border-b border-[#2a1a40] flex items-center justify-between flex-shrink-0">
                            <div>
                                <div className="text-[12px] font-black text-[#22c55e] uppercase tracking-wider">⏱ Time Justification</div>
                                <div className="text-[10px] text-[#888] font-bold mt-0.5">{remarkPopup.name} · Ext: {remarkPopup.ext} · {fmtDate(remarkPopup.date)}</div>
                            </div>
                            <button onClick={() => setRemarkPopup(null)} className="w-[22px] h-[22px] rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[11px] text-[#aaa] hover:border-[#a78bfa] hover:text-white transition-all">✕</button>
                        </div>
                        <div className="px-5 py-4 space-y-3 overflow-y-auto">
                            {/* Add new remark */}
                            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 space-y-2.5">
                                <div className="text-[10px] font-black text-[#a78bfa] uppercase tracking-wider">+ Add Justification</div>
                                <div className="flex gap-1.5 flex-wrap">
                                    {remarkTypes.map(t => (
                                        <button key={t} onClick={() => setRemarkType(t)}
                                            className={`px-2 py-0.5 text-[9px] font-black rounded-full border transition-all ${remarkType === t ? 'bg-[#a78bfa] text-black border-[#a78bfa]' : 'border-[#333] text-[#888] hover:border-[#a78bfa]/50'}`}>{t}</button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <input type="text" value={remarkText} onChange={e => setRemarkText(e.target.value)}
                                            placeholder="What was the reason..."
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-2.5 py-1.5 text-[11px] text-white font-bold focus:outline-none focus:border-[#a78bfa] placeholder:text-[#444]" />
                                    </div>
                                    <div className="w-20">
                                        <input type="number" value={remarkMins} onChange={e => setRemarkMins(e.target.value)}
                                            placeholder="Min"
                                            min="1" max="600"
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded-md px-2.5 py-1.5 text-[11px] text-white font-bold focus:outline-none focus:border-[#a78bfa] placeholder:text-[#444] text-center" />
                                        <div className="text-[8px] text-[#555] text-center mt-0.5">minutes</div>
                                    </div>
                                </div>
                                <button onClick={() => {
                                    if (!remarkText.trim() || !remarkMins || parseInt(remarkMins) < 1) return;
                                    onAddRemark && onAddRemark({
                                        ext: remarkPopup.ext,
                                        agent_name: remarkPopup.name,
                                        date: remarkPopup.date,
                                        remark_type: remarkType,
                                        remark_text: remarkText.trim(),
                                        time_minutes: parseInt(remarkMins),
                                    });
                                    setRemarkText('');
                                    setRemarkMins('');
                                }} disabled={!remarkText.trim() || !remarkMins || parseInt(remarkMins) < 1}
                                    className="px-3 py-1.5 bg-[#a78bfa] text-black text-[10px] font-black rounded-md hover:bg-[#c4b5fd] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                    📝 Add Remark
                                </button>
                            </div>
                            {/* Existing remarks */}
                            {(() => {
                                const remarkKey = `${remarkPopup.ext}__${remarkPopup.date}`;
                                const myRemarks = (agentRemarks && agentRemarks[remarkKey]) || [];
                                return myRemarks.length > 0 ? (
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-black text-[#888] uppercase tracking-wider">{myRemarks.length} Existing Remark{myRemarks.length !== 1 ? 's' : ''}</div>
                                        {myRemarks.map((r, ri) => (
                                            <div key={ri} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 flex items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#a78bfa]/20 text-[#a78bfa] border border-[#a78bfa]/30">{r.remark_type}</span>
                                                        <span className="text-[10px] font-black text-white">{r.time_minutes}m</span>
                                                    </div>
                                                    <div className="text-[10px] text-[#ccc] font-bold mt-0.5">{r.remark_text}</div>
                                                    <div className="text-[9px] text-[#555] font-bold mt-0.5">
                                                        by {r.added_by_name || '—'}{r.added_by_employee_id ? ` (${r.added_by_employee_id})` : ''} · {fmtIST(r.created_at)}
                                                    </div>
                                                </div>
                                                <button onClick={() => onDeleteRemark && onDeleteRemark(r._id, remarkPopup.ext, remarkPopup.date)}
                                                    className="text-[#c0392b] text-[10px] hover:text-red-400 font-black flex-shrink-0 mt-0.5" title="Delete">🗑</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-[11px] text-[#444] font-bold">No remarks yet for this agent on this date.</div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
            {/* ── Justification Detail Modal — double-click to view all remarks ── */}
            {justDetailPopup && (() => {
                const remarkKey = `${justDetailPopup.ext}__${justDetailPopup.date}`;
                const myRemarks = (agentRemarks && agentRemarks[remarkKey]) || [];
                const totalMins = myRemarks.reduce((s, r) => s + (r.time_minutes || 0), 0);
                const fmtMins = m => { if (m <= 0) return '0m'; const h = Math.floor(m / 60), rm = m % 60; if (h > 0 && rm > 0) return `${h}h ${rm}m`; if (h > 0) return `${h}h`; return `${rm}m`; };
                return (
                    <div className="fixed inset-0 z-[960] flex items-center justify-center" onClick={() => setJustDetailPopup(null)}>
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                        <div className="relative bg-[#0d0d0d] border-2 border-[#22c55e] rounded-2xl shadow-[0_20px_60px_rgba(34,197,94,.15)] w-[440px] max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="px-5 py-3.5 bg-gradient-to-r from-[#001a0a] to-[#0d0d0d] border-b border-[#0a3a1a] flex items-center justify-between flex-shrink-0">
                                <div>
                                    <div className="text-[12px] font-black text-[#22c55e] uppercase tracking-wider">⏱ Justification Details</div>
                                    <div className="text-[10px] text-[#888] font-bold mt-0.5">{justDetailPopup.name} · Ext: {justDetailPopup.ext} · {fmtDate(justDetailPopup.date)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded-full">{myRemarks.length} remark{myRemarks.length !== 1 ? 's' : ''} · {fmtMins(totalMins)}</span>
                                    <button onClick={() => setJustDetailPopup(null)} className="w-[22px] h-[22px] rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[11px] text-[#aaa] hover:border-[#22c55e] hover:text-white transition-all">✕</button>
                                </div>
                            </div>
                            {/* Body */}
                            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                                {myRemarks.length === 0 ? (
                                    <div className="text-center py-8 text-[#444] text-[12px] font-bold">No justifications for this agent.</div>
                                ) : myRemarks.map((r, ri) => (
                                    <div key={ri} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3.5 hover:border-[#22c55e]/30 transition-all">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-black text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/25 px-2 py-0.5 rounded-full">{r.remark_type}</span>
                                            <span className="text-[13px] font-black text-white">{fmtMins(r.time_minutes)}</span>
                                        </div>
                                        {r.remark_text && (
                                            <div className="text-[11px] text-[#ddd] font-semibold leading-relaxed mt-1 bg-[#0a0a0a] rounded-lg px-3 py-2 border-l-2 border-[#22c55e]/40" style={{ whiteSpace: 'pre-wrap' }}>
                                                {r.remark_text}
                                            </div>
                                        )}
                                        <div className="text-[9px] text-[#555] font-bold mt-1.5 flex items-center gap-2">
                                            <span>Added by {r.added_by_name || '—'}{r.added_by_employee_id ? ` (${r.added_by_employee_id})` : ''}</span>
                                            <span>· {fmtIST(r.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Footer */}
                            <div className="px-5 py-2.5 border-t border-[#1a1a1a] flex justify-between items-center flex-shrink-0">
                                <button onClick={() => { setJustDetailPopup(null); setRemarkPopup({ ext: justDetailPopup.ext, name: justDetailPopup.name, date: justDetailPopup.date }); setRemarkType('Training'); setRemarkText(''); setRemarkMins(''); }}
                                    className="px-3 py-1.5 bg-[#22c55e]/15 border border-[#22c55e]/40 text-[#22c55e] text-[10px] font-black rounded-lg hover:bg-[#22c55e]/25 transition-all">
                                    + Add New Justification
                                </button>
                                <button onClick={() => setJustDetailPopup(null)}
                                    className="px-3 py-1.5 border border-[#333] text-[#aaa] text-[10px] font-bold rounded-lg hover:border-[#555] transition-all">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ filterFrom, filterTo, selectedAgent, agentCount, isUploaded, onClearUpload, onOpenRules, onOpenUpload, onOpenHistory, onOpenMapping }) {
    const isMultiDate = filterFrom !== filterTo;
    const dateLabel = isMultiDate ? `${fmtDate(filterFrom)} – ${fmtDate(filterTo)}` : fmtDate(filterFrom);
    const Badge = ({ children, accent = '#00BCD4' }) => (
        <div className="bg-black border px-2.5 py-0.5 rounded-full text-[11px] text-white font-bold" style={{ borderColor: accent }}>{children}</div>
    );
    return (
        <div className="shrink-0 bg-gradient-to-r from-black via-[#050a0d] to-black border-b-2 border-[#00BCD4] px-5 py-2.5 flex items-center gap-2.5 flex-wrap shadow-[0_2px_20px_rgba(0,0,0,.8)]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#28A745] shadow-[0_0_0_3px_rgba(40,167,69,.3)] flex-shrink-0 animate-pulse" />
            <button onClick={onOpenRules}
                className="px-4 py-1.5 bg-[#003d4d] border-2 border-[#00BCD4] text-[#00BCD4] text-[11px] font-black rounded-lg cursor-pointer whitespace-nowrap transition-all hover:bg-[#00BCD4] hover:text-black">
                📋 Rules
            </button>
            <button onClick={onOpenUpload}
                className="px-4 py-1.5 bg-[#003d4d] border-2 border-[#03B0F5] text-[#03B0F5] text-[11px] font-black rounded-lg cursor-pointer whitespace-nowrap transition-all hover:bg-[#03B0F5] hover:text-black">
                📤 Upload Excel
            </button>
            <button onClick={onOpenHistory}
                className="px-4 py-1.5 bg-[#1a0030] border-2 border-[#a855f7] text-[#a855f7] text-[11px] font-black rounded-lg cursor-pointer whitespace-nowrap transition-all hover:bg-[#a855f7] hover:text-black">
                📂 History
            </button>
            <button onClick={onOpenMapping}
                className="px-4 py-1.5 bg-[#0a1a00] border-2 border-[#22c55e] text-[#22c55e] text-[11px] font-black rounded-lg cursor-pointer whitespace-nowrap transition-all hover:bg-[#22c55e] hover:text-black">
                👥 Agent Mapping
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
// Gradient mappings like Lead CRM style
const GRADIENTS = {
    'ck-b': 'from-blue-500 to-cyan-400',
    'ck-g': 'from-green-500 to-green-400', 
    'ck-p': 'from-purple-500 to-purple-400',
    'ck-y': 'from-cyan-500 to-blue-400',
    'ck-r': 'from-red-500 to-pink-400',
    'ck-o': 'from-orange-500 to-amber-400'
};
const SHADOWS = {
    'ck-b': 'shadow-blue-500/25',
    'ck-g': 'shadow-green-500/25',
    'ck-p': 'shadow-purple-500/25',
    'ck-y': 'shadow-cyan-500/25',
    'ck-r': 'shadow-red-500/25',
    'ck-o': 'shadow-orange-500/25'
};
function KpiRow({ kpis }) {
    return (
        <div className="sticky left-0 z-30 grid grid-cols-6 gap-2 px-5 py-3 bg-black" style={{ width: '100vw', maxWidth: '100%' }}>
            {kpis.map(k => (
                <div key={k.id} className={`bg-gradient-to-r ${GRADIENTS[k.color]} shadow-lg ${SHADOWS[k.color]} rounded-xl px-3.5 py-3 relative overflow-hidden`}>
                    <div className="text-[9px] font-extrabold text-white uppercase tracking-widest mb-1">{k.label}</div>
                    <div className="text-[22px] font-black text-white leading-none">{k.value}</div>
                    <div className="text-[10px] text-white/90 font-semibold mt-0.5">{k.sub}</div>
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
        const w = { id: Date.now(), type, note: note.trim(), issuedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) };
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
    'outbound call': 'outCalls', 'Outbound Call': 'outCalls', 'OUTBOUND CALL': 'outCalls',
    'outcalls': 'outCalls', 'ob calls': 'outCalls', 'outbound calls': 'outCalls',
    'out calls': 'outCalls', 'ob': 'outCalls', 'dialed calls': 'outCalls',
    'total outbound calls': 'outCalls',
    // ── outbound talk time ──
    'outbound duration': 'outTT', 'Outbound Duration': 'outTT', 'OUTBOUND DURATION': 'outTT',
    'outtt': 'outTT', 'ob tt': 'outTT', 'outbound tt': 'outTT', 'ob talk time': 'outTT',
    'out tt': 'outTT', 'outbound talk time': 'outTT', 'dialed talk time': 'outTT',
    'ob duration': 'outTT',
    // ── manual calls (NOT inbound - those are separate) ──
    'manual call': 'manCalls', 'Manual Call': 'manCalls', 'MANUAL CALL': 'manCalls',
    'manual calls': 'manCalls', 'Manual Calls': 'manCalls', 'MANUAL CALLS': 'manCalls',
    'mancalls': 'manCalls', 'mn calls': 'manCalls', 'mn call': 'manCalls',
    'mn': 'manCalls', 'mncalls': 'manCalls', 'manual_call': 'manCalls', 'manual_calls': 'manCalls',
    'man calls': 'manCalls', 'man call': 'manCalls',
    'manualcall': 'manCalls', 'manualcalls': 'manCalls',
    // ── inbound calls (ignored - separate from manual) ──
    'inbound call': '_ignore', 'inbound calls': '_ignore', 'ib call': '_ignore', 'ib calls': '_ignore',
    'inbound': '_ignore', 'ib': '_ignore', 'incoming': '_ignore', 'incoming calls': '_ignore',
    'received calls': '_ignore', 'received': '_ignore',
    // ── manual talk time (NOT inbound - those are separate) ──
    'manual duration': 'manTT', 'Manual Duration': 'manTT', 'MANUAL DURATION': 'manTT',
    'manual call duration': 'manTT', 'Manual Call Duration': 'manTT', 'MANUAL CALL DURATION': 'manTT',
    'mantt': 'manTT', 'mn tt': 'manTT', 'mntt': 'manTT', 'manual tt': 'manTT', 'manual talk time': 'manTT',
    'manual time': 'manTT',
    // ── inbound duration (ignored - separate from manual) ──
    'inbound talk time': '_ignore', 'ib tt': '_ignore',
    'ib duration': '_ignore', 'inbound duration': '_ignore',
    'incoming duration': '_ignore', 'incoming talk time': '_ignore', 'received duration': '_ignore',
    'inbound time': '_ignore', 'ib time': '_ignore',
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
    const str = String(val).replace(/<[^>]*>/g, '').trim();
    // Preserve N/A values instead of treating them as empty
    if (str.toUpperCase() === 'N/A' || str === '#N/A') return 'N/A';
    return str;
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
                console.log('[parseExcelFile] ⚠️ RAW EXCEL HEADERS:', headerRow);
                console.log('[parseExcelFile] 🔍 Searching for Manual Call columns...');
                
                // FIRST PASS: Log all raw data in first data row
                if (rawRows[1]) {
                    console.log('[parseExcelFile] ⚠️ RAW FIRST DATA ROW:', rawRows[1]);
                }

                headerRow.forEach((h, i) => {
                    const key = h.toLowerCase();
                    // Also try with all spaces removed (e.g. "ManualCall","manual call","MANUAL CALL" all → "manualcall")
                    const keyNoSpace = key.replace(/\s+/g, '');
                    const cleanKey = key.replace(/[^a-z0-9]/g, '');
                    
                    // Log every header that might be manual-related
                    if (cleanKey.includes('manual') || cleanKey.includes('man') || cleanKey.includes('mn')) {
                        console.log(`[parseExcelFile] Potential manual column at index ${i}:`, {
                            original: h,
                            key: key,
                            keyNoSpace: keyNoSpace,
                            cleanKey: cleanKey,
                            checking_map_keys: {
                                key_in_map: key in COLUMN_MAP,
                                original_in_map: h in COLUMN_MAP,
                                keyNoSpace_in_map: keyNoSpace in COLUMN_MAP,
                                cleanKey_in_map: cleanKey in COLUMN_MAP
                            }
                        });
                    }
                    
                    let f = COLUMN_MAP[key] || COLUMN_MAP[h] || COLUMN_MAP[keyNoSpace] || COLUMN_MAP[cleanKey];
                    
                    // FORCE manual call and manual duration mapping
                    if (!f && h) {
                        const hLower = h.toLowerCase().trim();
                        // Check if this is "Manual Call" column (any case, any spacing)
                        if ((hLower === 'manual call' || hLower === 'manualcall' || hLower.replace(/\s+/g, '') === 'manualcall')) {
                            f = 'manCalls';
                            console.log(`[parseExcelFile] 🔧 FORCE MAPPED "${h}" → manCalls`);
                        }
                        // Check if this is "Manual Duration" column
                        else if ((hLower === 'manual duration' || hLower === 'manualduration' || hLower.replace(/\s+/g, '') === 'manualduration')) {
                            f = 'manTT';
                            console.log(`[parseExcelFile] 🔧 FORCE MAPPED "${h}" → manTT`);
                        }
                    }

                    // Ultra-aggressive fallback: if it contains "manual" or "inbound" and "call", force map to manCalls
                    if (!f && (cleanKey.includes('manual') || cleanKey.includes('inbound') || cleanKey.includes('ib')) && (cleanKey.includes('call') || cleanKey.includes('mn'))) {
                        f = cleanKey.includes('duration') || cleanKey.includes('time') || cleanKey.includes('tt') ? 'manTT' : 'manCalls';
                    }
                    // Ultra-aggressive fallback for duration specifically
                    if (!f && (cleanKey.includes('manual') || cleanKey.includes('inbound') || cleanKey.includes('ib')) && (cleanKey.includes('duration') || cleanKey.includes('time'))) f = 'manTT';

                    if (f) {
                        // _ignore columns: always include in fieldMap (so the column is consumed),
                        // but do NOT add 'ignore' to mappedFieldSet — this ensures _ignore never
                        // blocks any real field that happens to come later.
                        if (f === '_ignore') {
                            fieldMap[i] = f;
                        } else if (!mappedFieldSet.has(f)) {
                            fieldMap[i] = f;
                            mappedFieldSet.add(f);
                            // Log when manual fields are mapped
                            if (f === 'manCalls' || f === 'manTT') {
                                console.log(`[parseExcelFile] ✅ Mapped column "${h}" → ${f} at index ${i}`);
                            }
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
                    // Explicitly highlight manual calls and duration
                    console.log('[parseExcelFile] ⚠️ MANUAL DATA CHECK:', {
                        manCalls_present: 'manCalls' in firstRowDebug,
                        manCalls_raw_value: firstRowDebug.manCalls,
                        manTT_present: 'manTT' in firstRowDebug,
                        manTT_raw_value: firstRowDebug.manTT
                    });
                }

                const mappedFields = Object.values(fieldMap);
                const missing = REQUIRED_FIELDS.filter(f => !mappedFields.includes(f));
                
                // CHECK: Are manual fields present in the mapping?
                console.log('[parseExcelFile] ⚠️ MANUAL FIELDS IN MAPPING:', {
                    manCalls_mapped: mappedFields.includes('manCalls'),
                    manTT_mapped: mappedFields.includes('manTT'),
                    all_mapped_fields: mappedFields
                });
                
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

                    // Debug: log rec object for first 3 rows
                    if (ri < 3) {
                        console.log(`[parseExcelFile] Row ${rowNum} rec object:`, {
                            manCalls_in_rec: rec.manCalls,
                            manTT_in_rec: rec.manTT,
                            outCalls_in_rec: rec.outCalls,
                            outTT_in_rec: rec.outTT,
                            name_in_rec: rec.name
                        });
                    }

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
                        dateVal = t.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                    }

                    const outTTstr = parseTimeToHMS(rec.outTT);
                    const manTTstr = parseTimeToHMS(rec.manTT);

                    // Debug: log manual data parsing for EVERY row
                    if (ri < 3) { // Log first 3 rows
                        console.log(`[parseExcelFile] Row ${rowNum} manual data:`, {
                            manCalls_raw: rec.manCalls,
                            manCalls_type: typeof rec.manCalls,
                            manCalls_parsed: parseInt(rec.manCalls) || 0,
                            manTT_raw: rec.manTT,
                            manTT_type: typeof rec.manTT,
                            manTT_parsed: manTTstr
                        });
                    }

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

                    // Skip rows with N/A login/logout data (incomplete records)
                    const hasNALogin = loginParsed.display === 'N/A' || loginParsed.display === '—' || /N\/A/i.test(loginParsed.display);
                    const hasNALogout = logoutParsed.display === 'N/A' || logoutParsed.display === '—' || /N\/A/i.test(logoutParsed.display);
                    
                    // Skip header rows, blank rows, total rows, and N/A data rows
                    const isHeaderRepeat = /^\s*sl\.?\s*no\.?\s*$/i.test(nameVal) || /^\s*sr\.?\s*no\.?\s*$/i.test(nameVal);
                    const isBlankRow = !nameVal && !extVal;
                    const isTotalRow = /^(grand\s*)?totals?$/i.test(nameVal)
                        || /^(grand\s*)?totals?$/i.test(extVal)
                        || (/total/i.test(nameVal) && (extVal === '' || extVal === nameVal));
                    const isNARow = hasNALogin || hasNALogout;
                    
                    if (isHeaderRepeat || isBlankRow || isTotalRow || isNARow) return;

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

                    // Debug: log parsed object for first 3 rows
                    if (ri < 3) {
                        console.log(`[parseExcelFile] ⚠️ Row ${rowNum} PARSED OBJECT:`, {
                            name: parsed.name,
                            manCalls: parsed.manCalls,
                            manTT: parsed.manTT,
                            outCalls: parsed.outCalls,
                            outTT: parsed.outTT
                        });
                    }

                    if (!parsed.name || parsed.name === '') errs.push('name/agent id empty');
                    if (!parsed.ext || parsed.ext === '') errs.push('ext/agent id empty');
                    // Note: N/A values are allowed and will be preserved
                    if (errs.length > 0) rowErrors.push(`Row ${rowNum}: ${errs.join(', ')}`);
                    else {
                        // Debug: log manual calls data for first agent
                        if (agents.length === 0) {
                            console.log('[parseExcelFile] First agent parsed:', {
                                name: parsed.name,
                                manCalls: parsed.manCalls,
                                manTT: parsed.manTT,
                                outCalls: parsed.outCalls,
                                outTT: parsed.outTT
                            });
                        }
                        agents.push(parsed);
                    }
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

function ExcelUploadModal({ show, onClose, onUpload, uploadedAgents, uploadHistory, agentMappings = {} }) {
    const fileRef = useRef(null);
    const [status, setStatus] = useState('idle'); // idle | parsing | success | error | all_duplicate
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('');
    const [rowErrors, setRowErrors] = useState([]);
    const [stats, setStats] = useState(null); // { loaded, total, unmapped, newCount, updatedCount, dupCount }
    const [dragging, setDragging] = useState(false);
    const [debugSample, setDebugSample] = useState(null);

    const reset = () => { setStatus('idle'); setProgress(0); setMessage(''); setRowErrors([]); setStats(null); setDebugSample(null); };
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
            setDebugSample(result.debugSample || null);
            setRowErrors(result.rowErrors);
            if (result.agents.length === 0) {
                setStatus('error');
                setMessage('No valid rows found in the file.');
                return;
            }

            // ── Smart row-level comparison ────────────────────────────────────────
            // Build lookup from currently loaded data
            const existingMap = {};
            if (uploadedAgents && uploadedAgents.length > 0) {
                uploadedAgents.forEach(a => {
                    existingMap[`${a.ext}__${a.date}`] = a;
                });
            }
            const fieldHash = a => `${a.loginTime}|${a.logoutTime}|${a.outCalls}|${a.manCalls}|${a.loginDur}`;

            let newCount = 0, updatedCount = 0, dupCount = 0;
            result.agents.forEach(a => {
                const existing = existingMap[`${a.ext}__${a.date}`];
                if (!existing) newCount++;
                else if (fieldHash(existing) !== fieldHash(a)) updatedCount++;
                else dupCount++;
            });

            setProgress(100);
            // Detect unmapped agents (agents without mapping in agentMappings)
            const unmappedExts = [...new Set(result.agents.map(a => a.ext))].filter(ext => !agentMappings[ext]?.mapped_name);
            setStats({ loaded: result.agents.length, total: result.totalRows, unmapped: result.unmapped, newCount, updatedCount, dupCount, unmappedExts });

            // If ALL rows are exact duplicates — don't upload
            if (newCount === 0 && updatedCount === 0) {
                setStatus('all_duplicate');
                return;
            }

            // Otherwise always upload as new entry (all rows from file)
            const statusLine = [
                newCount > 0 ? `🆕 ${newCount} new` : '',
                updatedCount > 0 ? `🔄 ${updatedCount} updated` : '',
                dupCount > 0 ? `⊘ ${dupCount} duplicate` : '',
            ].filter(Boolean).join('  ·  ');
            setStatus('success');
            setMessage(`✅ ${result.agents.length} records uploaded  ·  ${statusLine}`);
            onUpload(result.agents, file.name, file.size);
        } catch (err) {
            setStatus('error');
            setMessage(err.message);
            setProgress(0);
        }
    }, [onUpload, uploadedAgents, agentMappings]);

    const handleFile = (file) => processFile(file);
    const handleInputChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
    const handleDrop = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && handleClose()}>
            <div className="bg-[#0d0d0d] border-2 border-[#00BCD4] rounded-2xl w-full max-w-[600px] shadow-[0_0_80px_rgba(0,188,212,.25)]">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-[#003d4d] to-[#001f26] rounded-t-2xl flex justify-between items-center border-b-2 border-[#00BCD4]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#00BCD4]/15 border border-[#00BCD4]/40 flex items-center justify-center text-lg">📊</div>
                        <div>
                            <h2 className="text-[13px] font-black text-[#00BCD4] uppercase tracking-widest leading-none">Upload Excel</h2>
                            <p className="text-[10px] text-[#aaa] font-bold mt-0.5">Each upload creates a new history entry</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="border-2 border-[#00BCD4]/50 text-[#00BCD4] w-8 h-8 rounded-full text-sm flex items-center justify-center font-black transition-all hover:bg-[#00BCD4] hover:text-black hover:border-[#00BCD4]">✕</button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => status !== 'parsing' && fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl py-10 px-4 text-center transition-all cursor-pointer ${
                            dragging ? 'border-[#00BCD4] bg-[#003d4d]/60 scale-[1.01]' :
                            status === 'success' ? 'border-[#22c55e] bg-[#052e0e]' :
                            status === 'error' ? 'border-[#ef4444] bg-[#1a0606]' :
                            status === 'all_duplicate' ? 'border-[#f59e0b] bg-[#1a1000]' :
                            status === 'parsing' ? 'border-[#00BCD4] bg-[#001f26] cursor-not-allowed' :
                            'border-[#2a2a2a] hover:border-[#00BCD4]/60 hover:bg-[#001f26]/50'
                        }`}
                    >
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInputChange} />

                        {status === 'parsing' ? (
                            <div className="space-y-4">
                                <div className="text-4xl animate-pulse">⏳</div>
                                <div className="text-sm font-black text-[#00BCD4]">Reading Excel file...</div>
                                <div className="w-full bg-[#111] rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-gradient-to-r from-[#00BCD4] to-[#26c6da] h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="text-[11px] text-[#555] font-bold">{progress}%</div>
                            </div>

                        ) : status === 'success' ? (
                            <div className="space-y-3">
                                <div className="text-4xl">✅</div>
                                <div className="text-[13px] font-black text-[#22c55e]">Upload Successful!</div>
                                {/* Stats pills */}
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                    {stats?.newCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#052e0e] border border-[#22c55e]/40 rounded-full text-[11px] font-black text-[#22c55e]">
                                            🆕 {stats.newCount} New
                                        </span>
                                    )}
                                    {stats?.updatedCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#0a1f3d] border border-[#60a5fa]/40 rounded-full text-[11px] font-black text-[#60a5fa]">
                                            🔄 {stats.updatedCount} Updated
                                        </span>
                                    )}
                                    {stats?.dupCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#1a1a1a] border border-[#555]/40 rounded-full text-[11px] font-black text-[#777]">
                                            ⊘ {stats.dupCount} Duplicate
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-[#555] font-bold">Total: {stats?.loaded} records · Click to upload another file</div>
                                {stats?.unmapped?.length > 0 && <div className="text-[10px] text-[#666] mt-1">Ignored columns: {stats.unmapped.join(', ')}</div>}
                                {stats?.unmappedExts?.length > 0 && (
                                    <div className="mt-2 px-3 py-2 bg-[#1a0000] border border-[#ef4444]/30 rounded-lg">
                                        <div className="text-[10px] font-black text-[#ef4444] mb-1">⚠ {stats.unmappedExts.length} Unmapped Agent{stats.unmappedExts.length !== 1 ? 's' : ''}</div>
                                        <div className="text-[9px] text-[#ff8866] font-bold">Exts: {stats.unmappedExts.slice(0, 10).join(', ')}{stats.unmappedExts.length > 10 ? ` +${stats.unmappedExts.length - 10} more` : ''}</div>
                                        <div className="text-[9px] text-[#666] font-bold mt-0.5">Open Agent Mapping to map these extensions</div>
                                    </div>
                                )}
                            </div>

                        ) : status === 'error' ? (
                            <div className="space-y-2">
                                <div className="text-4xl">❌</div>
                                <div className="text-[13px] font-black text-[#ef4444]">Upload Failed</div>
                                <div className="text-[11px] text-[#ff8866] font-bold whitespace-pre-wrap">{message}</div>
                                <div className="text-[10px] text-[#555] font-bold mt-1">Click to try another file</div>
                            </div>

                        ) : status === 'all_duplicate' ? (
                            <div className="space-y-3">
                                <div className="text-5xl">📋</div>
                                <div className="text-[13px] font-black text-[#f59e0b]">Same Data Already Loaded</div>
                                <div className="text-[11px] text-[#ccc] font-bold">
                                    All <span className="text-[#f59e0b] font-black">{stats?.loaded}</span> rows are exact duplicates — nothing new to upload.
                                </div>
                                <div className="text-[10px] text-[#555] font-bold">Click to try a different file</div>
                            </div>

                        ) : (
                            <div className="space-y-3">
                                <div className="text-5xl">📂</div>
                                <div className="text-[13px] font-black text-white">Drop Excel file here or click to browse</div>
                                <div className="text-[11px] text-[#555] font-bold">.xlsx or .xls &nbsp;·&nbsp; Max 10MB &nbsp;·&nbsp; Smart duplicate detection</div>
                                <div className="flex items-center justify-center gap-4 mt-2">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#555]">
                                        <span className="w-2 h-2 rounded-full bg-[#22c55e]" />New rows added
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#555]">
                                        <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />Changed rows updated
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#555]">
                                        <span className="w-2 h-2 rounded-full bg-[#555]" />Exact dupes skipped
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Row-wise errors */}
                    {rowErrors.length > 0 && (
                        <div className="bg-[#1a0606] border border-[#c0392b]/50 rounded-xl p-3 max-h-32 overflow-y-auto">
                            <div className="text-[11px] font-black text-[#ef4444] uppercase mb-2">⚠ {rowErrors.length} Row Error{rowErrors.length !== 1 ? 's' : ''} (skipped)</div>
                            {rowErrors.map((e, i) => <div key={i} className="text-[11px] text-[#ff8866] font-bold">{e}</div>)}
                        </div>
                    )}

                    {/* Column format guide */}
                    <details className="group">
                        <summary className="text-[11px] font-black text-[#00BCD4]/70 cursor-pointer uppercase tracking-wider select-none hover:text-[#00BCD4] transition-all">📋 Expected Column Names (click to expand)</summary>
                        <div className="mt-2 space-y-1">
                            <div className="text-[10px] text-[#666] font-bold mb-1">Column names matched case-insensitively. Extra columns ignored.</div>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-[#ccc] font-bold">
                                {[
                                    ['name ✱', 'Name, Agent Name, Agent'],
                                    ['ext ✱', 'Ext, Extension, Agent ID'],
                                    ['date', 'Date  (optional — defaults to today)'],
                                    ['loginTime ✱', 'Login Time, Login, First Login, In Time'],
                                    ['logoutTime ✱', 'Logout Time, Logout, Last Logout, Out Time'],
                                    ['loginDur ✱', 'Login Duration, Duration, Session, Mode Duration'],
                                    ['outCalls ✱', 'OB Calls, Outbound Calls, Dialed Calls'],
                                    ['outTT ✱', 'OB TT, Outbound TT, Dialed Talk Time'],
                                    ['manCalls ✱', 'MN Calls, Manual Calls, IB Calls, Inbound Call'],
                                    ['manTT ✱', 'MN TT, Manual TT, IB Duration, Inbound Duration'],
                                    ['autoIdle ✱', 'Auto Idle, Idle Duration, Idle Time'],
                                    ['manualIdle ✱', 'Manual Idle, Manual Idle Duration'],
                                    ['breakTime ✱', 'Break Time, Break, Total Break Duration'],
                                    ['wrapup ✱', 'Wrapup, Wrapup Duration, Wrap Up, ACW'],
                                ].map(([field, aliases]) => (
                                    <div key={field} className="bg-[#111] rounded-lg px-2 py-1.5"><span className="text-[#00BCD4]">{field}:</span> {aliases}</div>
                                ))}
                            </div>
                        </div>
                    </details>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-1">
                        <button onClick={handleClose} className="px-4 py-1.5 border border-[#2a2a2a] text-[#666] text-xs font-bold rounded-lg hover:border-[#444] hover:text-[#aaa] transition-all">Close</button>
                        {status === 'success' && (
                            <button onClick={handleClose} className="px-5 py-1.5 bg-[#22c55e] border border-[#22c55e] text-black text-xs font-black rounded-lg hover:bg-[#16a34a] transition-all">✓ Done</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Date Calendar Picker Component ───────────────────────────────────────────
function DateCalendarPicker({ dates, selectedFrom, selectedTo, onFromChange, onToChange, onBothChange }) {
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectingFor, setSelectingFor] = useState('from'); // 'from' or 'to'
    const [dateMode, setDateMode] = useState(selectedFrom === selectedTo ? 'single' : 'range'); // 'single' or 'range'
    
    if (!dates || dates.length === 0) return null;
    
    // Get min and max dates to determine the range
    const allDates = [...dates].sort();
    const minDate = new Date(allDates[0]);
    const maxDate = new Date(allDates[allDates.length - 1]);
    
    // Generate calendar grid for the month(s) containing our data
    const generateCalendar = () => {
        const months = [];
        const currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
        
        while (currentMonth <= endMonth) {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startingDayOfWeek = firstDay.getDay();
            
            const days = [];
            // Add empty cells for days before month starts
            for (let i = 0; i < startingDayOfWeek; i++) {
                days.push(null);
            }
            // Add all days of the month
            for (let day = 1; day <= lastDay.getDate(); day++) {
                days.push(new Date(year, month, day));
            }
            
            months.push({
                year,
                month,
                monthName: firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
                days
            });
            
            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        
        return months;
    };
    
    // Helper to format a local Date object to YYYY-MM-DD without UTC shift
    const toLocalDateStr = (date) => {
        if (!date) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleDateClick = (date) => {
        if (!date) return;
        const dateStr = toLocalDateStr(date);
        
        if (dateMode === 'single') {
            // Single date mode: set both from and to atomically
            if (onBothChange) onBothChange(dateStr);
            else { onFromChange(dateStr); onToChange(dateStr); }
            setShowCalendar(false);
        } else {
            // Range mode: first click = from, second click = to
            if (selectingFor === 'from') {
                onFromChange(dateStr);
                setSelectingFor('to');
            } else {
                onToChange(dateStr);
                setShowCalendar(false);
                setSelectingFor('from');
            }
        }
    };
    
    const isDateAvailable = (date) => {
        if (!date) return false;
        const dateStr = toLocalDateStr(date);
        return dates.includes(dateStr);
    };
    
    const isDateSelected = (date) => {
        if (!date) return false;
        const dateStr = toLocalDateStr(date);
        return dateStr === selectedFrom || dateStr === selectedTo;
    };
    
    const isDateInRange = (date) => {
        if (dateMode === 'single') return false;
        if (!date || !selectedFrom || !selectedTo) return false;
        const dateStr = toLocalDateStr(date);
        return dateStr >= selectedFrom && dateStr <= selectedTo;
    };
    
    const calendars = generateCalendar();
    
    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#00BCD4] uppercase tracking-wider">📅 {dateMode === 'single' ? 'Date:' : 'Date Range:'}</span>
                <button 
                    onClick={() => { setShowCalendar(!showCalendar); setSelectingFor('from'); }}
                    className="px-4 py-1.5 bg-[#003d4d] border-2 border-[#00BCD4] text-[#00BCD4] text-xs font-bold rounded-md hover:bg-[#00BCD4] hover:text-black transition-all">
                    {selectedFrom === selectedTo 
                        ? fmtDate(selectedFrom)
                        : `${fmtDate(selectedFrom)} → ${fmtDate(selectedTo)}`
                    } 📅
                </button>
            </div>
            
            {showCalendar && createPortal(
                <div className="fixed inset-0 z-[10000]" onClick={() => setShowCalendar(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[#0f1419] to-[#080c10] border border-[#00BCD4]/40 rounded-2xl shadow-[0_20px_80px_rgba(0,188,212,.2),0_0_0_1px_rgba(0,188,212,.1)] p-5"
                        style={{ minWidth: '340px', maxWidth: '660px' }}
                        onClick={e => e.stopPropagation()}>
                        {/* Mode Toggle */}
                        <div className="flex items-center gap-0 mb-4 bg-[#0a0e12] rounded-xl p-1 border border-[#1a2430]">
                            <button onClick={() => { setDateMode('single'); setSelectingFor('from'); if (selectedFrom !== selectedTo && onBothChange) onBothChange(selectedFrom); }}
                                className={`flex-1 px-5 py-2 text-[11px] font-black rounded-lg transition-all duration-200 ${dateMode === 'single' ? 'bg-gradient-to-r from-[#00BCD4] to-[#00ACC1] text-black shadow-[0_2px_12px_rgba(0,188,212,.35)]' : 'text-[#667] hover:text-[#99a]'}`}>
                                📍 Single Date
                            </button>
                            <button onClick={() => { setDateMode('range'); setSelectingFor('from'); }}
                                className={`flex-1 px-5 py-2 text-[11px] font-black rounded-lg transition-all duration-200 ${dateMode === 'range' ? 'bg-gradient-to-r from-[#00BCD4] to-[#00ACC1] text-black shadow-[0_2px_12px_rgba(0,188,212,.35)]' : 'text-[#667] hover:text-[#99a]'}`}>
                                📅 Date Range
                            </button>
                        </div>
                        {/* Instruction + Close */}
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-[11px] font-black text-[#00BCD4]/80 uppercase tracking-widest">
                                {dateMode === 'single' ? 'Tap a date' : (selectingFor === 'from' ? '① Pick START date' : '② Pick END date')}
                            </div>
                            <button onClick={() => setShowCalendar(false)}
                                className="w-7 h-7 rounded-lg bg-[#111820] border border-[#1a2430] text-[#00BCD4] hover:bg-[#00BCD4] hover:text-black transition-all flex items-center justify-center text-[12px] font-black">✕</button>
                        </div>
                        {/* Calendar Grid */}
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
                            {calendars.map((cal, idx) => (
                                <div key={idx} className="bg-[#0a0e12] border border-[#1a2430] rounded-xl p-4">
                                    <div className="text-center text-[12px] font-black text-white mb-3 tracking-wide">{cal.monthName}</div>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, di) => (
                                            <div key={di} className="text-center text-[9px] font-black text-[#445] py-1 uppercase">{day}</div>
                                        ))}
                                        {cal.days.map((date, dayIdx) => {
                                            if (!date) return <div key={`empty-${dayIdx}`} />;
                                            const available = isDateAvailable(date);
                                            const selected = isDateSelected(date);
                                            const inRange = isDateInRange(date);
                                            const isToday = toLocalDateStr(date) === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                                            return (
                                                <button key={dayIdx}
                                                    onClick={() => available && handleDateClick(date)}
                                                    disabled={!available}
                                                    className={`
                                                        w-full aspect-square text-[11px] font-bold rounded-lg transition-all duration-150
                                                        ${available ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-20'}
                                                        ${selected ? 'bg-gradient-to-br from-[#00BCD4] to-[#0097A7] text-black font-black shadow-[0_0_14px_rgba(0,188,212,.5)] ring-2 ring-[#00BCD4]/40 scale-105' : ''}
                                                        ${!selected && inRange ? 'bg-[#00BCD4]/15 text-[#00BCD4] border border-[#00BCD4]/20' : ''}
                                                        ${!selected && !inRange && available ? 'bg-[#111820] text-[#ccd] hover:bg-[#00BCD4]/20 hover:text-[#00BCD4] border border-transparent hover:border-[#00BCD4]/30' : ''}
                                                        ${!available ? 'bg-transparent text-[#222]' : ''}
                                                        ${isToday && !selected ? 'ring-1 ring-[#00BCD4]/30' : ''}
                                                    `}>
                                                    {date.getDate()}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Legend */}
                        <div className="mt-4 pt-3 border-t border-[#1a2430] flex items-center gap-4 text-[9px]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-md bg-gradient-to-br from-[#00BCD4] to-[#0097A7] shadow-[0_0_6px_rgba(0,188,212,.4)]" />
                                <span className="text-[#889] font-bold">Selected</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-md bg-[#111820] border border-[#1a2430]" />
                                <span className="text-[#889] font-bold">Available</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-md ring-1 ring-[#00BCD4]/30" />
                                <span className="text-[#667] font-bold">Today</span>
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}

// ── Controls Bar ──────────────────────────────────────────────────────────────
const selectCls = "px-3.5 py-1.5 bg-[#003d4d] border-2 border-[#00BCD4] text-white text-xs font-bold rounded-md cursor-pointer font-['Arial_Black',Arial,sans-serif]";
function ControlsBar({ agents, dates, selectedAgent, filterFrom, filterTo, onAgentChange, onFromChange, onToChange, onBothChange, isUploaded, warningFilter, onWarningFilter, warnings, warnToggle, agentMappings, designationFilter, teamFilter, onDesignationFilter, onTeamFilter }) {
    const [warnOpen, setWarnOpen] = useState(false);
    const [agentOpen, setAgentOpen] = useState(false);
    const [agentSearch, setAgentSearch] = useState('');
    const [desigOpen, setDesigOpen] = useState(false);
    const [teamOpen, setTeamOpen] = useState(false);
    const warnRef = useRef(null);
    const agentRef = useRef(null);
    const desigRef = useRef(null);
    const teamRef = useRef(null);
    // Refs for portaled dropdown content (for outside-click detection)
    const warnDropRef = useRef(null);
    const agentDropRef = useRef(null);
    const desigDropRef = useRef(null);
    const teamDropRef = useRef(null);

    // Helper to get fixed position below a button ref
    const getDropPos = (ref) => {
        if (!ref.current) return { top: 0, left: 0 };
        const rect = ref.current.getBoundingClientRect();
        return { top: rect.bottom + 4, left: rect.left };
    };

    useEffect(() => {
        const handler = e => {
            if (warnRef.current && !warnRef.current.contains(e.target) && (!warnDropRef.current || !warnDropRef.current.contains(e.target))) setWarnOpen(false);
            if (agentRef.current && !agentRef.current.contains(e.target) && (!agentDropRef.current || !agentDropRef.current.contains(e.target))) setAgentOpen(false);
            if (desigRef.current && !desigRef.current.contains(e.target) && (!desigDropRef.current || !desigDropRef.current.contains(e.target))) setDesigOpen(false);
            if (teamRef.current && !teamRef.current.contains(e.target) && (!teamDropRef.current || !teamDropRef.current.contains(e.target))) setTeamOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    // Count agents per status
    const warnedExts = new Set();
    const justifiedExts = new Set();
    agents.forEach(a => {
        const key = Object.keys(warnToggle || {}).find(k => k === a.ext || k.startsWith(`${a.ext}_`));
        const s = key ? warnToggle[key] : null;
        if (s === 'on') warnedExts.add(a.ext);
        else if (s === 'justified') justifiedExts.add(a.ext);
    });
    const agentsWarned = warnedExts.size;
    const agentsJustified = justifiedExts.size;
    const agentsNoReview = agents.length - agentsWarned - agentsJustified;
    return (
        <div className="left-0 z-[60] px-5 py-2.5 flex items-center gap-3.5 flex-wrap bg-black border-b border-[#1a1a1a]" style={{ width: '100vw', maxWidth: '100%' }}>
            {/* Warning filter dropdown */}
            <div className="relative" ref={warnRef}>
                <button onClick={() => setWarnOpen(p => !p)}
                    className={`px-3.5 py-1.5 border-2 text-[11px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all font-['Arial_Black',Arial,sans-serif] ${
                        warningFilter === 'warned'
                            ? 'bg-[#f59e0b] border-[#f59e0b] text-black'
                            : warningFilter === 'justified'
                                ? 'bg-[#22c55e] border-[#22c55e] text-black'
                                : warningFilter === 'noReview'
                                    ? 'bg-[#1a1a1a] border-[#555] text-[#aaa]'
                                    : 'bg-[#0d0d0d] border-[#333] text-[#888] hover:border-[#555]'
                    }`}>
                    {warningFilter === 'warned' ? '⚠ Warned' : warningFilter === 'justified' ? '✓ Justified' : warningFilter === 'noReview' ? '○ No Review' : '◉ All'} {warnOpen ? '▲' : '▼'}
                </button>
                {warnOpen && createPortal(
                    <div ref={warnDropRef} style={{ position: 'fixed', ...getDropPos(warnRef), zIndex: 99999 }} className="bg-[#0d0d0d] border-2 border-[#a78bfa] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,.8)] min-w-[210px]">
                        {[
                            { v: '', icon: '◉', label: 'All', sub: `${agents.length} agent${agents.length !== 1 ? 's' : ''}`, color: '#a78bfa' },
                            { v: 'warned', icon: '⚠', label: 'Warned', sub: `${agentsWarned} agent${agentsWarned !== 1 ? 's' : ''}`, color: '#f59e0b' },
                            { v: 'justified', icon: '✓', label: 'Justified', sub: `${agentsJustified} agent${agentsJustified !== 1 ? 's' : ''}`, color: '#22c55e' },
                            { v: 'noReview', icon: '○', label: 'No Review', sub: `${agentsNoReview} agent${agentsNoReview !== 1 ? 's' : ''}`, color: '#888' },
                        ].map(opt => (
                            <button key={opt.v || 'all'} onClick={() => { onWarningFilter(opt.v); setWarnOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all ${warningFilter === opt.v ? 'bg-[#1a1a1a]' : 'hover:bg-[#111]'
                                    }`}>
                                <span className="text-sm" style={{ color: opt.color }}>{opt.icon}</span>
                                <span>
                                    <div className="text-[11px] font-black" style={{ color: warningFilter === opt.v ? opt.color : 'white' }}>{opt.label}</div>
                                    <div className={`text-[9px] font-bold text-[#555]`}>{opt.sub}</div>
                                </span>
                                {warningFilter === opt.v && <span className="ml-auto text-[9px] font-black" style={{ color: opt.color }}>✓ Active</span>}
                            </button>
                        ))}
                    </div>
                , document.body)}
            </div>
            <span className="text-xs font-black text-[#00BCD4] uppercase tracking-wider">👤 Agent:</span>
            {/* Modern searchable agent dropdown — shows mapped names, deduplicates */}
            <div className="relative" ref={agentRef}>
                {(() => {
                    // Build display list: show mapped_name (deduplicated) or dialer name
                    const displayList = (() => {
                        const mappedGroups = {}; // { mapped_name: [exts] }
                        const unmapped = []; // agents with no mapping
                        agents.forEach(a => {
                            const m = agentMappings && agentMappings[a.ext];
                            if (m?.mapped_name) {
                                if (!mappedGroups[m.mapped_name]) mappedGroups[m.mapped_name] = [];
                                mappedGroups[m.mapped_name].push(a);
                            } else {
                                unmapped.push(a);
                            }
                        });
                        const list = [];
                        Object.entries(mappedGroups).forEach(([name, group]) => {
                            list.push({ key: group.length === 1 ? group[0].ext : `mapped:${name}`, name, exts: group.map(a => a.ext), sub: group.map(a => a.ext).join(', '), isMapped: true });
                        });
                        unmapped.forEach(a => {
                            list.push({ key: a.ext, name: a.name, exts: [a.ext], sub: a.ext, isMapped: false });
                        });
                        return list.sort((a, b) => a.name.localeCompare(b.name));
                    })();
                    // Find display name for button
                    const selectedDisplay = selectedAgent
                        ? displayList.find(d => d.key === selectedAgent || d.exts.includes(selectedAgent))?.name || selectedAgent
                        : 'All Agents';
                    return <>
                        <button onClick={() => { setAgentOpen(p => !p); setAgentSearch(''); }}
                            className={`px-3.5 py-1.5 border-2 text-[11px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all font-['Arial_Black',Arial,sans-serif] min-w-[160px] text-left flex items-center justify-between gap-2 ${
                                selectedAgent ? 'bg-[#003d4d] border-[#00BCD4] text-[#00BCD4]' : 'bg-[#003d4d] border-[#00BCD4] text-white'
                            }`}>
                            <span>{selectedDisplay}</span>
                            <span className="text-[9px]">{agentOpen ? '▲' : '▼'}</span>
                        </button>
                        {agentOpen && createPortal(
                            <div ref={agentDropRef} style={{ position: 'fixed', ...getDropPos(agentRef), zIndex: 99999 }} className="bg-[#0d0d0d] border-2 border-[#00BCD4] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,.8)] min-w-[240px]">
                                <div className="px-3 py-2 border-b border-[#1a1a1a]">
                                    <input type="text" placeholder="Search agent..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)}
                                        autoFocus
                                        className="w-full bg-[#111] border border-[#333] rounded-md px-2.5 py-1.5 text-[11px] text-white font-bold focus:outline-none focus:border-[#00BCD4] placeholder:text-[#555]" />
                                </div>
                                <div className="max-h-[280px] overflow-y-auto">
                                    <button onClick={() => { onAgentChange(''); setAgentOpen(false); }}
                                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all ${!selectedAgent ? 'bg-[#003d4d] text-[#00BCD4]' : 'text-white hover:bg-[#0a1a20]'}`}>
                                        <span className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[10px] font-black">👥</span>
                                        <span className="text-[11px] font-black">All Agents</span>
                                    </button>
                                    {displayList.filter(d => !agentSearch || d.name.toLowerCase().includes(agentSearch.toLowerCase()) || d.exts.some(e => e.includes(agentSearch))).map(d => {
                                        const isActive = d.key === selectedAgent || d.exts.includes(selectedAgent);
                                        return (
                                            <button key={d.key} onClick={() => { onAgentChange(d.key); setAgentOpen(false); }}
                                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all ${isActive ? 'bg-[#003d4d] text-[#00BCD4]' : 'text-white hover:bg-[#0a1a20]'}`}>
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 ${d.isMapped ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-purple-600'}`}>
                                                    {d.name.charAt(0).toUpperCase()}
                                                </span>
                                                <span>
                                                    <div className="text-[11px] font-black">{d.name}</div>
                                                    <div className="text-[9px] text-[#666] font-bold">{d.sub}</div>
                                                </span>
                                                {d.exts.length > 1 && <span className="ml-auto text-[8px] font-black bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 px-1.5 py-0 rounded-full">{d.exts.length} exts</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        , document.body)}
                    </>;
                })()}
            </div>
            <DateCalendarPicker 
                dates={dates} 
                selectedFrom={filterFrom} 
                selectedTo={filterTo} 
                onFromChange={onFromChange} 
                onToChange={onToChange}
                onBothChange={onBothChange}
            />
            {/* Designation filter */}
            {agentMappings && Object.keys(agentMappings).length > 0 && (() => {
                const desigs = [...new Set(Object.values(agentMappings).map(m => m.designation).filter(Boolean))].sort();
                if (desigs.length === 0) return null;
                return (
                    <div className="relative" ref={desigRef}>
                        <button onClick={() => setDesigOpen(p => !p)}
                            className={`px-3 py-1.5 border-2 text-[10px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all ${
                                designationFilter ? 'bg-[#60a5fa]/20 border-[#60a5fa] text-[#60a5fa]' : 'bg-[#0d0d0d] border-[#333] text-[#888] hover:border-[#60a5fa]'
                            }`}>
                            {designationFilter || '🎓 Designation'} {desigOpen ? '▲' : '▼'}
                        </button>
                        {desigOpen && createPortal(
                            <div ref={desigDropRef} style={{ position: 'fixed', ...getDropPos(desigRef), zIndex: 99999 }} className="bg-[#0d0d0d] border-2 border-[#60a5fa] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,.8)] min-w-[180px]">
                                <button onClick={() => { onDesignationFilter(''); setDesigOpen(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-[11px] font-black transition-all ${!designationFilter ? 'bg-[#1a1a1a] text-[#60a5fa]' : 'text-white hover:bg-[#111]'}`}>
                                    All Designations
                                </button>
                                {desigs.map(d => (
                                    <button key={d} onClick={() => { onDesignationFilter(d); setDesigOpen(false); }}
                                        className={`w-full px-4 py-2.5 text-left text-[11px] font-black transition-all ${designationFilter === d ? 'bg-[#60a5fa]/20 text-[#60a5fa]' : 'text-white hover:bg-[#111]'}`}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        , document.body)}
                    </div>
                );
            })()}
            {/* Team filter */}
            {agentMappings && Object.keys(agentMappings).length > 0 && (() => {
                const teams = [...new Set(Object.values(agentMappings).map(m => m.team).filter(Boolean))].sort();
                if (teams.length === 0) return null;
                return (
                    <div className="relative" ref={teamRef}>
                        <button onClick={() => setTeamOpen(p => !p)}
                            className={`px-3 py-1.5 border-2 text-[10px] font-black rounded-md cursor-pointer whitespace-nowrap transition-all ${
                                teamFilter ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]' : 'bg-[#0d0d0d] border-[#333] text-[#888] hover:border-[#f59e0b]'
                            }`}>
                            {teamFilter || '👥 Team'} {teamOpen ? '▲' : '▼'}
                        </button>
                        {teamOpen && createPortal(
                            <div ref={teamDropRef} style={{ position: 'fixed', ...getDropPos(teamRef), zIndex: 99999 }} className="bg-[#0d0d0d] border-2 border-[#f59e0b] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,.8)] min-w-[180px]">
                                <button onClick={() => { onTeamFilter(''); setTeamOpen(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-[11px] font-black transition-all ${!teamFilter ? 'bg-[#1a1a1a] text-[#f59e0b]' : 'text-white hover:bg-[#111]'}`}>
                                    All Teams
                                </button>
                                {teams.map(t => (
                                    <button key={t} onClick={() => { onTeamFilter(t); setTeamOpen(false); }}
                                        className={`w-full px-4 py-2.5 text-left text-[11px] font-black transition-all ${teamFilter === t ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'text-white hover:bg-[#111]'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        , document.body)}
                    </div>
                );
            })()}
        </div>
    );
}

// ── Agent Mapping Modal ────────────────────────────────────────────────────────
function AgentMappingModal({ show, onClose, agentMappings, uploadedAgents, onSave }) {
    const toTitleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());
    const [agents, setAgents] = useState([]);
    const [unmappedExts, setUnmappedExts] = useState([]);
    const [saving, setSaving] = useState(false);
    
    const [newName, setNewName] = useState('');
    const [newDesig, setNewDesig] = useState('');
    const [newTeam, setNewTeam] = useState('');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('unmapped');
    
    // For inline assignment popover
    const [assigningExt, setAssigningExt] = useState(null); // {ext, dialer_name}
    // For quick-create profile from unmapped popover
    const [quickCreateMode, setQuickCreateMode] = useState(false);
    const [qcName, setQcName] = useState('');
    const [qcDesig, setQcDesig] = useState('');
    const [qcTeam, setQcTeam] = useState('');

    useEffect(() => {
        if (!show) return;
        const allExtsMap = {};
        
        if (uploadedAgents) {
            uploadedAgents.forEach(a => {
                if (!allExtsMap[a.ext]) allExtsMap[a.ext] = { ext: a.ext, dialer_name: a.name, mapped_name: '', designation: '', team: '' };
            });
        }
        
        Object.entries(agentMappings).forEach(([ext, m]) => {
            if (allExtsMap[ext]) {
                allExtsMap[ext].mapped_name = m.mapped_name || '';
                allExtsMap[ext].designation = m.designation || '';
                allExtsMap[ext].team = m.team || '';
            } else {
                allExtsMap[ext] = { ext, dialer_name: m.dialer_name || '', mapped_name: m.mapped_name || '', designation: m.designation || '', team: m.team || '' };
            }
        });

        const grouped = {};
        const unmappedList = [];
        
        Object.values(allExtsMap).forEach(item => {
            if (item.mapped_name && item.mapped_name.trim()) {
                const key = item.mapped_name.trim();
                if (!grouped[key]) {
                    grouped[key] = { id: key, mapped_name: key, designation: item.designation || '', team: item.team || '', exts: [] };
                }
                grouped[key].exts.push({ ext: item.ext, dialer_name: item.dialer_name });
            } else {
                unmappedList.push({ ext: item.ext, dialer_name: item.dialer_name });
            }
        });

        setAgents(Object.values(grouped).sort((a,b)=> a.mapped_name.localeCompare(b.mapped_name)));
        setUnmappedExts(unmappedList.sort((a,b)=> a.ext.localeCompare(b.ext)));
    }, [show, agentMappings, uploadedAgents]);

    const handleCreateAgent = () => {
        if (!newName.trim()) return;
        const name = toTitleCase(newName.trim());
        if (agents.find(a => a.mapped_name.toLowerCase() === name.toLowerCase())) {
            alert('A profile with this name already exists.');
            return;
        }
        setAgents([{ id: name, mapped_name: name, designation: toTitleCase(newDesig.trim()), team: toTitleCase(newTeam.trim()), exts: [] }, ...agents]);
        setNewName(''); setNewDesig(''); setNewTeam('');
    };

    // Quick create profile AND assign extension from unmapped popover
    const handleQuickCreateAndAssign = (extObj) => {
        if (!qcName.trim()) return;
        const name = toTitleCase(qcName.trim());
        let finalAgents = agents;
        let targetAgent = agents.find(a => a.mapped_name.toLowerCase() === name.toLowerCase());
        if (!targetAgent) {
            targetAgent = { id: name, mapped_name: name, designation: toTitleCase(qcDesig.trim()), team: toTitleCase(qcTeam.trim()), exts: [] };
            finalAgents = [targetAgent, ...agents];
        }
        // Assign ext to this profile
        finalAgents = finalAgents.map(a => a.id === targetAgent.id ? { ...a, exts: [...a.exts, extObj] } : a);
        setAgents(finalAgents);
        setUnmappedExts(prev => prev.filter(e => e.ext !== extObj.ext));
        // Reset quick create state
        setQcName(''); setQcDesig(''); setQcTeam('');
        setQuickCreateMode(false);
        setAssigningExt(null);
    };

    const handleAssignExt = (agentId, extObj) => {
        setUnmappedExts(prev => prev.filter(e => e.ext !== extObj.ext));
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, exts: [...a.exts, extObj] } : a));
    };

    const handleUnassignExt = (agentId, extObj) => {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, exts: a.exts.filter(e => e.ext !== extObj.ext) } : a));
        setUnmappedExts(prev => [...prev, extObj].sort((a,b)=> a.ext.localeCompare(b.ext)));
    };
    
    const handleDeleteAgent = (agentId) => {
        if (!window.confirm("Are you sure you want to delete this profile? All mapped extensions will become unmapped.")) return;
        const agent = agents.find(a => a.id === agentId);
        if (agent && agent.exts.length) {
            setUnmappedExts(prev => [...prev, ...agent.exts].sort((a,b)=> a.ext.localeCompare(b.ext)));
        }
        setAgents(prev => prev.filter(a => a.id !== agentId));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const uid = getCurrentUser()?._id || getCurrentUser()?.id || '';
            const bulkMappings = [];
            agents.forEach(ag => {
                ag.exts.forEach(e => {
                    bulkMappings.push({ ext: e.ext, dialer_name: e.dialer_name, mapped_name: ag.mapped_name, designation: ag.designation, team: ag.team });
                });
            });

            await fetchWithAuth('/api/dialer/agent-mapping/bulk', { method: 'POST', body: JSON.stringify({ mappings: bulkMappings, user_id: uid }) });

            const originallyMapped = Object.keys(agentMappings);
            const nowUnmapped = unmappedExts.map(e => e.ext).filter(e => originallyMapped.includes(e));
            for (const x of nowUnmapped) {
                await fetchWithAuth(`/api/dialer/agent-mapping/${x}`, { method: 'DELETE' });
            }

            if (onSave) await onSave();
            onClose();
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    if (!show) return null;

    const filteredUnmapped = unmappedExts.filter(e =>
        e.ext.includes(search.toLowerCase()) || (e.dialer_name || '').toLowerCase().includes(search.toLowerCase())
    );
    const mappedCount = agents.length;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-lg flex items-center justify-center p-3 lg:p-8 font-sans"
             onClick={() => setAssigningExt(null)}>
            <div className="bg-[#111827] border border-[#374151] rounded-[24px] w-full max-w-[1160px] h-[88vh] flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.7)] overflow-hidden"
                 onClick={e => e.stopPropagation()}>

                {/* ── TOP HEADER ── */}
                <div className="shrink-0 px-7 py-4 flex items-center justify-between border-b border-[#374151] bg-[#1f2937]">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-violet-600/40 border border-violet-400/50 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                        </div>
                        <div>
                            <h2 className="text-[18px] font-black text-white leading-tight tracking-tight">Agent Mapping</h2>
                            <p className="text-[13px] text-gray-400 font-medium mt-0.5">Create profiles &amp; assign extensions with one click</p>
                        </div>
                    </div>

                    {/* Stats Pills */}
                    <div className="hidden md:flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-900/40 border border-amber-500/50 text-[12px] font-bold text-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0"></span>
                            Unmapped <span className="text-amber-100 font-black ml-0.5">{unmappedExts.length}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-900/40 border border-emerald-500/50 text-[12px] font-bold text-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0"></span>
                            Profiles <span className="text-emerald-100 font-black ml-0.5">{mappedCount}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={onClose} disabled={saving}
                            className="h-9 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white font-bold text-[13px] border border-gray-500 transition-all">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="h-9 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-[13px] shadow-[0_4px_20px_rgba(124,58,237,0.5)] transition-all flex items-center gap-2 disabled:opacity-60">
                            {saving ? (
                                <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                            ) : '✓ Save'}
                        </button>
                    </div>
                </div>

                {/* ── TAB BAR ── */}
                <div className="shrink-0 flex items-center gap-1 px-6 pt-4 pb-0 bg-[#111827]">
                    {[
                        { key: 'unmapped', label: 'Unmapped', count: unmappedExts.length, activeColor: 'bg-amber-900/50 text-amber-100 border-amber-500/50', dot: '#f59e0b' },
                        { key: 'mapped',   label: 'Mapped Profiles', count: mappedCount,    activeColor: 'bg-emerald-900/50 text-emerald-100 border-emerald-500/50', dot: '#34d399' },
                    ].map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`relative px-5 py-2.5 rounded-t-xl text-[13px] font-bold transition-all flex items-center gap-2 border-t border-x ${
                                activeTab === t.key
                                    ? 'bg-[#1f2937] text-white border-[#4b5563] border-b-[#1f2937]'
                                    : 'text-gray-400 hover:text-gray-200 border-transparent'
                            }`}>
                            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{background: t.dot}}></span>
                            {t.label}
                            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-black ${activeTab === t.key ? t.activeColor + ' border' : 'bg-gray-700 text-gray-300'}`}>{t.count}</span>
                        </button>
                    ))}
                    <div className="flex-1 border-b border-[#4b5563]"></div>
                </div>

                {/* ── TAB CONTENT ── */}
                <div className="flex-1 overflow-hidden bg-[#1f2937]">

                    {/* ════ UNMAPPED TAB ════ */}
                    {activeTab === 'unmapped' && (
                        <div className="h-full flex flex-col">
                            {/* Search bar */}
                            <div className="shrink-0 px-7 py-4 border-b border-[#374151] bg-[#1f2937] flex items-center gap-3 flex-wrap">
                                <div className="relative flex-1 min-w-[240px] max-w-sm">
                                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                    <input type="text" placeholder="Search by extension or name…" value={search} onChange={e => setSearch(e.target.value)}
                                        className="w-full h-10 bg-gray-800 border border-gray-600 rounded-xl pl-10 pr-4 text-[13px] text-white placeholder:text-gray-500 outline-none focus:border-violet-500 transition-colors" />
                                </div>
                                {agents.length === 0 && (
                                    <p className="text-[12px] text-amber-200 font-semibold flex items-center gap-1.5 bg-amber-900/40 border border-amber-500/40 px-3 py-2 rounded-xl">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                        First create a profile in <strong className="text-amber-100">"Mapped Profiles"</strong> tab, then assign extensions here
                                    </p>
                                )}
                            </div>

                            {/* Extensions Grid */}
                            <div className="flex-1 overflow-y-auto px-7 py-5 custom-scrollbar">
                                {unmappedExts.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        </div>
                                        <p className="text-[15px] font-black text-white">All extensions mapped!</p>
                                        <p className="text-[13px] text-slate-400">Every extension has been assigned to a profile.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {filteredUnmapped.map(ue => {
                                            const isAssigning = assigningExt?.ext === ue.ext;
                                            return (
                                                <div key={ue.ext} className="relative">
                                                    <button
                                                        onClick={() => { setAssigningExt(isAssigning ? null : ue); setQuickCreateMode(false); setQcName(''); setQcDesig(''); setQcTeam(''); }}
                                                        className={`w-full group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all text-center ${
                                                            isAssigning
                                                                ? 'bg-violet-600/30 border-violet-400/70 shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                                                                : 'bg-gray-800 border-gray-600 hover:border-violet-400/70 hover:bg-violet-600/20'
                                                        }`}>
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[12px] shrink-0 transition-colors ${isAssigning ? 'bg-violet-500 text-white' : 'bg-gray-700 text-gray-200 group-hover:bg-violet-500/40 group-hover:text-violet-200'}`}>
                                                            {ue.ext.slice(-4)}
                                                        </div>
                                                        <span className={`text-[12px] font-bold leading-tight transition-colors truncate w-full ${isAssigning ? 'text-violet-100' : 'text-gray-200 group-hover:text-white'}`}>
                                                            {ue.dialer_name || 'No Name'}
                                                        </span>
                                                        <span className={`text-[10px] font-semibold ${isAssigning ? 'text-violet-300' : 'text-gray-400'}`}>{ue.ext}</span>
                                                    </button>

                                                    {/* Agent Picker Popover */}
                                                    {isAssigning && (
                                                        <>
                                                            <div className="fixed inset-0 z-[50]" onClick={() => { setAssigningExt(null); setQuickCreateMode(false); setQcName(''); setQcDesig(''); setQcTeam(''); }}></div>
                                                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[60] bg-[#1f2937] border border-gray-500 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden min-w-[260px]" onClick={e => e.stopPropagation()}>
                                                                {/* Create New Profile section */}
                                                                {quickCreateMode ? (
                                                                    <div className="p-3 space-y-2 border-b border-gray-600 bg-violet-900/30">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <p className="text-[10px] uppercase text-violet-300 font-black tracking-widest">New Profile</p>
                                                                            <button onClick={() => { setQuickCreateMode(false); setQcName(''); setQcDesig(''); setQcTeam(''); }}
                                                                                className="text-[10px] text-gray-400 hover:text-white transition-colors">✕</button>
                                                                        </div>
                                                                        <input autoFocus type="text" placeholder="Full Name *" value={qcName}
                                                                            onChange={e => setQcName(toTitleCase(e.target.value))}
                                                                            onKeyDown={e => e.key === 'Enter' && handleQuickCreateAndAssign(ue)}
                                                                            className="w-full h-8 bg-gray-800 border border-gray-600 rounded-lg px-3 text-[12px] text-white placeholder:text-gray-500 outline-none focus:border-violet-400 transition-colors" />
                                                                        <div className="flex gap-1.5">
                                                                            <input type="text" placeholder="Designation" value={qcDesig}
                                                                                onChange={e => setQcDesig(toTitleCase(e.target.value))}
                                                                                className="flex-1 h-8 bg-gray-800 border border-gray-600 rounded-lg px-2 text-[11px] text-white placeholder:text-gray-500 outline-none focus:border-violet-400 transition-colors" />
                                                                            <input type="text" placeholder="Team" value={qcTeam}
                                                                                onChange={e => setQcTeam(toTitleCase(e.target.value))}
                                                                                className="w-20 h-8 bg-gray-800 border border-gray-600 rounded-lg px-2 text-[11px] text-white placeholder:text-gray-500 outline-none focus:border-violet-400 transition-colors" />
                                                                        </div>
                                                                        <button onClick={() => handleQuickCreateAndAssign(ue)}
                                                                            disabled={!qcName.trim()}
                                                                            className="w-full h-8 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[12px] rounded-lg transition-all flex items-center justify-center gap-1.5">
                                                                            ✓ Create &amp; Assign
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="px-3 py-2 border-b border-gray-600 bg-gray-800 flex items-center justify-between">
                                                                        <p className="text-[11px] uppercase text-gray-300 font-black tracking-widest">Assign to profile</p>
                                                                        <button onClick={() => setQuickCreateMode(true)}
                                                                            className="flex items-center gap-1 text-[10px] font-black text-violet-400 hover:text-violet-300 transition-colors bg-violet-500/15 border border-violet-500/30 px-2 py-1 rounded-lg hover:bg-violet-500/25">
                                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                                                            New Profile
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {!quickCreateMode && (
                                                                    agents.length === 0 ? (
                                                                        <div className="px-4 py-3 text-[12px] text-amber-200 font-semibold">Click "New Profile" above to create one</div>
                                                                    ) : (
                                                                        <div className="p-2 flex flex-col gap-1 max-h-52 overflow-y-auto custom-scrollbar">
                                                                            {agents.map(ag => (
                                                                                <button key={ag.id}
                                                                                    onClick={() => { handleAssignExt(ag.id, ue); setAssigningExt(null); }}
                                                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-violet-500/20 text-left transition-all group/pick border border-transparent hover:border-violet-500/30">
                                                                                    <div className="w-8 h-8 rounded-xl bg-violet-500/30 border border-violet-400/40 flex items-center justify-center text-[11px] font-black text-violet-200 shrink-0">
                                                                                        {ag.mapped_name.slice(0,2).toUpperCase()}
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="text-[13px] font-bold text-white truncate">{ag.mapped_name}</p>
                                                                                        {ag.designation && <p className="text-[11px] text-gray-400 truncate">{ag.designation}</p>}
                                                                                    </div>
                                                                                    <svg className="w-4 h-4 text-violet-400 opacity-0 group-hover/pick:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════ MAPPED PROFILES TAB ════ */}
                    {activeTab === 'mapped' && (
                        <div className="h-full flex flex-col">

                            {/* Create New Profile Bar */}
                            <div className="shrink-0 px-7 py-5 border-b border-[#374151] bg-[#1f2937]">
                                <p className="text-[11px] uppercase text-gray-400 font-black tracking-widest mb-3">New Profile</p>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <input type="text" placeholder="Full Name *" value={newName} onChange={e => setNewName(toTitleCase(e.target.value))}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateAgent()}
                                        className="flex-1 min-w-[180px] h-10 bg-gray-800 border border-gray-600 rounded-xl px-4 text-[13px] text-white placeholder:text-gray-500 outline-none focus:border-violet-500 transition-colors font-semibold" />
                                    <input type="text" placeholder="Designation" value={newDesig} onChange={e => setNewDesig(toTitleCase(e.target.value))}
                                        className="w-36 h-10 bg-gray-800 border border-gray-600 rounded-xl px-3 text-[13px] text-white placeholder:text-gray-500 outline-none focus:border-violet-500 transition-colors font-semibold" />
                                    <input type="text" placeholder="Team" value={newTeam} onChange={e => setNewTeam(toTitleCase(e.target.value))}
                                        className="w-28 h-10 bg-gray-800 border border-gray-600 rounded-xl px-3 text-[13px] text-white placeholder:text-gray-500 outline-none focus:border-violet-500 transition-colors font-semibold" />
                                    <button onClick={handleCreateAgent}
                                        className="h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white font-black text-[13px] rounded-xl transition-all flex items-center gap-2 shadow-[0_4px_16px_rgba(124,58,237,0.5)] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                                        disabled={!newName.trim()}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                        Add Profile
                                    </button>
                                </div>
                            </div>

                            {/* Agent Cards List */}
                            <div className="flex-1 overflow-y-auto px-7 py-5 custom-scrollbar">
                                {agents.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
                                        <svg className="w-14 h-14 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                        <p className="text-[15px] font-black text-gray-300">No profiles yet</p>
                                        <p className="text-[13px] text-gray-500">Use the form above to create your first agent profile</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {agents.map(ag => (
                                            <div key={ag.id}
                                                className="group bg-gray-800 border border-gray-600 hover:border-violet-400/60 rounded-2xl p-5 transition-all hover:shadow-[0_4px_24px_-6px_rgba(124,58,237,0.25)] relative">

                                                {/* Delete button */}
                                                <button onClick={() => handleDeleteAgent(ag.id)}
                                                    className="absolute top-3.5 right-3.5 w-7 h-7 rounded-xl bg-gray-700 hover:bg-red-500/25 text-gray-400 hover:text-red-300 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-gray-500 hover:border-red-500/40">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                </button>

                                                {/* Agent Info Row */}
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/50 to-indigo-500/50 border border-violet-400/50 flex items-center justify-center font-black text-[13px] text-white shrink-0">
                                                        {ag.mapped_name.slice(0,2).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-[15px] font-black text-white truncate leading-tight">{ag.mapped_name}</h4>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {ag.designation && (
                                                                <span className="bg-gray-700 text-gray-200 border border-gray-500 px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide">
                                                                    {ag.designation}
                                                                </span>
                                                            )}
                                                            {ag.team && (
                                                                <span className="bg-gray-700 text-gray-200 border border-gray-500 px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide">
                                                                    {ag.team}
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] text-gray-400 font-semibold">
                                                                {ag.exts.length} extension{ag.exts.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Mapped Extensions as Chips */}
                                                <div className="flex flex-wrap gap-2 min-h-[32px] items-center pl-1">
                                                    {ag.exts.length === 0 && (
                                                        <span className="text-[12px] text-gray-400 font-semibold italic">
                                                            No extensions yet — go to "Unmapped" tab to assign
                                                        </span>
                                                    )}
                                                    {ag.exts.map(e => (
                                                        <div key={e.ext}
                                                            className="inline-flex items-center gap-1.5 bg-indigo-500/25 border border-indigo-400/50 hover:border-indigo-300 px-3 py-1.5 rounded-xl transition-all cursor-default">
                                                            <span className="text-indigo-100 font-black text-[12px] leading-none">{e.ext}</span>
                                                            <span className="text-indigo-300 text-[11px] font-semibold leading-none truncate max-w-[80px]">{e.dialer_name}</span>
                                                            <button onClick={() => handleUnassignExt(ag.id, e)}
                                                                className="w-4 h-4 rounded-full flex items-center justify-center bg-indigo-500/30 text-indigo-200 hover:bg-red-500 hover:text-white transition-all text-[9px] shrink-0 ml-0.5">
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Rules Modal

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
                <div className="px-6 py-5 space-y-1">
                    {/* Rule 1 */}
                    <SHdr>🕐 1. Login & Logout Time</SHdr>
                    <RuleCard title="When to Log In / Log Out" badge="🔴 Important" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="You must <strong>log in before 10:30 AM</strong> and <strong>log out after 7:00 PM</strong>.<br/>If you log in late or leave early, those missed minutes are automatically added to your Waste Time."
                        eg="Example A: You log in at 10:45 AM → 15 minutes late → 15 min added to waste.<br/>Example B: You log out at 6:45 PM → 15 minutes early → 15 min added to waste." />
                    {/* Rule 2 */}
                    <SHdr>📞 2. Number of Calls</SHdr>
                    <RuleCard title="Total Calls (OB + Manual)" badge="ℹ Info Only" badgeCls="bg-[#60a5fa] text-black" borderCls="border-l-[#60a5fa]"
                        desc="The Calls column shows your total calls: <strong>Outbound (OB)</strong> calls you dialled + <strong>Manual (MN)</strong> calls you made manually.<br/>This is just information — there is no pass or fail limit on call count." />
                    {/* Rule 3 */}
                    <SHdr>⏱️ 3. Talk Time (Suspicious Check)</SHdr>
                    <RuleCard title="Too Many Manual Calls?" badge="🔴 Important" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="If your <strong>Manual call talk time is 40% or more</strong> of your Outbound talk time, it gets flagged as suspicious (cell turns RED).<br/>This means you might be spending too much time on manual calls compared to your main outbound work."
                        eg="Example: You talked 2 hours on outbound calls. If manual call time is 48 min or more (that's 40% of 2h) → RED flag ⚠" />
                    {/* Rule 4 */}
                    <SHdr>📝 4. Wrapup Time After Each Call</SHdr>
                    <RuleCard title="Max 10 Seconds Per Call" badge="🔴 Important" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="After every call, you should complete your wrapup within <strong>10 seconds</strong>.<br/>If your average wrapup goes above 10s per call, the extra time is counted as Waste."
                        eg="Example: You made 20 calls. Max allowed = 20 × 10s = 200s. If you used 300s total → 100 extra seconds = waste." />
                    {/* Rule 5 */}
                    <SHdr>⏸️ 5. Auto Idle (System Generated)</SHdr>
                    <RuleCard title="System Idle — No Penalty" badge="ℹ Info Only" badgeCls="bg-[#60a5fa] text-black" borderCls="border-l-[#60a5fa]"
                        desc="Sometimes the system automatically puts your line into idle mode. This is <strong>not your fault</strong> — it happens automatically.<br/>Auto Idle is shown here just for information. No penalty or rule applies to it." />
                    {/* Rule 6 */}
                    <SHdr>🚫 6. Manual Idle (Going Idle on Purpose)</SHdr>
                    <RuleCard title="Zero Tolerance — Not Allowed at All" badge="🔴 Important" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="If you manually put yourself into idle mode, <strong>every single second of that idle time</strong> is added to your Waste Time.<br/>There is no forgiveness — even 1 minute of manual idle is a violation."
                        eg="Example: You manually went idle for 5 minutes → all 5 minutes counted as waste, cell turns RED." />
                    {/* Rule 7 */}
                    <SHdr>☕ 7. Break Time</SHdr>
                    <RuleCard title="Maximum 1 Hour of Break Per Day" badge="🔴 Important" badgeCls="bg-[#c0392b] text-white" borderCls="border-l-[#c0392b]"
                        desc="You are allowed <strong>up to 1 hour of break</strong> per day (60 minutes total).<br/>If your total break time goes above 1 hour, the extra time is added to your Waste."
                        eg="Example: You took 1 hour 20 minutes of break → 20 extra minutes = waste, cell turns RED." />
                    {/* Waste Summary */}
                    <SHdr>⚠️ Waste Time — What Is It?</SHdr>
                    <RuleCard title="Your Total 'Lost' Time" badge="⚠ Summary" badgeCls="bg-[#f59e0b] text-black" borderCls="border-l-[#f59e0b]"
                        desc="Waste Time shows how much working time was &quot;lost&quot; due to rule violations. It adds up all issues:<br/>🔴 Late Login &nbsp;|&nbsp; 🔴 Early Exit &nbsp;|&nbsp; 🚫 Manual Idle &nbsp;|&nbsp; 📝 Extra Wrapup &nbsp;|&nbsp; ☕ Extra Break &nbsp;|&nbsp; ⚠ Suspicious Talk<br/><br/>The lower your waste time, the better your performance." />
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
    const [warningFilter, setWarningFilter] = useState('');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [warnAgent, setWarnAgent] = useState(null);
    const [pendingHistoryId, setPendingHistoryId] = useState(null);
    const [agentRemarks, setAgentRemarks] = useState({}); // { "ext__date": [remarks] }
    const [agentLogins, setAgentLogins] = useState({}); // { "ext__date": [login entries] }
    const [agentLeads, setAgentLeads] = useState({}); // { "ext__date": [lead entries] }
    const [agentMappings, setAgentMappings] = useState({}); // { ext: { mapped_name, designation, team } }
    const [mappingModalOpen, setMappingModalOpen] = useState(false);
    const [designationFilter, setDesignationFilter] = useState('');
    const [teamFilter, setTeamFilter] = useState('');

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
                            const latestDate = dates[dates.length - 1] || dates[0]; // Use LATEST date from uploaded data
                            if (latestDate) { setFilterFrom(latestDate); setFilterTo(latestDate); }
                        }
                    } catch { /* ignore */ }
                }
            })
            .catch(() => { });
    }, []);

    // ── Load agent mappings from backend on mount ──
    const loadAgentMappings = useCallback(async () => {
        try {
            const r = await fetchWithAuth('/api/dialer/agent-mapping');
            const d = await r.json();
            if (d?.success) {
                const map = {};
                (d.mappings || []).forEach(m => { map[m.ext] = m; });
                setAgentMappings(map);
            }
        } catch { /* ignore */ }
    }, []);
    useEffect(() => { loadAgentMappings(); }, [loadAgentMappings]);

    // ── Load all remarks from backend on mount ──
    const loadRemarks = useCallback(async () => {
        try {
            const r = await fetchWithAuth('/api/dialer/remarks');
            const d = await r.json();
            if (d?.success) {
                const grouped = {};
                (d.remarks || []).forEach(rm => {
                    const key = `${rm.ext}__${rm.date}`;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(rm);
                });
                setAgentRemarks(grouped);
            }
        } catch { /* ignore */ }
    }, []);
    useEffect(() => { loadRemarks(); }, [loadRemarks]);

    // ── Add / Delete remark handlers ──
    const handleAddRemark = useCallback(async (remarkData) => {
        const uid = getCurrentUser()?._id || getCurrentUser()?.id || '';
        try {
            const r = await fetchWithAuth('/api/dialer/remarks', {
                method: 'POST',
                body: JSON.stringify({ ...remarkData, user_id: uid }),
            });
            const d = await r.json();
            if (d?.success) {
                // Add to local state immediately
                const key = `${remarkData.ext}__${remarkData.date}`;
                setAgentRemarks(prev => ({
                    ...prev,
                    [key]: [d.remark, ...(prev[key] || [])],
                }));
            }
        } catch (e) { console.error('Add remark error', e); }
    }, []);

    const handleDeleteRemark = useCallback(async (remarkId, ext, date) => {
        try {
            const r = await fetchWithAuth(`/api/dialer/remarks/${remarkId}`, { method: 'DELETE' });
            const d = await r.json();
            if (d?.success) {
                const key = `${ext}__${date}`;
                setAgentRemarks(prev => ({
                    ...prev,
                    [key]: (prev[key] || []).filter(rm => rm._id !== remarkId),
                }));
            }
        } catch (e) { console.error('Delete remark error', e); }
    }, []);

    // ── Load login entries from backend on mount ──
    const loadLogins = useCallback(async () => {
        try {
            const r = await fetchWithAuth('/api/dialer/login-entries');
            const d = await r.json();
            if (d?.success) {
                const grouped = {};
                (d.entries || []).forEach(e => {
                    const key = `${e.ext}__${e.date}`;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(e);
                });
                setAgentLogins(grouped);
            }
        } catch { /* ignore */ }
    }, []);
    useEffect(() => { loadLogins(); }, [loadLogins]);

    // ── Add / Delete login entry handlers ──
    const handleAddLogin = useCallback(async (data) => {
        const uid = getCurrentUser()?._id || getCurrentUser()?.id || '';
        try {
            const r = await fetchWithAuth('/api/dialer/login-entries', {
                method: 'POST',
                body: JSON.stringify({ ...data, user_id: uid }),
            });
            const d = await r.json();
            if (d?.success) {
                const key = `${data.ext}__${data.date}`;
                setAgentLogins(prev => ({
                    ...prev,
                    [key]: [d.entry, ...(prev[key] || [])],
                }));
            }
        } catch (e) { console.error('Add login entry error', e); }
    }, []);

    const handleDeleteLogin = useCallback(async (entryId, ext, date) => {
        try {
            const r = await fetchWithAuth(`/api/dialer/login-entries/${entryId}`, { method: 'DELETE' });
            const d = await r.json();
            if (d?.success) {
                const key = `${ext}__${date}`;
                setAgentLogins(prev => ({
                    ...prev,
                    [key]: (prev[key] || []).filter(e => e._id !== entryId),
                }));
            }
        } catch (e) { console.error('Delete login entry error', e); }
    }, []);

    // ── Load lead entries from backend on mount ──
    const loadLeads = useCallback(async () => {
        try {
            const r = await fetchWithAuth('/api/dialer/lead-entries');
            const d = await r.json();
            if (d?.success) {
                const grouped = {};
                (d.entries || []).forEach(e => {
                    const key = `${e.ext}__${e.date}`;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(e);
                });
                setAgentLeads(grouped);
            }
        } catch { /* ignore */ }
    }, []);
    useEffect(() => { loadLeads(); }, [loadLeads]);

    // ── Add / Delete lead entry handlers ──
    const handleAddLead = useCallback(async (data) => {
        const uid = getCurrentUser()?._id || getCurrentUser()?.id || '';
        try {
            const r = await fetchWithAuth('/api/dialer/lead-entries', {
                method: 'POST',
                body: JSON.stringify({ ...data, user_id: uid }),
            });
            const d = await r.json();
            if (d?.success) {
                const key = `${data.ext}__${data.date}`;
                setAgentLeads(prev => ({
                    ...prev,
                    [key]: [d.entry, ...(prev[key] || [])],
                }));
            }
        } catch (e) { console.error('Add lead entry error', e); }
    }, []);

    const handleDeleteLead = useCallback(async (entryId, ext, date) => {
        try {
            const r = await fetchWithAuth(`/api/dialer/lead-entries/${entryId}`, { method: 'DELETE' });
            const d = await r.json();
            if (d?.success) {
                const key = `${ext}__${date}`;
                setAgentLeads(prev => ({
                    ...prev,
                    [key]: (prev[key] || []).filter(e => e._id !== entryId),
                }));
            }
        } catch (e) { console.error('Delete lead entry error', e); }
    }, []);

    // Persist warning notes to localStorage
    const updateWarnings = useCallback(updated => {
        setWarnings(updated);
        lsSet(LS_WARN, updated);
    }, []);

    // ── Warning toggle — calls backend ───────────────────────────────────────
    // targetAction: 'on' (warn), 'justified', 'off' (clear)
    const handleToggleWarn = useCallback(async (ext, agentName, date, isMultiDate, targetAction, remarks = '') => {
        // Use composite key for multi-date scenarios
        const warnKey = isMultiDate ? `${ext}_${date}` : ext;
        // If no targetAction given, toggle between 'on' and 'off'
        const currentState = warnToggle[warnKey] || 'off';
        const newAction = targetAction || (currentState === 'off' ? 'on' : 'off');
        const uid = getCurrentUser()?._id || getCurrentUser()?.id || getCurrentUser()?.user_id || '';
        try {
            const res = await fetchWithAuth('/api/dialer/toggle', {
                method: 'POST',
                body: JSON.stringify({ ext, agent_name: agentName, date, action: newAction, user_id: uid, remarks: remarks || '' }),
            });
            const data = await res.json();
            if (data.success) {
                // Optimistically update local state with actual action string
                setWarnToggle(prev => ({ ...prev, [warnKey]: newAction === 'off' ? null : newAction }));
                if (newAction === 'off') {
                    // Backend deletes all toggle events — clear local history too
                    setWarnToggleHistory(prev => ({ ...prev, [warnKey]: [] }));
                } else {
                    // Refresh history for this agent+date combination
                    const historyUrl = isMultiDate 
                        ? `/api/dialer/toggle/history?ext=${encodeURIComponent(ext)}&date=${encodeURIComponent(date)}`
                        : `/api/dialer/toggle/history?ext=${encodeURIComponent(ext)}`;
                    fetchWithAuth(historyUrl)
                        .then(r => r.json())
                        .then(d => {
                            if (d.success) {
                                setWarnToggleHistory(prev => ({ ...prev, [warnKey]: d.history || [] }));
                            }
                        }).catch(() => { });
                }
            }
        } catch (e) {
            console.error('Toggle error', e);
        }
    }, [warnToggle]);

    // Derived dataset: use uploaded if present, else default
    // null uploadedAgents = no file uploaded yet → empty dataset
    const activeAgents = uploadedAgents || [];

    const handleUpload = useCallback(async (agents, filename, fileSize, existingId) => {
        // Smart merge: new file's data (by ext__date key) replaces existing, but keeps rows not in new file
        let finalAgents = agents;
        if (uploadedAgents?.length) {
            const newKeys = new Set(agents.map(a => `${a.ext}__${a.date}`));
            const kept = uploadedAgents.filter(a => !newKeys.has(`${a.ext}__${a.date}`));
            finalAgents = [...kept, ...agents];
        }
        setUploadedAgents(finalAgents);
        const dates = [...new Set(finalAgents.map(a => a.date))].sort();
        const latest = dates[dates.length - 1] || dates[0];
        setFilterFrom(latest);
        setFilterTo(latest);
        setSelectedAgent('');
        const uid = getCurrentUser()?._id || getCurrentUser()?.id || getCurrentUser()?.user_id || '';
        let savedId = null;
        try {
            // Always POST a new history entry for each upload
            const res = await fetchWithAuth('/api/dialer/upload', {
                method: 'POST',
                body: JSON.stringify({ filename: filename || 'upload.xlsx', record_count: finalAgents.length, file_size: fileSize || null, user_id: uid, agents: finalAgents }),
            });
            const resData = await res.json();
            if (resData.success && resData.upload?.id) savedId = resData.upload.id;
            setCurrentHistoryId(savedId);
            const r = await fetchWithAuth('/api/dialer/upload/history');
            const d = await r.json();
            if (d.success) setUploadHistory(d.history || []);
        } catch (e) { console.error('Upload save error', e); }
    }, [uploadedAgents]);

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
            // Debug: check first agent loaded from backend
            console.log('[handleHistoryLoad] First agent from backend:', {
                name: d.agents[0].name,
                manCalls: d.agents[0].manCalls,
                manTT: d.agents[0].manTT,
                outCalls: d.agents[0].outCalls,
                outTT: d.agents[0].outTT
            });
            console.log('[handleHistoryLoad] ⚠️ CHECKING ALL AGENTS for manual data...');
            const agentsWithManual = d.agents.filter(a => (a.manCalls && a.manCalls > 0) || (a.manTT && a.manTT !== '00:00:00'));
            console.log(`[handleHistoryLoad] Found ${agentsWithManual.length} agents with manual calls/duration out of ${d.agents.length} total`);
            if (agentsWithManual.length > 0) {
                console.log('[handleHistoryLoad] Sample agents with manual data:', agentsWithManual.slice(0, 3));
            }
            setUploadedAgents(d.agents);
            setCurrentHistoryId(h.id); // Track which history item is loaded
            const dates = [...new Set(d.agents.map(a => a.date))].sort();
            const latestDate = dates[dates.length - 1] || dates[0]; // Use LATEST date
            setFilterFrom(latestDate);
            setFilterTo(latestDate);
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
    const setBothDates = useCallback(v => { setFilterFrom(v); setFilterTo(v); }, []);
    const isMultiDate = filterFrom !== filterTo;
    const isSingleAgent = !!selectedAgent && !selectedAgent.startsWith('mapped:');

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

    useEffect(() => {
        document.body.style.overflow = rulesOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [rulesOpen]);

    const processed = useMemo(() => {
        // Support mapped:NAME grouped agent filter
        let agentFilter;
        if (selectedAgent && selectedAgent.startsWith('mapped:')) {
            const mappedName = selectedAgent.slice(7); // remove 'mapped:' prefix
            const matchExts = new Set();
            Object.entries(agentMappings).forEach(([ext, m]) => { if (m.mapped_name === mappedName) matchExts.add(ext); });
            agentFilter = a => matchExts.has(a.ext);
        } else if (selectedAgent) {
            agentFilter = a => a.ext === selectedAgent;
        } else {
            agentFilter = () => true;
        }
        let raw = activeAgents.filter(a => a.date >= filterFrom && a.date <= filterTo && agentFilter(a));
        // Deduplicate by (ext, date) — keep last occurrence
        const seen = new Map();
        raw.forEach(a => seen.set(`${a.ext}__${a.date}`, a));
        raw = [...seen.values()];
        if (isSingleAgent) raw.sort((a, b) => a.date.localeCompare(b.date));
        else if (isMultiDate) raw.sort((a, b) => {
            const ai = activeAgentOrder.indexOf(a.ext), bi = activeAgentOrder.indexOf(b.ext);
            return ai !== bi ? ai - bi : a.date.localeCompare(b.date);
        });
        // Debug: log first agent BEFORE proc()
        if (raw.length > 0) {
            console.log('[processed] First agent BEFORE proc():', {
                name: raw[0].name,
                manCalls: raw[0].manCalls,
                manTT: raw[0].manTT,
                outCalls: raw[0].outCalls,
                outTT: raw[0].outTT
            });
        }
        // Run proc() on all rows
        let pd = raw.map(a => proc(a));
        // Debug: log first agent AFTER proc()
        if (pd.length > 0) {
            console.log('[processed] First agent AFTER proc():', {
                name: pd[0].name,
                manCalls: pd[0].manCalls,
                manTT: pd[0].manTT,
                outCalls: pd[0].outCalls,
                outTT: pd[0].outTT,
                tc: pd[0].tc
            });
        }
        const rkMap = {};
        [...pd].sort((a, b) => b.outCalls - a.outCalls).forEach((a, i) => { rkMap[`${a.ext}_${a.date}`] = i + 1; });
        pd.forEach(a => { a._rank = rkMap[`${a.ext}_${a.date}`] || 99; });
        return pd;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterFrom, filterTo, selectedAgent, uploadedAgents, activeAgentOrder, agentMappings]);

    const sortedList = useMemo(() => {
        let base = processed;
        // Apply warning filter (use composite key for multi-date scenarios)
        if (warningFilter === 'warned') {
            base = base.filter(a => {
                const warnKey = isMultiDate ? `${a.ext}_${a.date}` : a.ext;
                return warnToggle[warnKey] === 'on';
            });
        } else if (warningFilter === 'justified') {
            base = base.filter(a => {
                const warnKey = isMultiDate ? `${a.ext}_${a.date}` : a.ext;
                return warnToggle[warnKey] === 'justified';
            });
        } else if (warningFilter === 'noReview') {
            base = base.filter(a => {
                const warnKey = isMultiDate ? `${a.ext}_${a.date}` : a.ext;
                const s = warnToggle[warnKey];
                return !s || s === 'off';
            });
        } else if (warningFilter === 'clean') {
            base = base.filter(a => {
                const warnKey = isMultiDate ? `${a.ext}_${a.date}` : a.ext;
                return (warnings[a.ext] || []).length === 0 && !warnToggle[warnKey];
            });
        } else if (warningFilter === 'issues') {
            base = base.filter(a => a.isLate || a.isEarly || a.miBad || a.brkBad || a.wuBad || a.ttBad);
        }
        // Apply designation filter
        if (designationFilter) {
            base = base.filter(a => {
                const mp = agentMappings[a.ext];
                return mp && mp.designation === designationFilter;
            });
        }
        // Apply team filter
        if (teamFilter) {
            base = base.filter(a => {
                const mp = agentMappings[a.ext];
                return mp && mp.team === teamFilter;
            });
        }
        const kfn = {
            rank: x => x.outCalls, name: x => x.name.toLowerCase(),
            loginDur: x => x.ldSec, totalCalls: x => x.tc, totalTT: x => x.ttSec,
            wrapup: x => x.avgWu, autoIdle: x => toSec(x.autoIdle),
            manualIdle: x => x.miSec, breakTime: x => x.brkSec, wasteSec: x => x.wasteSec,
        };
        if (isMultiDate && !isSingleAgent && sortKey === 'name') {
            // When sorting by Agent column: group by agent, sort each group chronologically by date
            const sorted = [...base].sort((a, b) => {
                const f = kfn[sortKey] || (() => 0);
                const av = f(a), bv = f(b);
                return av < bv ? -sortDir : av > bv ? sortDir : 0;
            });
            const groups = new Map();
            sorted.forEach(a => {
                if (!groups.has(a.ext)) groups.set(a.ext, []);
                groups.get(a.ext).push(a);
            });
            const result = [];
            groups.forEach(arr => {
                arr.sort((a, b) => a.date.localeCompare(b.date));
                result.push(...arr);
            });
            return result;
        }
        return [...base].sort((a, b) => {
            const f = kfn[sortKey] || (() => 0);
            const av = f(a), bv = f(b);
            return av < bv ? -sortDir : av > bv ? sortDir : 0;
        });
    }, [processed, sortKey, sortDir, isMultiDate, isSingleAgent, warningFilter, warnings, warnToggle, designationFilter, teamFilter, agentMappings]);

    // Sequential SN: Same agent always gets same SN in multi-date; sequential in single date
    const agentSeqNum = useMemo(() => {
        const map = {};
        if (isMultiDate) {
            // In multi-date: assign SN per unique agent (same agent = same SN across all dates)
            let sn = 0;
            const agentSn = {};
            sortedList.forEach(a => {
                if (!(a.ext in agentSn)) agentSn[a.ext] = ++sn;
                map[`${a.ext}_${a.date}`] = agentSn[a.ext];
            });
        } else {
            sortedList.forEach((a, idx) => {
                map[a.ext] = idx + 1;
            });
        }
        return map;
    }, [sortedList, isMultiDate]);

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
        <div id="dialer-root" className="bg-black text-white h-full w-full flex flex-col overflow-hidden" style={{ fontSize: '11px', fontWeight: 600, fontFamily: '"Segoe UI", system-ui, sans-serif', lineHeight: 1.5 }}>
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

                /* Borders for border-separate table to match border-collapse look */
                #dialer-root tbody tr td { border-bottom: 1px solid #1a1a1a; }
                #dialer-root tbody tr:last-child td { border-bottom: none; }

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
                #dialer-root tbody tr:hover td { background: #0a0a0a; }
                #dialer-root td { padding: 8px 10px; border-right: 1px solid #1a1a1a; vertical-align: top; background: #000000; }
                #dialer-root td:last-child { border-right: none; }

                /* Sticky first 2 columns: #, Agent */
                #dialer-root .sticky-col-0 { position: sticky; left: 0; z-index: 20; }
                #dialer-root .sticky-col-1 { position: sticky; left: 40px; z-index: 20; min-width: 140px; }
                #dialer-root thead .sticky-col-0,
                #dialer-root thead .sticky-col-1 { z-index: 60; background: #ffffff !important; }
                #dialer-root tbody .sticky-col-0,
                #dialer-root tbody .sticky-col-1 { background: #000000 !important; }
                #dialer-root tbody tr:hover .sticky-col-0,
                #dialer-root tbody tr:hover .sticky-col-1 { background: #0a0a0a !important; }
                /* Cover any bleed behind sticky cols — body uses bg-matching shadow, header uses none */
                #dialer-root tbody td.sticky-col-0 { box-shadow: inset 0 0 0 9999px #000000; }
                #dialer-root tbody td.sticky-col-1 { box-shadow: inset 0 0 0 9999px #000000; }
                #dialer-root tbody tr:hover td.sticky-col-0 { box-shadow: inset 0 0 0 9999px #0a0a0a; }
                #dialer-root tbody tr:hover td.sticky-col-1 { box-shadow: inset 0 0 0 9999px #0a0a0a; }
                /* Header sticky cols: seamless — match normal th exactly, no extra outline */
                #dialer-root thead th.sticky-col-0,
                #dialer-root thead th.sticky-col-1 { box-shadow: none; }
                /* Soft fade shadow on sticky agent column right edge for smooth transition */
                #dialer-root .sticky-col-1::after {
                    content: ''; position: absolute; top: 0; right: -8px; bottom: 0; width: 8px;
                    background: linear-gradient(to right, rgba(0,0,0,0.15), transparent); pointer-events: none;
                }
                #dialer-root thead .sticky-col-1::after {
                    background: linear-gradient(to right, rgba(0,0,0,0.08), transparent);
                }
            `}</style>
            <Topbar filterFrom={filterFrom} filterTo={filterTo} selectedAgent={selectedAgent} agentCount={agentCount} isUploaded={!!uploadedAgents} onClearUpload={handleClearUpload} onOpenRules={() => setRulesOpen(true)} onOpenUpload={() => setUploadOpen(true)} onOpenHistory={() => setHistoryOpen(true)} onOpenMapping={() => setMappingModalOpen(true)} />
            <KpiRow kpis={kpis} />
            <ControlsBar agents={activeUniqueAgents} dates={activeDates} selectedAgent={selectedAgent} filterFrom={filterFrom} filterTo={filterTo}
                onAgentChange={setSelectedAgent} onFromChange={setFrom} onToChange={setTo} onBothChange={setBothDates}
                isUploaded={!!uploadedAgents} warningFilter={warningFilter} onWarningFilter={setWarningFilter} warnings={warnings} warnToggle={warnToggle}
                agentMappings={agentMappings} designationFilter={designationFilter} teamFilter={teamFilter} onDesignationFilter={setDesignationFilter} onTeamFilter={setTeamFilter} />
            <div className="flex-1 min-h-0 overflow-auto dialer-scroll-zone">
            <RulesModal show={rulesOpen} onClose={() => setRulesOpen(false)} />
            <ExcelUploadModal show={uploadOpen} onClose={() => { setUploadOpen(false); setPendingHistoryId(null); }}
                onUpload={(agents, filename, fileSize) => handleUpload(agents, filename, fileSize, pendingHistoryId)}
                uploadedAgents={uploadedAgents} uploadHistory={uploadHistory} agentMappings={agentMappings} />
            <UploadHistoryPanel show={historyOpen} onClose={() => setHistoryOpen(false)} history={uploadHistory}
                onLoad={handleHistoryLoad} onDelete={handleHistoryDelete} onUpdate={handleHistoryUpdate} />

            <WarningModal show={!!warnAgent} agent={warnAgent} warnings={warnings} onSave={updateWarnings} onClose={() => setWarnAgent(null)} />
            <AgentMappingModal show={mappingModalOpen} onClose={() => setMappingModalOpen(false)}
                agentMappings={agentMappings} uploadedAgents={uploadedAgents} onSave={loadAgentMappings} />
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
                    warnings={warnings} onWarn={setWarnAgent} warnToggle={warnToggle} warnToggleHistory={warnToggleHistory} onToggle={handleToggleWarn} agentSeqNum={agentSeqNum}
                    agentRemarks={agentRemarks} onAddRemark={handleAddRemark} onDeleteRemark={handleDeleteRemark}
                    agentMappings={agentMappings} />
            )}
            </div>{/* end scroll zone */}
        </div>
    );
}
