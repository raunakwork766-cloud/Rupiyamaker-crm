import React, { useState, useEffect, useRef, useCallback } from 'react';
import useTabWithHistory from '../hooks/useTabWithHistory';

const API_BASE_URL = '/api';
const A4_PX_W = 794;
const A4_PX_H = 1123;

function formatIndian(n) {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
}
function parseIndian(str) { return parseInt(String(str).replace(/,/g, '')) || 0; }
function numberToWords(num) {
  if (!num || num === 0) return '';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function chunk(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + chunk(n % 100) : '');
  }
  let r = '';
  if (num >= 10000000) { r += chunk(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
  if (num >= 100000)   { r += chunk(Math.floor(num / 100000))   + ' Lakh ';  num %= 100000; }
  if (num >= 1000)     { r += chunk(Math.floor(num / 1000))     + ' Thousand '; num %= 1000; }
  r += chunk(num);
  return 'Rupees ' + r.trim() + ' Only';
}
function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + d.getFullYear();
}
function titleCase(str) { return str.replace(/\b\w/g, c => c.toUpperCase()); }

const DEFAULT_TPL = {
  header_type: 'logo',
  header_logo_text: 'Fix Your Finance',
  header_image_base64: '',
  header_company_name: 'Insta Credit Solution Pvt Ltd',
  header_tagline: '',
  header_address_line1: 'Office No. 302, Third Floor, H160',
  header_address_line2: 'Sector 63, Noida - 201301',
  header_address_line3: 'Uttar Pradesh, India',
  header_website: 'www.FixYourFinance.ai',
  header_bg_color: '#000000',
  header_text_color: '#ffffff',
  content_scale: 1,
  header_logo_width: 200,
  header_logo_x: 16,
  header_logo_y: 16,
  header_addr_x: 490,
  header_addr_y: 16,
  header_name_x: 16,
  header_name_y: 85,
  header_min_height: 110,
  header_logo_height: 0,
  header_company_name_size: 12,
  header_addr_size: 11,
  header_addr_scale: 1,
  header_all_pages: true,
  footer_image_width: 140,
  footer_image_height: 38,
  footer_text_size: 10,
  watermark_type: 'text',
  watermark_text: 'CONFIDENTIAL',
  watermark_image_base64: '',
  watermark_opacity: 0.10,
  watermark_size: 88,
  footer_text: 'Fix Your Finance  Insta Credit Solution Pvt Ltd Office No. 302, Third Floor, H160, Sector 63, Noida \u2013 201301, UP',
  footer_sub_text: 'www.FixYourFinance.ai    This document is confidential and intended solely for the named recipient.',
  footer_has_image: false,
  footer_image_base64: '',
  footer_page: 'last',
  footer_img_x: 0,
  footer_img_y: 1043,
  subject_line: 'Offer of Appointment',
  greeting_intro: 'We are absolutely delighted to extend this offer to you! Following our recent discussions, we have been highly impressed by your skills, drive, and potential. We are thrilled to invite you to partner with <strong>Fix Your Finance</strong>.',
  greeting_intro2: 'Below are the details of your compensation, operational guidelines, and the terms of this professional association, thoughtfully designed to foster mutual growth, success, and long-term professional development.',
  acceptance_note: 'Replying with the above statement constitutes your <strong>legally binding acceptance</strong> under the Indian Contract Act, 1872. Please respond within <strong>48 hours</strong>.',
  consultant_sections: [
    { title: 'Professional Role &amp; Compensation Structure', clauses: [
      '<strong>Designation:</strong> You are being engaged as a {{designation}}.',
      '<strong>Fixed Compensation:</strong> You will receive a consolidated monthly compensation of <strong>INR {{salary}}/- ({{salaryWords}})</strong>.',
      '<strong>Monthly Business Target:</strong> Your assigned monthly disbursement target is <strong>INR {{target}}/-</strong>. Achieving this target every month is mandatory.',
      '<strong>Incentives &amp; Growth Bonus:</strong> Performance-based variable incentives as per the company\'s ongoing business policies.',
      '<strong>Taxation:</strong> Your compensation will be subject to applicable TDS as per Indian Income Tax regulations.',
    ]},
    { title: 'Financial Rewards &amp; Compensation Cycle', clauses: [
      '<strong>Cycle Date:</strong> Monthly compensation and incentives are credited by the 10th of every month.',
      '<strong>Incentive Discretion:</strong> Incentives are variable. Serving notice or unauthorized absence during the cycle forfeits pending incentives.',
      '<strong>Incentive Adjustments:</strong> Disputed, cancelled, or rejected cases are deducted from your targets.',
    ]},
    { title: 'Wellness &amp; Monthly Time-Off Guidelines', clauses: [
      '<strong>Authorized Time-Off:</strong> 1 authorized paid day off per month, subject to minimum 24 active days of service.',
      '<strong>Carry Forward:</strong> Unused time-off will carry forward to the next month.',
      '<strong>First Month Rule:</strong> No planned time-off permitted during the first month of engagement.',
    ]},
    { title: 'Operational Sync &amp; Floor Access', clauses: [
      '<strong>Standard Availability:</strong> 10:00 AM to 7:00 PM.',
      '<strong>Operational Access:</strong> Floor access is mandatory during operational hours.',
      '<strong>Operational Breaks:</strong> Total of 45 minutes: one 30-minute break and one 15-minute break.',
    ]},
    { title: 'Reporting &amp; Punctuality Standards', clauses: [
      '<strong>Strict Reporting Time:</strong> Report to the operational floor by <strong>10:00 AM</strong>.',
      '<strong>Operational Cut-off:</strong> Arrival after 10:15 AM will be marked as a Half-Day Absence no exceptions.',
    ], note: '<strong>The 45-Minute Buffer Privilege:</strong> Late arrivals up to 10:45 AM counted as Buffer Privilege, applicable maximum 3 times per month.'},
    { title: 'Career Progression &amp; Separation Policy', clauses: [
      '<strong>Notice Period:</strong> A mandatory 45-day notice period must be served before disengagement.',
      '<strong>FNF Settlement:</strong> Final &amp; Full Settlement processed within 60 days after your last active working day.',
      '<strong>Handover:</strong> All company assets, leads, CRM data, and No Dues Certificate must be submitted before separation.',
    ]},
    { title: 'Information Security &amp; Device Protocol (NDA)', clauses: [
      '<strong>Data Confidentiality:</strong> All customer data, leads, and internal business information are exclusive property of the company.',
      '<strong>Mobile Device Policy:</strong> Personal mobile phones are <strong>strictly prohibited</strong> on the operational floor.',
      '<strong>Data Protection:</strong> Unauthorized sharing or misuse will lead to immediate closure without FNF and criminal prosecution.',
    ]},
    { title: 'Nature of Professional Association &amp; Governing Law', clauses: [
      '<strong>Professional Retainership:</strong> This constitutes a Principal-to-Principal consulting arrangement. No employer-employee relationship is created.',
      '<strong>Governing Law:</strong> This letter is governed by the laws of India. All disputes subject to exclusive jurisdiction of courts in Noida, UP.',
      '<strong>Severability:</strong> If any clause is deemed invalid, all other clauses remain in full force.',
    ]},
  ],
  hr_sections: [
    { title: 'Professional Role &amp; Compensation Structure', clauses: [
      '<strong>Designation:</strong> You are being engaged as a {{designation}}.',
      '<strong>Fixed Compensation:</strong> You will receive a consolidated monthly compensation of <strong>INR {{salary}}/- ({{salaryWords}})</strong>.',
      '<strong>Taxation:</strong> Your compensation will be subject to applicable TDS as per Indian Income Tax regulations.',
    ]},
    { title: 'Floor Management &amp; HR Responsibilities', clauses: [
      '<strong>Attendance Management:</strong> Responsible for maintaining accurate, real-time daily and monthly attendance records for all floor staff.',
      '<strong>Payroll Coordination:</strong> Ensure timely, accurate processing of monthly salaries for all employees under your purview.',
      '<strong>Grievance Resolution:</strong> Address all employee grievances promptly, fairly, and with complete confidentiality.',
      '<strong>Onboarding:</strong> Manage end-to-end onboarding documentation and orientation programs for all new joiners.',
    ]},
    { title: 'Nature of Employment &amp; Governing Law', clauses: [
      '<strong>Employment:</strong> Formal appointment under Insta Credit Solution Pvt Ltd.',
      '<strong>Governing Law:</strong> Jurisdiction  Noida (Gautam Buddha Nagar), Uttar Pradesh.',
      '<strong>Severability:</strong> Invalid clause does not affect remaining provisions.',
    ]},
  ],
};

const iStyle = {
  width:'100%', padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:7,
  fontFamily:'Inter,sans-serif', fontSize:'.85rem', color:'#1a202c', background:'#f8fafc',
  outline:'none', boxSizing:'border-box',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:11 }}>
      {label && <div style={{ fontSize:'.63rem', fontWeight:700, color:'#1a202c', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4, fontFamily:'Poppins,sans-serif' }}>{label}</div>}
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
      <span style={{ fontSize:'.76rem', color:'#4a5568', fontWeight:600 }}>{label}</span>
      <div onClick={() => onChange(!checked)} style={{ position:'relative', width:36, height:20, cursor:'pointer' }}>
        <div style={{ position:'absolute', inset:0, borderRadius:20, background: checked ? '#0099cc' : '#cbd5e1', transition:'background .2s' }} />
        <div style={{ position:'absolute', width:14, height:14, borderRadius:'50%', background:'#fff', top:3, left: checked ? 19 : 3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:'5px 11px', borderRadius:20, border:'1.5px solid', fontSize:'.7rem', fontWeight:700, cursor:'pointer',
      fontFamily:'Poppins,sans-serif',
      borderColor: active ? '#0099cc' : '#e2e8f0',
      background: active ? 'rgba(0,153,204,.1)' : '#f8fafc',
      color: active ? '#0099cc' : '#64748b',
    }}>{children}</button>
  );
}

function ImageUploader({ value, onChange, label, hint }) {
  return (
    <Field label={label}>
      <div style={{ border:'2px dashed #cbd5e1', borderRadius:8, padding:12, textAlign:'center', position:'relative', background:'#f8fafc', cursor:'pointer' }}>
        <input type="file" accept="image/*" style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}
          onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = new FileReader(); r.onload = ev => onChange(ev.target.result); r.readAsDataURL(f);
          }} />
        {value ? <img src={value} alt="" style={{ maxWidth:'100%', maxHeight:60, objectFit:'contain', borderRadius:4, display:'block', margin:'0 auto' }} />
               : <span style={{ fontSize:'.72rem', color:'#94a3b8' }}>{hint || 'Click to upload'}</span>}
      </div>
      {value && <button onClick={() => onChange('')} style={{ marginTop:3, fontSize:'.68rem', color:'#dc2626', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>✕ Remove</button>}
    </Field>
  );
}

// Floating inline toolbar (appears when text is selected inside contentEditable)
function InlineToolbar() {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPos(null); return; }
      const range = sel.getRangeAt(0);
      // Only show if inside an olg-editable node
      const container = range.commonAncestorContainer;
      let node = container.nodeType === 3 ? container.parentNode : container;
      let inEditable = false;
      while (node) { if (node.dataset && node.dataset.olgEditable) { inEditable = true; break; } node = node.parentNode; }
      if (!inEditable) { setPos(null); return; }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0) { setPos(null); return; }
      setPos({ top: rect.top + window.scrollY - 46, left: Math.max(50, rect.left + window.scrollX + rect.width / 2) });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);
  const exec = cmd => { document.execCommand(cmd, false, null); };
  if (!pos) return null;
  return (
    <div style={{
      position:'absolute', top:pos.top, left:pos.left, transform:'translateX(-50%)',
      background:'#1a202c', borderRadius:8, padding:'4px 6px', display:'flex', gap:3,
      boxShadow:'0 4px 20px rgba(0,0,0,.45)', zIndex:99999, pointerEvents:'auto',
    }}>
      {[['B','bold'],['I','italic'],['U','underline']].map(([sym,cmd]) => (
        <button key={cmd} onMouseDown={e => { e.preventDefault(); exec(cmd); }}
          style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', padding:'2px 7px', borderRadius:4, fontWeight:700, fontSize:'.82rem', fontFamily:'Inter,sans-serif' }}>{sym}</button>
      ))}
      <div style={{ width:1, background:'#4a5568', margin:'2px 2px' }} />
      <button onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }}
        style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:'2px 6px', borderRadius:4, fontSize:'.75rem' }}>✕</button>
    </div>
  );
}

// Main component
const OfferLetterGenerator = ({ user }) => {
  const [activeTab, setActiveTab] = useTabWithHistory('tab', 'details');
  const [letterType, setLetterType] = useState('consultant');
  const [candidateName, setCandidateName] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [designation, setDesignation] = useState('Financial Consultant');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [acceptanceCopied, setAcceptanceCopied] = useState(false);
  const [tpl, setTpl] = useState(DEFAULT_TPL);
  const [saveStatus, setSaveStatus] = useState('');
  const [editingSec, setEditingSec] = useState(null);
  const [pageGroups, setPageGroups] = useState(null); // null = not yet measured; array of arrays of section indices
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(85);
  const [isEditMode, setIsEditMode] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [empDropOpen, setEmpDropOpen] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);
  const importTplRef = useRef(null);

  const pageRefs = useRef([]); // array of A4 page DOM refs
  const measureRef = useRef(null);
  const userId = user?._id || user?.id || '';

  useEffect(() => {
    if (!userId) return;
    fetch(API_BASE_URL + '/settings/offer-letter-template?user_id=' + userId)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTpl(p => ({ ...DEFAULT_TPL, ...d })); })
      .catch(() => {});
  }, [userId]);

  // Fetch employees for autofill
  useEffect(() => {
    if (!userId) return;
    setEmpLoading(true);
    fetch(API_BASE_URL + '/users?user_id=' + userId)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.users || data?.data || []);
        setEmployees(list);
      })
      .catch(() => {})
      .finally(() => setEmpLoading(false));
  }, [userId]);

  const handleSaveTemplate = useCallback(async () => {
    if (!userId) return;
    setSaveStatus('');
    try {
      const r = await fetch(API_BASE_URL + '/settings/offer-letter-template?user_id=' + userId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tpl),
      });
      setSaveStatus(r.ok ? 'saved' : 'error');
    } catch { setSaveStatus('error'); }
    setTimeout(() => setSaveStatus(''), 3500);
  }, [tpl, userId]);

  const exportTemplate = useCallback(() => {
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'offer-letter-template.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 100);
  }, [tpl]);

  const importTemplate = useCallback((e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        setTpl(p => ({ ...DEFAULT_TPL, ...d }));
      } catch { alert('Invalid template file. Please use a valid .json template.'); }
    };
    r.readAsText(f);
    e.target.value = '';
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const onMove = e => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      setTpl(p => ({
        ...p,
        [dragState.xKey]: Math.max(0, dragState.origX + dx),
        [dragState.yKey]: Math.max(0, dragState.origY + dy),
      }));
    };
    const onUp = () => setDragState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragState]);

  useEffect(() => {
    if (!resizeState) return;
    const onMove = e => {
      const dw = e.clientX - resizeState.startX;
      const dh = e.clientY - resizeState.startY;
      if (resizeState.type === 'logo') {
        setTpl(p => ({
          ...p,
          header_logo_width: Math.max(40, resizeState.origW + dw),
          header_logo_height: resizeState.origH > 0 ? Math.max(20, resizeState.origH + dh) : 0,
        }));
      } else if (resizeState.type === 'header') {
        setTpl(p => ({ ...p, header_min_height: Math.max(60, resizeState.origH + dh) }));
      } else if (resizeState.type === 'addr') {
        const ns = Math.max(0.5, Math.min(3, resizeState.origScale + dw / 120));
        setTpl(p => ({ ...p, header_addr_scale: parseFloat(ns.toFixed(2)) }));
      }
    };
    const onUp = () => setResizeState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizeState]);

  const salaryRaw = parseIndian(monthlySalary);
  const formattedSalary = salaryRaw > 0 ? formatIndian(salaryRaw) : '\u2014';
  const salaryWords = salaryRaw > 0 ? numberToWords(salaryRaw) : '\u2014';
  const targetRaw = parseIndian(monthlyTarget);
  const formattedTarget = targetRaw > 0 ? formatIndian(targetRaw) : '\u2014';

  // Autofill all fields from a selected employee record
  const autofillFromEmployee = useCallback((emp) => {
    const fn = (emp.first_name || '').trim();
    const ln = (emp.last_name || '').trim();
    const fullName = titleCase([fn, ln].filter(Boolean).join(' '));
    if (fullName) setCandidateName(fullName);
    if (emp.salary) setMonthlySalary(formatIndian(Math.round(emp.salary)));
    if (emp.monthly_target) setMonthlyTarget(formatIndian(Math.round(emp.monthly_target)));
    if (emp.joining_date) {
      const d = emp.joining_date;
      const dateStr = typeof d === 'string' ? d.slice(0, 10) : '';
      if (dateStr) setJoiningDate(dateStr);
    }
    if (emp.designation) {
      const des = emp.designation.trim();
      setDesignation(des);
      if (des.toLowerCase().includes('hr') || des.toLowerCase().includes('human')) {
        setLetterType('hr');
      } else {
        setLetterType('consultant');
      }
    }
    setEmpSearch('');
    setEmpDropOpen(false);
  }, []);

  // Filtered employee list for dropdown
  const filteredEmps = empSearch.trim().length > 0
    ? employees.filter(e => {
        const name = ((e.first_name || '') + ' ' + (e.last_name || '')).toLowerCase();
        const eid = String(e.employee_id || '').toLowerCase();
        const q = empSearch.toLowerCase();
        return name.includes(q) || eid.includes(q);
      }).slice(0, 10)
    : [];
  const formattedDate = formatDate(joiningDate);
  const displayName = candidateName.trim() || 'Candidate Name';
  const currentDesignation = letterType === 'hr' ? 'Human Resources' : designation;
  const activeSections = letterType === 'hr'
    ? (tpl.hr_sections || DEFAULT_TPL.hr_sections)
    : (tpl.consultant_sections || DEFAULT_TPL.consultant_sections);

  const renderClause = cl => cl
    .replace(/\{\{designation\}\}/g, '<span style="color:#1a5ba8;font-weight:700">' + currentDesignation + '</span>')
    .replace(/\{\{salary\}\}/g, '<span style="color:#1a5ba8;font-weight:700">' + formattedSalary + '</span>')
    .replace(/\{\{salaryWords\}\}/g, '<span style="color:#1a5ba8;font-weight:700">' + salaryWords + '</span>')
    .replace(/\{\{target\}\}/g, '<span style="color:#1a5ba8;font-weight:700">' + formattedTarget + '</span>');

  // Measure to find page breaks — supports N pages
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const hdrEl = el.querySelector('.m-hdr');
    const introEl = el.querySelector('.m-intro');
    const acceptEl = el.querySelector('.m-accept');
    const headerH = hdrEl ? hdrEl.offsetHeight : 120;
    const introH = introEl ? introEl.offsetHeight : 100;
    const acceptH = acceptEl ? acceptEl.offsetHeight : 200;
    const scale = tpl.content_scale || 1;
    const ftrReserve = (tpl.footer_text || tpl.footer_sub_text) ? 62 : 16;
    // Header height for subsequent pages (if shown on all pages)
    const subHdrH = (tpl.header_all_pages !== false) ? headerH + 5 : 0;
    // Available logical height — acceptance block is ONLY on the last page.
    // ftrReserve is placed in the NUMERATOR (physical pixels) so it doesn't scale up
    // with content_scale — prevents body from physically overflowing into footer zone.
    // BODY_PAD uses a small fixed bottom pad (8px) just for cosmetic spacing.
    const SAFETY = 24;
    const avPage1 = (A4_PX_H - headerH - ftrReserve - 5) / scale - 18 - introH - SAFETY;
    const avPageN = (A4_PX_H - subHdrH - ftrReserve) / scale - 38 - SAFETY;
    const secEls = el.querySelectorAll('.m-sec');
    const nSec = secEls.length;
    const secHeights = Array.from(secEls).map(e => e.offsetHeight + 14);
    // Greedy packing (no acceptance reservation yet)
    const groups = [];
    let curGroup = [];
    let acc = 0;
    let avail = Math.max(80, avPage1);
    for (let i = 0; i < nSec; i++) {
      const h = secHeights[i];
      if (curGroup.length > 0 && acc + h > avail) {
        groups.push(curGroup);
        curGroup = [i];
        acc = h;
        avail = Math.max(80, avPageN);
      } else {
        curGroup.push(i);
        acc += h;
      }
    }
    groups.push(curGroup);
    // Ensure last page has room for acceptance block — spill overflow to a new page
    const lastAvail = groups.length === 1 ? Math.max(80, avPage1) : Math.max(80, avPageN);
    const lastSpillAt = lastAvail - acceptH;
    if (lastSpillAt > 0) {
      const lastGrp = groups[groups.length - 1];
      let runAcc = 0, splitAt = lastGrp.length;
      for (let i = 0; i < lastGrp.length; i++) {
        if (runAcc + secHeights[lastGrp[i]] > lastSpillAt) { splitAt = i; break; }
        runAcc += secHeights[lastGrp[i]];
      }
      if (splitAt > 0 && splitAt < lastGrp.length) {
        groups.push(lastGrp.splice(splitAt));
      }
    }
    // Post-process: don't strand a heading at the start of a page — move it back to previous page
    for (let g = groups.length - 1; g > 0; g--) {
      if (groups[g].length > 0 && activeSections[groups[g][0]].type === 'heading') {
        groups[g - 1].push(groups[g].shift());
        if (groups[g].length === 0) groups.splice(g, 1);
      }
    }
    const flat = JSON.stringify(groups);
    setPageGroups(prev => JSON.stringify(prev) !== flat ? groups : prev);
  });

  // Derive page groups — fallback: all sections on one page until measured
  const groups = pageGroups || [activeSections.map((_, i) => i)];
  const totalPages = groups.length;

  const set = (k, v) => setTpl(p => ({ ...p, [k]: v }));

  const updateSection = (si, key, val) => {
    const k = letterType === 'hr' ? 'hr_sections' : 'consultant_sections';
    const secs = [...(tpl[k] || [])];
    secs[si] = { ...secs[si], [key]: val };
    setTpl(p => ({ ...p, [k]: secs }));
  };

  const deleteSection = (si) => {
    const k = letterType === 'hr' ? 'hr_sections' : 'consultant_sections';
    const secs = [...(tpl[k] || [])];
    secs.splice(si, 1);
    setEditingSec(null);
    setPageGroups(null); // reset stale index groups — will recalculate on next render
    setTpl(p => ({ ...p, [k]: secs }));
  };

  const addSection = () => {
    const k = letterType === 'hr' ? 'hr_sections' : 'consultant_sections';
    const secs = [...(tpl[k] || [])];
    secs.push({ title: 'New Section', clauses: ['<strong>New point:</strong> Edit this clause.'] });
    setPageGroups(null);
    setTpl(p => ({ ...p, [k]: secs }));
    setEditingSec(secs.length - 1);
  };

  const addHeading = () => {
    const k = letterType === 'hr' ? 'hr_sections' : 'consultant_sections';
    const secs = [...(tpl[k] || [])];
    secs.push({ type: 'heading', title: 'New Heading' });
    setPageGroups(null);
    setTpl(p => ({ ...p, [k]: secs }));
    setEditingSec(secs.length - 1);
  };

  // Generic drag starter – reused by header elements AND footer image
  const startDrag = (xKey, yKey, origX, origY) => e => {
    if (!isEditMode) return;
    e.preventDefault(); e.stopPropagation();
    setDragState({ startX: e.clientX, startY: e.clientY, xKey, yKey, origX, origY });
  };

  // Header (logo + address both draggable & resizable on A4 preview)
  const renderHeader = () => {
    const bg = tpl.header_bg_color || '#000';
    const tc = tpl.header_text_color || '#fff';
    const lx = tpl.header_logo_x ?? 16;
    const ly = tpl.header_logo_y ?? 16;
    const ax = tpl.header_addr_x ?? 490;
    const ay = tpl.header_addr_y ?? 16;
    const nx = tpl.header_name_x ?? 16;
    const ny = tpl.header_name_y ?? 85;
    const logoW = tpl.header_logo_width || 200;
    const logoH = tpl.header_logo_height > 0 ? tpl.header_logo_height : 'auto';
    const hdrH = tpl.header_min_height || 110;
    const cnSize = tpl.header_company_name_size || 12;
    const addrSize = tpl.header_addr_size || 11;
    const addrScale = tpl.header_addr_scale || 1;

    const startLogoResize = e => {
      if (!isEditMode) return;
      e.preventDefault(); e.stopPropagation();
      setResizeState({ type:'logo', startX:e.clientX, startY:e.clientY, origW:logoW, origH: tpl.header_logo_height || 0 });
    };
    const startAddrResize = e => {
      if (!isEditMode) return;
      e.preventDefault(); e.stopPropagation();
      setResizeState({ type:'addr', startX:e.clientX, startY:e.clientY, origScale: addrScale });
    };
    const startHdrResize = e => {
      if (!isEditMode) return;
      e.preventDefault(); e.stopPropagation();
      setResizeState({ type:'header', startX:e.clientX, startY:e.clientY, origH: hdrH });
    };

    const CORNER = { position:'absolute', bottom:-5, right:-5, width:14, height:14, background:'#0099cc', borderRadius:2, cursor:'se-resize', zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,.4)' };
    const DRAG_BADGE = { position:'absolute', top:0, right:0, background:'rgba(0,153,204,0.85)', borderRadius:'0 2px 0 4px', padding:'2px 4px', pointerEvents:'none', display:'flex', alignItems:'center' };

    let logoContent;
    if (tpl.header_type === 'image' && tpl.header_image_base64) {
      logoContent = (
        <>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2 }}>
            <img src={tpl.header_image_base64} alt="logo" style={{ width:logoW, height:logoH, objectFit:'contain', display:'block', userSelect:'none', pointerEvents:'none' }} />
          </div>
          {/* Corner resize handle — drag to resize image */}
          <div data-pdf-hide="1" className="olg-drag-handle" style={CORNER} onMouseDown={startLogoResize} title="Drag to resize logo" />
        </>
      );
    } else if (tpl.header_type === 'text') {
      logoContent = (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
          <div style={{ fontFamily:"'Arial Black',Arial,sans-serif", fontSize:32, fontWeight:900, color:tc, lineHeight:1 }}>{tpl.header_logo_text || 'Company'}</div>
          {tpl.header_tagline && <div style={{ fontSize:'.7rem', color:tc+'99', fontStyle:'italic', marginTop:2 }}>{tpl.header_tagline}</div>}
        </div>
      );
    } else {
      const parts = (tpl.header_logo_text || 'Fix Your Finance').split(' ');
      const p1 = parts[0] || 'Fix', p2 = parts[1] || 'Your', p3 = parts.slice(2).join(' ') || 'Finance';
      logoContent = (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4 }}>
          <div style={{ display:'flex', alignItems:'stretch', gap:12 }}>
            <span style={{ fontFamily:"'Arial Black',Arial,sans-serif", fontSize:62, fontWeight:900, color:tc, lineHeight:1, letterSpacing:-2 }}>{p1}</span>
            <span style={{ width:4, background:'#cc1818', borderRadius:3, flexShrink:0, alignSelf:'stretch' }} />
            <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:1 }}>
              <span style={{ fontFamily:'Arial,Helvetica,sans-serif', fontSize:14, fontWeight:700, letterSpacing:5, color:'#00bfff', textTransform:'uppercase' }}>{p2}</span>
              <span style={{ fontFamily:"'Arial Black',Arial,sans-serif", fontSize:32, fontWeight:900, color:'#00bfff', letterSpacing:-1, lineHeight:1 }}>{p3}</span>
            </div>
          </div>
          {tpl.header_tagline && <div style={{ fontSize:'.7rem', color:tc+'99', fontStyle:'italic', marginTop:1 }}>{tpl.header_tagline}</div>}
        </div>
      );
    }

    const addrContent = (
      <div style={{ textAlign:'right', fontFamily:'Arial,sans-serif', transformOrigin:'top right', transform:`scale(${addrScale})` }}>
        {/* Label row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, marginBottom:5 }}>
          <div style={{ height:1, width:28, background:'#cc1818', opacity:0.8 }} />
          <span style={{ fontSize:addrSize - 1, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:'#cc1818' }}>Registered Office</span>
        </div>
        {/* Address lines */}
        <div style={{ fontSize:addrSize, lineHeight:1.7, color:'#ffffff' }}>
          {tpl.header_address_line1 && (
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'flex-end', gap:5 }}>
              <span style={{ fontSize:addrSize - 1, opacity:0.5 }}>&#9679;</span>
              <span>{tpl.header_address_line1}</span>
            </div>
          )}
          {tpl.header_address_line2 && (
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'flex-end', gap:5 }}>
              <span style={{ fontSize:addrSize - 1, opacity:0.5 }}>&#9679;</span>
              <span>{tpl.header_address_line2}</span>
            </div>
          )}
          {tpl.header_address_line3 && (
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'flex-end', gap:5 }}>
              <span style={{ fontSize:addrSize - 1, opacity:0.5 }}>&#9679;</span>
              <span>{tpl.header_address_line3}</span>
            </div>
          )}
        </div>
        {/* Website */}
        {tpl.header_website && (
          <div style={{ marginTop:5, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:5 }}>
            <div style={{ height:1, flex:1, maxWidth:48, background:'rgba(77,201,230,0.35)' }} />
            <span style={{ fontSize:addrSize - 0.5, color:'#4dc9e6', fontWeight:700, letterSpacing:'0.04em' }}>&#127760; {tpl.header_website}</span>
          </div>
        )}
      </div>
    );

    return (
      <div style={{ background:bg, position:'relative', minHeight:hdrH, overflow:'visible' }}>
        {/* Logo/Brand — drag to move, corner to resize */}
        <div
          style={{ position:'absolute', left:lx, top:ly, cursor: dragState?.xKey==='header_logo_x' ? 'grabbing' : 'grab', userSelect:'none', zIndex:2 }}
          onMouseDown={startDrag('header_logo_x', 'header_logo_y', lx, ly)}
        >
          {logoContent}
          <div className="olg-drag-handle" style={DRAG_BADGE}>
            <span style={{ color:'#ffffff', fontSize:8, lineHeight:1 }}>&#x2630;</span>
          </div>
        </div>
        {/* Address block — drag to move, corner to scale */}
        <div
          style={{ position:'absolute', left:ax, top:ay, cursor: dragState?.xKey==='header_addr_x' ? 'grabbing' : 'grab', userSelect:'none', zIndex:2 }}
          onMouseDown={startDrag('header_addr_x', 'header_addr_y', ax, ay)}
        >
          {addrContent}
          <div className="olg-drag-handle" style={DRAG_BADGE}>
            <span style={{ color:'#ffffff', fontSize:8, lineHeight:1 }}>&#x2630;</span>
          </div>
          {/* Corner scale handle */}
          <div data-pdf-hide="1" className="olg-drag-handle" style={{ ...CORNER, cursor:'ew-resize', background:'#059669' }} onMouseDown={startAddrResize} title="Drag to scale address" />
        </div>
        {/* Legal Name — separate draggable block */}
        {tpl.header_company_name && (
          <div
            style={{ position:'absolute', left:nx, top:ny, cursor: dragState?.xKey==='header_name_x' ? 'grabbing' : 'grab', userSelect:'none', zIndex:3, whiteSpace:'nowrap' }}
            onMouseDown={startDrag('header_name_x', 'header_name_y', nx, ny)}
          >
            <div style={{ fontSize:cnSize, fontWeight:700, color:tc+'dd', fontFamily:'Arial,sans-serif' }}>{tpl.header_company_name}</div>
            <div className="olg-drag-handle" style={{ ...DRAG_BADGE, background:'rgba(204,24,24,0.85)', top:0, right:0 }}>
              <span style={{ color:'#fff', fontSize:8, lineHeight:1 }}>&#x2630;</span>
            </div>
          </div>
        )}
        {/* Header height resize — bottom edge */}
        <div
          className="olg-drag-handle"
          style={{ position:'absolute', bottom:0, left:0, right:0, height:8, cursor:'ns-resize', background:'rgba(0,153,204,0.25)', zIndex:5, display:'flex', alignItems:'center', justifyContent:'center' }}
          onMouseDown={startHdrResize}
          title="Drag to change header height"
        >
          <span style={{ color:'rgb(255, 255, 255)', fontSize:9, userSelect:'none', letterSpacing:3 }}>&#9473;&#9473;&#9473;</span>
        </div>
      </div>
    );
  };

  const brandStrip = <div style={{ height:5, background:'linear-gradient(90deg,#0a1c3e 0%,#cc1818 40%,#0099cc 100%)' }} />;

  const renderWatermark = () => {
    const op = tpl.watermark_opacity || 0.1;
    if (tpl.watermark_type === 'none') return null;
    if (tpl.watermark_type === 'image' && tpl.watermark_image_base64) {
      const imgSz = (tpl.watermark_size || 88) + '%';
      return (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
          <img src={tpl.watermark_image_base64} alt="" style={{ opacity:op, width:imgSz, maxWidth:imgSz, maxHeight:imgSz, objectFit:'contain', transform:'rotate(-28deg)' }} />
        </div>
      );
    }
    if (tpl.watermark_type === 'text' && tpl.watermark_text) {
      const lines = tpl.watermark_text.split('\n').filter(l => l.trim());
      const fontSize = tpl.watermark_size || Math.max(32, 88 - (lines.length - 1) * 20);
      return (
        <div style={{
          position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-28deg)',
          pointerEvents:'none', userSelect:'none', zIndex:0,
          display:'flex', flexDirection:'column', alignItems:'center', gap:6,
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{
              fontSize, fontWeight:900, color:'rgba(10,28,62,' + op + ')',
              fontFamily:"'Arial Black',Arial,sans-serif", letterSpacing:8, whiteSpace:'nowrap',
            }}>{line}</div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderFooter = () => {
    const ftSize = tpl.footer_text_size || 10;
    const fiW = tpl.footer_image_width || 140;
    const fiH = tpl.footer_image_height || 38;
    const fix = tpl.footer_img_x ?? 0;
    const fiy = tpl.footer_img_y ?? 1043;
    return (
      <>
        {tpl.footer_has_image && tpl.footer_image_base64 && (
          // Absolutely positioned on the A4 page – drag anywhere, full-width supported
          <div
            style={{ position:'absolute', left:fix, top:fiy, width:fiW, height:fiH, zIndex:5, cursor:'grab', userSelect:'none' }}
            onMouseDown={startDrag('footer_img_x', 'footer_img_y', fix, fiy)}
          >
            <img src={tpl.footer_image_base64} alt="" style={{ width:'100%', height:'100%', objectFit:'fill', display:'block', pointerEvents:'none' }} />
            <div className="olg-drag-handle" data-pdf-hide="1" style={{ position:'absolute', top:2, left:2, background:'rgba(0,153,204,0.85)', color:'#fff', fontSize:'.52rem', fontWeight:700, padding:'1px 5px', borderRadius:3, whiteSpace:'nowrap', pointerEvents:'none' }}>⠿ drag</div>
          </div>
        )}
        {(tpl.footer_text || tpl.footer_sub_text) && (
          // Absolutely anchored to page bottom — always visible, never pushed off by body content
          <div style={{ position:'absolute', bottom:0, left:0, right:0, borderTop:'1.5px solid #e2e8f0', padding:'8px 36px 14px', textAlign:'center', color:'#718096', lineHeight:1.65, fontFamily:'Inter,sans-serif', background:'#fff', zIndex:4 }}>
            {tpl.footer_text && <strong style={{ color:'#4a5568', fontSize:ftSize, display:'block', lineHeight:1.6 }}>{tpl.footer_text}</strong>}
            {tpl.footer_sub_text && <span style={{ fontSize:ftSize - 1, display:'block', lineHeight:1.6 }}>{tpl.footer_sub_text}</span>}
          </div>
        )}
      </>
    );
  };

  // Inline editable section on page
  const SectionBlock = ({ sec, si }) => {
    const editing = isEditMode && editingSec === si;
    const titleRef = useRef(null);
    const clauseRefs = useRef([]);
    const noteRef = useRef(null);

    useEffect(() => {
      if (titleRef.current && document.activeElement !== titleRef.current)
        titleRef.current.innerHTML = sec.title;
    }, [sec.title]);
    useEffect(() => {
      if (!sec.clauses) return;
      sec.clauses.forEach((cl, ci) => {
        if (clauseRefs.current[ci] && document.activeElement !== clauseRefs.current[ci])
          clauseRefs.current[ci].innerHTML = renderClause(cl);
      });
    }, [sec.clauses, formattedSalary, salaryWords, formattedTarget, currentDesignation]);
    useEffect(() => {
      if (sec.note && noteRef.current && document.activeElement !== noteRef.current)
        noteRef.current.innerHTML = sec.note;
    }, [sec.note]);

    const commitTitle = () => { if (titleRef.current) updateSection(si, 'title', titleRef.current.innerHTML); };
    const commitClause = ci => {
      if (!clauseRefs.current[ci]) return;
      const next = [...sec.clauses]; next[ci] = clauseRefs.current[ci].innerHTML; updateSection(si, 'clauses', next);
    };
    const commitNote = () => { if (noteRef.current) updateSection(si, 'note', noteRef.current.innerHTML); };

    // ── Heading type: standalone bold divider heading ──
    if (sec.type === 'heading') {
      return (
        <div style={{ marginBottom:10, marginTop:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, height:1.5, background:'linear-gradient(90deg,transparent,#0a1c3e44)' }} />
            <span
              ref={titleRef}
              contentEditable={editing}
              suppressContentEditableWarning
              data-olg-editable="1"
              onBlur={commitTitle}
              style={{
                fontFamily:'Poppins,sans-serif', fontSize:'.91rem', fontWeight:800, color:'#0a1c3e',
                textAlign:'center', letterSpacing:'.04em', textTransform:'uppercase',
                outline: editing ? '2px dashed #0099cc' : 'none',
                borderRadius:4, padding: editing ? '2px 8px' : '2px 6px',
                background: editing ? '#f0f9ff' : 'transparent',
                cursor: editing ? 'text' : 'default', whiteSpace:'nowrap',
              }}
            />
            <div style={{ flex:1, height:1.5, background:'linear-gradient(90deg,#0a1c3e44,transparent)' }} />
            {isEditMode && (
              <>
                <button onClick={() => setEditingSec(editing ? null : si)} style={{
                  background: editing ? '#f0fdf4' : '#fef9ec', border:'1px solid ' + (editing ? '#86efac' : '#fde68a'),
                  borderRadius:5, padding:'2px 8px', fontSize:'.6rem', color: editing ? '#15803d' : '#92400e',
                  cursor:'pointer', fontWeight:700, flexShrink:0,
                }}>{editing ? 'Done ✓' : 'Edit'}</button>
                <button
                  onClick={() => { if (window.confirm('Delete this heading?')) deleteSection(si); }}
                  title="Delete heading"
                  style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:5, padding:'2px 7px', fontSize:'.6rem', color:'#dc2626', cursor:'pointer', fontWeight:800, flexShrink:0 }}
                >🗑</button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={{ marginBottom:13 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7, paddingBottom:4, borderBottom:'2px solid #e2e8f4' }}>
          <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, background:'#0099cc', color:'#fff', borderRadius:6, fontSize:'.65rem', fontWeight:800, flexShrink:0, fontFamily:'Poppins,sans-serif' }}>{si+1}</span>
          <span
            ref={titleRef}
            contentEditable={editing}
            suppressContentEditableWarning
            data-olg-editable="1"
            onBlur={commitTitle}
            style={{ fontFamily:'Poppins,sans-serif', fontSize:'.88rem', fontWeight:700, color:'#0a1c3e', outline: editing ? '1.5px dashed #0099cc' : 'none', borderRadius:3, padding: editing ? '1px 3px' : 0, flex:1, cursor: editing ? 'text' : 'default', minWidth:20 }}
          />
          {isEditMode && (
            <>
              <button onClick={() => setEditingSec(editing ? null : si)} style={{
                background: editing ? '#f0fdf4' : '#f0f9ff', border:'1px solid ' + (editing ? '#86efac' : '#bae6fd'),
                borderRadius:5, padding:'2px 8px', fontSize:'.6rem', color: editing ? '#15803d' : '#0369a1',
                cursor:'pointer', fontWeight:700, flexShrink:0,
              }}>{editing ? 'Done ✓' : 'Edit'}</button>
              <button
                onClick={() => { if (window.confirm('Delete this entire section?')) deleteSection(si); }}
                title="Delete section"
                style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:5, padding:'2px 7px', fontSize:'.6rem', color:'#dc2626', cursor:'pointer', fontWeight:800, flexShrink:0 }}
              >🗑 Del</button>
            </>
          )}
        </div>
        <ul style={{ paddingLeft:0, margin:0, listStyle:'none' }}>
          {(sec.clauses || []).map((cl, ci) => (
            <li key={ci} style={{ display:'flex', alignItems:'flex-start', gap:6, fontSize:'.81rem', lineHeight:1.7, color:'#111827', marginBottom:7, textAlign:'justify', fontWeight:500 }}>
              <span style={{ flexShrink:0, fontWeight:700, color:'#0099cc', fontSize:'.81rem', fontFamily:'Poppins,sans-serif', marginTop:1, minWidth:18 }}>{String.fromCharCode(97+ci)}.</span>
              <span
                ref={el => clauseRefs.current[ci] = el}
                contentEditable={editing}
                suppressContentEditableWarning
                data-olg-editable="1"
                onBlur={() => commitClause(ci)}
                style={{ outline: editing ? '1px dashed #e2e8f0' : 'none', borderRadius:2, flex:1, cursor: editing ? 'text' : 'default', wordBreak:'break-word' }}
              />
              {editing && sec.clauses.length > 1 && (
                <button
                  onClick={() => { const next = sec.clauses.filter((_, j) => j !== ci); updateSection(si, 'clauses', next); }}
                  title="Delete this clause"
                  style={{ flexShrink:0, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:4, width:18, height:18, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:'.6rem', color:'#dc2626', fontWeight:800, lineHeight:1, padding:0, marginTop:3 }}
                >✕</button>
              )}
            </li>
          ))}
        </ul>
        {editing && (
          <button onClick={() => updateSection(si, 'clauses', [...sec.clauses, '<strong>New point:</strong> Edit this clause.'])}
            style={{ marginTop:4, background:'#f0f9ff', border:'1.5px dashed #7dd3fc', borderRadius:5, padding:'3px 9px', fontSize:'.68rem', color:'#0369a1', cursor:'pointer', fontWeight:700 }}>
            + Add Clause
          </button>
        )}
        {sec.note && (
          <div style={{ background:'rgba(0,153,204,.06)', borderLeft:'3px solid #0099cc', padding:'7px 11px', borderRadius:'0 5px 5px 0', margin:'5px 0', fontSize:'.79rem', color:'#111827', fontWeight:500 }}>
            <span
              ref={noteRef}
              contentEditable={editing}
              suppressContentEditableWarning
              data-olg-editable="1"
              onBlur={commitNote}
              style={{ outline: editing ? '1px dashed #0099cc' : 'none', borderRadius:2, display:'inline' }}
            />
          </div>
        )}
      </div>
    );
  };

  const copyAcceptanceText = () => {
    const text = `I, ${displayName}, accept the Offer of Appointment for the role of ${currentDesignation} at Fix Your Finance (Insta Credit Solution Pvt Ltd), dated ${formattedDate}. I have read and agree to all terms and conditions.`;
    const doSet = () => { setAcceptanceCopied(true); setTimeout(() => setAcceptanceCopied(false), 2500); };
    navigator.clipboard ? navigator.clipboard.writeText(text).then(doSet).catch(doSet) : (() => {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      Object.assign(ta.style, { position:'fixed', opacity:'0' });
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta); doSet();
    })();
  };

  const acceptanceBlock = (
    <div style={{ marginTop:20, paddingTop:14, borderTop:'2px solid #0a1c3e', position:'relative', zIndex:1 }}>
      <div style={{ fontFamily:'Poppins,sans-serif', fontSize:'.88rem', fontWeight:700, color:'#0a1c3e', marginBottom:10, textAlign:'center' }}>Acceptance of Offer</div>
      <div style={{ padding:'12px 15px', background:'#f0f5ff', border:'1.5px solid #b8cfe8', borderRadius:8 }}>
        <div style={{ fontFamily:'Poppins,sans-serif', fontSize:'.8rem', fontWeight:700, color:'#0a1c3e', marginBottom:7, display:'flex', alignItems:'center', gap:5, borderBottom:'1px dashed #c5d5ea', paddingBottom:6 }}>
           Reply to confirm your acceptance:
        </div>
        <div style={{ fontSize:'.76rem', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:5 }}>Copy &amp; reply via email</div>
        <div style={{ fontSize:'.8rem', color:'#162240', background:'#fff', borderLeft:'3px solid #0099cc', padding:'9px 13px', borderRadius:'0 6px 6px 0', lineHeight:1.75, fontWeight:500, fontFamily:'Inter,sans-serif' }}>
          I, <span style={{ color:'#0099cc', fontWeight:700 }}>{displayName}</span>, accept the Offer of Appointment for the role of{' '}
          <span style={{ color:'#cc1818', fontWeight:700 }}>{currentDesignation}</span> at Fix Your Finance (Insta Credit Solution Pvt Ltd), dated{' '}
          <span style={{ color:'#0099cc', fontWeight:700 }}>{formattedDate}</span>. I have read and agree to all terms and conditions.
        </div>
        {tpl.acceptance_note && (
          <p style={{ fontSize:'.72rem', color:'#64748b', marginTop:8, lineHeight:1.55, textAlign:'right' }} dangerouslySetInnerHTML={{ __html: tpl.acceptance_note }} />
        )}
        {/* One-click copy button — hidden in PDF via data-pdf-hide */}
        <button
          data-pdf-hide="1"
          onClick={copyAcceptanceText}
          style={{
            marginTop:10, width:'100%', padding:'7px 0', border:'none', borderRadius:6,
            background: acceptanceCopied ? '#059669' : '#0a1c3e',
            color:'#fff', fontFamily:'Poppins,sans-serif', fontSize:'.74rem',
            fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', gap:6, transition:'background .2s',
          }}
        >
          {acceptanceCopied ? '✓ Copied to clipboard!' : '📋 Copy Acceptance Text'}
        </button>
      </div>
    </div>
  );

  const wm = renderWatermark();

  const PAGE_STYLE = {
    width:A4_PX_W, minHeight:A4_PX_H, background:'#fff',
    boxShadow:'0 4px 28px rgba(0,0,0,.2)', borderRadius:3,
    position:'relative', overflow:'visible', flexShrink:0,
  };
  const footerTextReserveH = (tpl.footer_text || tpl.footer_sub_text) ? 62 : 16;
  // padding-bottom is a small cosmetic gap only — footer clearance is now enforced
  // in the packing formula (ftrReserve in numerator = constant physical px, not scaled)
  const BODY_PAD = { padding:'18px 36px 8px', position:'relative', zIndex:1, zoom: tpl.content_scale || 1 };

  // PDF download — opens browser print dialog → user selects "Save as PDF"
  const downloadPDF = useCallback(async () => {
    setPdfLoading(true);
    const pages = pageRefs.current.filter(Boolean);
    if (pages.length === 0) { setPdfLoading(false); return; }
    const candName = candidateName.trim() || 'Candidate';
    const fn = 'Offer_Letter_' + (letterType === 'hr' ? 'HR' : 'Consultant') + '_' + candName.replace(/\s+/g, '_');
    try {
      await document.fonts.ready;

      // Collect all CSS from current document
      let allCSS = '';
      for (const sheet of document.styleSheets) {
        try { for (const rule of sheet.cssRules) allCSS += rule.cssText + '\n'; }
        catch (_) {}
      }
      const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => l.outerHTML).join('\n');

      // Clone each page and clean up
      const pagesHTML = pages.map(page => {
        const clone = page.cloneNode(true);
        clone.querySelectorAll('button, [data-pdf-hide], .olg-drag-handle').forEach(n => n.remove());
        clone.querySelectorAll('[contenteditable]').forEach(n => {
          n.removeAttribute('contenteditable');
          n.style.outline = 'none';
        });
        // Fix styles for print
        clone.querySelectorAll('*').forEach(n => {
          if (n.style) {
            if (n.style.userSelect === 'none') n.style.userSelect = '';
            if (n.style.webkitUserSelect === 'none') n.style.webkitUserSelect = '';
            // Keep zoom as-is — transform:scale() doesn't affect layout so causes cut-off
            if (n.style.pointerEvents === 'none' && n.tagName !== 'IMG') n.style.pointerEvents = '';
            if (n.style.cursor === 'grab' || n.style.cursor === 'grabbing') n.style.cursor = '';
          }
        });
        clone.style.width = A4_PX_W + 'px';
        clone.style.height = A4_PX_H + 'px';
        clone.style.overflow = 'hidden';
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0';
        clone.style.margin = '0';
        return clone.outerHTML;
      }).join('\n');

      // Build hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:0;height:0;border:none;opacity:0;pointer-events:none;';
      document.body.appendChild(iframe);

      const printDoc = iframe.contentDocument || iframe.contentWindow.document;
      printDoc.open();
      printDoc.write([
        '<!DOCTYPE html><html><head>',
        '<meta charset="utf-8">',
        linkTags,
        '<style>', allCSS, '</style>',
        `<style>
          @page { size: A4 portrait; margin: 0; }
          @media print { @page { size: A4 portrait; margin: 0; } }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            -webkit-user-select: text !important;
            user-select: text !important;
          }
          html, body { margin:0; padding:0; background:#fff; }
          .olg-page {
            width: ${A4_PX_W}px; height: ${A4_PX_H}px;
            overflow: hidden; position: relative; background: #fff;
            page-break-after: always;
          }
          .olg-page:last-child { page-break-after: auto; }
          .olg-drag-handle, [data-pdf-hide] { display:none!important; }
        </style>`,
        `<title>${fn}</title>`,
        '</head><body>',
        pagesHTML,
        '</body></html>',
      ].join('\n'));
      printDoc.close();

      // Wait for fonts + images
      try { await iframe.contentWindow.document.fonts.ready; } catch (_) {}
      await new Promise(r => setTimeout(r, 800));

      setPdfLoading(false);

      // Trigger print dialog
      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      // Cleanup
      const cleanup = () => { try { document.body.removeChild(iframe); } catch (_) {} };
      try { iframe.contentWindow.addEventListener('afterprint', cleanup); } catch (_) {}
      setTimeout(cleanup, 120000);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again.');
      setPdfLoading(false);
    }
  }, [candidateName, letterType, tpl]);

  return (
    <div style={{ display:'flex', height:'100%', fontFamily:'Inter,system-ui,sans-serif', background:'#e8ecf4', overflow:'hidden' }}>
      {/* Scoped styles */}
      <style>{
        '.olg-page strong,.olg-page b{font-weight:800!important}' +
        '.olg-page .olg-drag-handle{visibility:hidden!important;pointer-events:none!important}' +
        '.olg-edit-active .olg-page .olg-drag-handle{visibility:visible!important;pointer-events:auto!important}'
      }</style>
      {pdfLoading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(10,28,62,.88)', zIndex:99999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
          <div className="olg-spin" style={{ width:44, height:44, border:'4px solid rgba(255,255,255,.15)', borderTopColor:'#0099cc', borderRadius:'50%' }} />
          <div style={{ color:'#fff', fontSize:'.95rem', fontWeight:500 }}>Generating PDF\u2026 Please wait</div>
          <style>{'.olg-spin{animation:olg-s .7s linear infinite}@keyframes olg-s{to{transform:rotate(360deg)}}'}</style>
        </div>
      )}

      {/* Hidden measurement container — NO zoom here; offsetHeight returns logical px */}
      <div ref={measureRef} style={{ position:'fixed', top:-99999, left:-99999, width:A4_PX_W, visibility:'hidden', pointerEvents:'none', fontFamily:'Inter,sans-serif' }}>
        <div className="m-hdr">{renderHeader()}</div>
        {/* Intro block — logical heights */}
        <div className="m-intro" style={{ padding:'18px 36px 0' }}>
          <div style={{ height:20, marginBottom:16 }} />
          <div style={{ height:30, marginBottom:12 }} />
          <div style={{ fontSize:'.82rem', lineHeight:1.7, marginBottom:6 }}>Dear Candidate,</div>
          {tpl.greeting_intro && <div style={{ fontSize:'.82rem', lineHeight:1.7, marginBottom:8 }} dangerouslySetInnerHTML={{ __html: tpl.greeting_intro }} />}
          {tpl.greeting_intro2 && <div style={{ fontSize:'.82rem', lineHeight:1.7, marginBottom:12 }} dangerouslySetInnerHTML={{ __html: tpl.greeting_intro2 }} />}
        </div>
        {/* Section blocks — logical heights */}
        {activeSections.map((sec, si) => (
          <div key={si} className="m-sec" style={{ padding:'0 36px', marginBottom:14 }}>
            {sec.type === 'heading' ? (
              <div style={{ height:18, marginBottom:6 }} />
            ) : (
              <>
                <div style={{ height:22, marginBottom:7 }} />
                <ul style={{ paddingLeft:0, margin:0, listStyle:'none' }}>
                  {(sec.clauses || []).map((cl, ci) => (
                    <li key={ci} style={{ fontSize:'.81rem', lineHeight:1.7, marginBottom:4, paddingLeft:24 }} dangerouslySetInnerHTML={{ __html: renderClause(cl) }} />
                  ))}
                </ul>
                {sec.note && <div style={{ padding:'7px 11px', margin:'5px 0', fontSize:'.79rem' }} dangerouslySetInnerHTML={{ __html: sec.note }} />}
              </>
            )}
          </div>
        ))}
        {/* Acceptance block — measure its logical height */}
        <div className="m-accept" style={{ padding:'0 36px' }}>
          <div style={{ marginTop:20, paddingTop:14 }}>
            <div style={{ fontFamily:'Poppins,sans-serif', fontSize:'.88rem', fontWeight:700, marginBottom:10, textAlign:'center' }}>Acceptance of Offer</div>
            <div style={{ padding:'12px 15px', border:'1.5px solid #b8cfe8', borderRadius:8 }}>
              <div style={{ fontSize:'.8rem', marginBottom:7, paddingBottom:6 }}>Reply to confirm your acceptance:</div>
              <div style={{ fontSize:'.76rem', marginBottom:5 }}>Copy &amp; reply via email</div>
              <div style={{ fontSize:'.8rem', lineHeight:1.75, padding:'9px 13px' }}>
                I, {displayName}, accept the Offer of Appointment for the role of {currentDesignation} at Fix Your Finance, dated {formattedDate}. I have read and agree to all terms and conditions.
              </div>
              {tpl.acceptance_note && <p style={{ fontSize:'.72rem', marginTop:8, lineHeight:1.55 }} dangerouslySetInnerHTML={{ __html: tpl.acceptance_note }} />}
            </div>
          </div>
        </div>
      </div>

      {/* ─── LEFT PANEL ─── */}
      <div style={{ width:292, background:'#fff', borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', background:'#f8fafc', flexShrink:0 }}>
          {[['details','📋 Details'],['template','⚙️ Template']].map(([k,l]) => (
            <button key={k} onClick={() => setActiveTab(k)} style={{
              flex:1, padding:'11px 5px', border:'none',
              background: activeTab===k ? '#fff' : 'transparent',
              fontSize:'.68rem', fontWeight:700, color: activeTab===k ? '#0a1c3e' : '#64748b',
              cursor:'pointer', fontFamily:'Poppins,sans-serif', letterSpacing:'.04em', textTransform:'uppercase',
              borderBottom: activeTab===k ? '3px solid #0a1c3e' : '3px solid transparent', marginBottom:-2,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'16px 14px 22px', scrollbarWidth:'thin' }}>
          {activeTab === 'details' ? (
            <>
              <div style={{ fontSize:'.9rem', fontWeight:700, color:'#0a1c3e', marginBottom:3, fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:3, height:16, background:'#cc1818', borderRadius:2 }} /> Candidate Details
              </div>
              <p style={{ fontSize:'.73rem', color:'#64748b', marginBottom:14 }}>Fill fields \u2014 preview updates live.</p>

              {/* Employee Search — autofill from backend */}
              <Field label="Search Employee (autofill)">
                <div style={{ position:'relative' }}>
                  <input
                    type="text"
                    placeholder={empLoading ? 'Loading employees…' : 'Type name or ID…'}
                    value={empSearch}
                    onChange={e => { setEmpSearch(e.target.value); setEmpDropOpen(true); }}
                    onFocus={() => setEmpDropOpen(true)}
                    onBlur={() => setTimeout(() => setEmpDropOpen(false), 200)}
                    style={{ ...iStyle, paddingRight: 28 }}
                  />
                  <span style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', fontSize:'.8rem', pointerEvents:'none' }}>🔍</span>
                  {empDropOpen && filteredEmps.length > 0 && (
                    <div style={{
                      position:'absolute', top:'100%', left:0, right:0, zIndex:9999,
                      background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:7,
                      boxShadow:'0 8px 24px rgba(0,0,0,.14)', maxHeight:220, overflowY:'auto', marginTop:2,
                    }}>
                      {filteredEmps.map(emp => {
                        const name = [emp.first_name, emp.last_name].filter(Boolean).join(' ');
                        const eid = emp.employee_id || '';
                        const des = emp.designation || '';
                        return (
                          <div
                            key={emp._id || emp.id}
                            onMouseDown={() => autofillFromEmployee(emp)}
                            style={{
                              padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #f1f5f9',
                              display:'flex', flexDirection:'column', gap:2,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'}
                            onMouseLeave={e => e.currentTarget.style.background='#fff'}
                          >
                            <div style={{ fontWeight:700, color:'#0a1c3e', fontSize:'.82rem', fontFamily:'Inter,sans-serif' }}>{titleCase(name)}</div>
                            <div style={{ fontSize:'.68rem', color:'#64748b', display:'flex', gap:8 }}>
                              {eid && <span>ID: {eid}</span>}
                              {des && <span>· {des}</span>}
                              {emp.salary ? <span>· ₹{formatIndian(Math.round(emp.salary))}</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {empDropOpen && empSearch.trim().length > 0 && filteredEmps.length === 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:9999, background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:7, padding:'10px 12px', fontSize:'.75rem', color:'#94a3b8', marginTop:2, boxShadow:'0 4px 12px rgba(0,0,0,.1)' }}>
                      No employees found
                    </div>
                  )}
                </div>
                <p style={{ fontSize:'.63rem', color:'#94a3b8', marginTop:3, marginBottom:0, lineHeight:1.5 }}>Select an employee to auto-fill all fields below</p>
              </Field>

              <Field label="Letter Type">
                <select value={letterType} onChange={e => { setLetterType(e.target.value); setDesignation(e.target.value==='hr' ? 'Human Resources' : 'Financial Consultant'); }} style={iStyle}>
                  <option value="consultant">Financial Consultant</option>
                  <option value="hr">Human Resources</option>
                </select>
              </Field>
              <Field label="Candidate Full Name">
                <input type="text" placeholder="e.g. Rahul Sharma" value={candidateName} onChange={e => setCandidateName(titleCase(e.target.value))} style={iStyle} />
              </Field>
              <Field label="Monthly Salary">
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontWeight:700, color:'#0a1c3e', fontSize:'.86rem' }}>₹</span>
                  <input type="text" placeholder="e.g. 20,000" inputMode="numeric" value={monthlySalary} onChange={e => { const r=e.target.value.replace(/[^0-9]/g,''); setMonthlySalary(r?formatIndian(parseInt(r)):''); }} style={{ ...iStyle, paddingLeft:24 }} />
                </div>
              </Field>
              {letterType !== 'hr' && (
                <Field label="Monthly Target ">
                  <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontWeight:700, color:'#0a1c3e', fontSize:'.86rem' }}>₹</span>
                    <input type="text" placeholder="e.g. 5,00,000" inputMode="numeric" value={monthlyTarget} onChange={e => { const r=e.target.value.replace(/[^0-9]/g,''); setMonthlyTarget(r?formatIndian(parseInt(r)):''); }} style={{ ...iStyle, paddingLeft:24 }} />
                  </div>
                </Field>
              )}
              <Field label="Joining Date">
                <input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} style={{ ...iStyle, colorScheme: 'light' }} />
              </Field>
              <Field label="Designation">
                <select value={designation} onChange={e => { setDesignation(e.target.value); setLetterType(e.target.value==='Human Resources'?'hr':'consultant'); }} style={iStyle}>
                  <option value="Financial Consultant">Financial Consultant</option>
                  <option value="Human Resources">Human Resources</option>
                </select>
              </Field>
              <button onClick={downloadPDF} style={{ width:'100%', padding:'11px', border:'none', borderRadius:8, cursor:'pointer', background:'linear-gradient(135deg,#0a1c3e,#1a5ba8)', color:'#fff', fontFamily:'Poppins,sans-serif', fontSize:'.84rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 14px rgba(10,28,62,.3)', marginTop:8 }}>
                📄 Save as PDF
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize:'.9rem', fontWeight:700, color:'#0a1c3e', marginBottom:3, fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:3, height:16, background:'#cc1818', borderRadius:2 }} /> Template Settings
              </div>
              <p style={{ fontSize:'.73rem', color:'#64748b', marginBottom:14 }}>Changes preview instantly.</p>

              {[
                ['hdr','🏢 Header', (
                  <>
                    <Field label="Type"><div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {[['logo','Logo'],['image','Image'],['text','Text']].map(([t,l]) => <Chip key={t} active={tpl.header_type===t} onClick={() => set('header_type',t)}>{l}</Chip>)}
                    </div></Field>
                    {tpl.header_type !== 'image' && <Field label="Logo/Company Text"><input value={tpl.header_logo_text||''} onChange={e => set('header_logo_text',e.target.value)} style={iStyle} /></Field>}
                    {tpl.header_type === 'image' && <ImageUploader value={tpl.header_image_base64} onChange={v=>set('header_image_base64',v)} label="Logo Image" hint="Upload PNG/JPG" />}
                    {tpl.header_type === 'image' && tpl.header_image_base64 && (
                      <Field label={'Logo Width: ' + (tpl.header_logo_width||200) + 'px'}>
                        <input type="range" min="60" max="400" value={tpl.header_logo_width||200} onChange={e=>set('header_logo_width',parseInt(e.target.value))} style={{width:'100%'}} />
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:'.6rem',color:'#94a3b8',marginTop:1}}><span>60px (small)</span><span>400px (large)</span></div>
                      </Field>
                    )}
                    <Field label="Reposition Layout">
                      <button onClick={() => setTpl(p => ({...p, header_logo_x:16, header_logo_y:16, header_addr_x:490, header_addr_y:16, header_name_x:16, header_name_y:85}))} style={{ padding:'5px 10px', background:'#f0f9ff', border:'1.5px solid #bae6fd', borderRadius:6, fontSize:'.68rem', color:'#0369a1', cursor:'pointer', fontWeight:700, width:'100%' }}>&#x27F3; Reset All Positions</button>
                      <p style={{fontSize:'.63rem',color:'#64748b',marginTop:4,marginBottom:0,lineHeight:1.5}}>&#128161; Drag logo (teal), address (teal), or legal name (red handle) on the A4 preview</p>
                    </Field>
                    <Field label="Legal Name"><input value={tpl.header_company_name||''} onChange={e => set('header_company_name',e.target.value)} style={iStyle} /></Field>
                    <Field label="Address 1"><input value={tpl.header_address_line1||''} onChange={e => set('header_address_line1',e.target.value)} style={iStyle} /></Field>
                    <Field label="Address 2"><input value={tpl.header_address_line2||''} onChange={e => set('header_address_line2',e.target.value)} style={iStyle} /></Field>
                    <Field label="Address 3"><input value={tpl.header_address_line3||''} onChange={e => set('header_address_line3',e.target.value)} style={iStyle} /></Field>
                    <Field label="Website"><input value={tpl.header_website||''} onChange={e => set('header_website',e.target.value)} style={iStyle} /></Field>
                    <Field label="BG Color"><div style={{display:'flex',gap:8,alignItems:'center'}}><input type="color" value={tpl.header_bg_color||'#000'} onChange={e=>set('header_bg_color',e.target.value)} style={{width:34,height:34,border:'1.5px solid #e2e8f0',borderRadius:6,padding:2,cursor:'pointer'}} /><span style={{fontSize:'.76rem',color:'#64748b'}}>{tpl.header_bg_color}</span></div></Field>
                    <Field label="Text Color"><div style={{display:'flex',gap:8,alignItems:'center'}}><input type="color" value={tpl.header_text_color||'#fff'} onChange={e=>set('header_text_color',e.target.value)} style={{width:34,height:34,border:'1.5px solid #e2e8f0',borderRadius:6,padding:2,cursor:'pointer'}} /><span style={{fontSize:'.76rem',color:'#64748b'}}>{tpl.header_text_color}</span></div></Field>
                    <Field label={'Header Height: ' + (tpl.header_min_height||110) + 'px'}>
                      <input type="range" min={60} max={280} value={tpl.header_min_height||110} onChange={e=>set('header_min_height',+e.target.value)} style={{width:'100%'}} />
                      <p style={{fontSize:'.61rem',color:'#94a3b8',marginTop:2,marginBottom:0}}>Or drag the bottom edge of the header on the A4 preview</p>
                    </Field>
                    {tpl.header_type === 'image' && tpl.header_image_base64 && (
                      <Field label={'Logo Height: ' + (tpl.header_logo_height > 0 ? tpl.header_logo_height + 'px' : 'Auto')}>
                        <input type="range" min={0} max={200} value={tpl.header_logo_height||0} onChange={e=>set('header_logo_height',+e.target.value)} style={{width:'100%'}} />
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:'.6rem',color:'#94a3b8',marginTop:1}}><span>0 = Auto ratio</span><span>Set fixed height</span></div>
                        <p style={{fontSize:'.61rem',color:'#94a3b8',marginTop:2,marginBottom:0}}>Or drag the corner handle (blue) on the logo in the preview</p>
                      </Field>
                    )}
                    <Field label={'Company Name Size: ' + (tpl.header_company_name_size||12) + 'px'}>
                      <input type="range" min={8} max={24} value={tpl.header_company_name_size||12} onChange={e=>set('header_company_name_size',+e.target.value)} style={{width:'100%'}} />
                    </Field>
                    <Field label={'Address Font Size: ' + (tpl.header_addr_size||11) + 'px'}>
                      <input type="range" min={7} max={18} value={tpl.header_addr_size||11} onChange={e=>set('header_addr_size',+e.target.value)} style={{width:'100%'}} />
                    </Field>
                    <Field label={'Address Scale: ' + Math.round((tpl.header_addr_scale||1)*100) + '%'}>
                      <input type="range" min={50} max={250} value={Math.round((tpl.header_addr_scale||1)*100)} onChange={e=>set('header_addr_scale',+e.target.value/100)} style={{width:'100%'}} />
                      <p style={{fontSize:'.61rem',color:'#94a3b8',marginTop:2,marginBottom:0}}>Or drag the green corner handle on the address block</p>
                    </Field>
                    <Toggle label="Show header on all pages" checked={tpl.header_all_pages !== false} onChange={v=>set('header_all_pages',v)} />
                  </>
                )],
                ['wm','💧 Watermark', (
                  <>
                    <Field label="Type"><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {[['text','Text'],['image','Image'],['none','None']].map(([t,l]) => <Chip key={t} active={tpl.watermark_type===t} onClick={() => set('watermark_type',t)}>{l}</Chip>)}
                    </div></Field>
                    {tpl.watermark_type==='text' && (
                      <Field label="Text (Enter for new line)">
                        <textarea value={tpl.watermark_text||''} onChange={e=>set('watermark_text',e.target.value)} rows={3} style={{...iStyle, resize:'vertical', lineHeight:1.55}} placeholder={'CONFIDENTIAL\n(one line per row)'} />
                        <p style={{fontSize:'.62rem',color:'#94a3b8',marginTop:2,marginBottom:0}}>Each line = separate watermark line on page</p>
                      </Field>
                    )}
                    {tpl.watermark_type==='image' && <ImageUploader value={tpl.watermark_image_base64} onChange={v=>set('watermark_image_base64',v)} label="Watermark Image" />}
                    {tpl.watermark_type!=='none' && <Field label={'Opacity (' + Math.round((tpl.watermark_opacity||0.1)*100) + '%)'}><input type="range" min="3" max="40" value={Math.round((tpl.watermark_opacity||0.1)*100)} onChange={e=>set('watermark_opacity',parseInt(e.target.value)/100)} style={{width:'100%'}} /></Field>}
                    {tpl.watermark_type!=='none' && <Field label={'Size (' + (tpl.watermark_size||88) + (tpl.watermark_type==='image' ? '% of page' : 'px') + ')'}><input type="range" min={tpl.watermark_type==='image' ? 10 : 20} max={tpl.watermark_type==='image' ? 100 : 180} value={tpl.watermark_size||88} onChange={e=>set('watermark_size',+e.target.value)} style={{width:'100%'}} /></Field>}
                  </>
                )],
                ['ft','📄 Footer', (
                  <>
                    <Field label="Show footer on">
                      <select value={tpl.footer_page||'last'} onChange={e=>set('footer_page',e.target.value)} style={iStyle}>
                        <option value="last">Last page only</option>
                        <option value="first">First page only</option>
                        <option value="all">All pages</option>
                      </select>
                    </Field>
                    <Toggle label="Show footer image" checked={!!tpl.footer_has_image} onChange={v=>set('footer_has_image',v)} />
                    {tpl.footer_has_image && (
                      <>
                        <ImageUploader value={tpl.footer_image_base64} onChange={v=>set('footer_image_base64',v)} label="Footer Image" />
                        {tpl.footer_image_base64 && (
                          <>
                            <Field label={'Image Width: ' + (tpl.footer_image_width||140) + 'px'}>
                              <input type="range" min={40} max={1000} value={tpl.footer_image_width||140} onChange={e=>set('footer_image_width',+e.target.value)} style={{width:'100%'}} />
                            </Field>
                            <Field label={'Image Height: ' + (tpl.footer_image_height||38) + 'px'}>
                              <input type="range" min={20} max={300} value={tpl.footer_image_height||38} onChange={e=>set('footer_image_height',+e.target.value)} style={{width:'100%'}} />
                            </Field>
                            <p style={{fontSize:'.63rem',color:'#0369a1',lineHeight:1.5,margin:'4px 0 2px',fontWeight:600}}>💡 Preview: drag the image to reposition it anywhere on the page</p>
                            <button onClick={()=>setTpl(p=>({...p,footer_img_x:0,footer_img_y:1043}))} style={{padding:'3px 9px',background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:5,fontSize:'.65rem',color:'#64748b',cursor:'pointer',fontWeight:600}}>↺ Reset image position</button>
                          </>
                        )}
                      </>
                    )}
                    <Field label={'Text Size: ' + (tpl.footer_text_size||10) + 'px'}>
                      <input type="range" min={7} max={16} value={tpl.footer_text_size||10} onChange={e=>set('footer_text_size',+e.target.value)} style={{width:'100%'}} />
                    </Field>
                    <Field label="Main Text"><textarea value={tpl.footer_text||''} onChange={e=>set('footer_text',e.target.value)} rows={2} style={{...iStyle,resize:'vertical',lineHeight:1.55}} /></Field>
                    <Field label="Sub Text"><textarea value={tpl.footer_sub_text||''} onChange={e=>set('footer_sub_text',e.target.value)} rows={2} style={{...iStyle,resize:'vertical',lineHeight:1.55}} /></Field>
                  </>
                )],
                ['ct','📝 Letter Content', (
                  <>
                    <Field label="Subject Line"><input value={tpl.subject_line||''} onChange={e=>set('subject_line',e.target.value)} style={iStyle} /></Field>
                    <Field label="Opening Para"><textarea value={tpl.greeting_intro||''} onChange={e=>set('greeting_intro',e.target.value)} rows={4} style={{...iStyle,resize:'vertical',lineHeight:1.55}} /></Field>
                    <Field label="Second Para"><textarea value={tpl.greeting_intro2||''} onChange={e=>set('greeting_intro2',e.target.value)} rows={3} style={{...iStyle,resize:'vertical',lineHeight:1.55}} /></Field>
                    <Field label="Acceptance Note"><textarea value={tpl.acceptance_note||''} onChange={e=>set('acceptance_note',e.target.value)} rows={3} style={{...iStyle,resize:'vertical',lineHeight:1.55}} /></Field>
                  </>
                )],
                ['cs','🔤 Content Scale', (
                  <>
                    <Field label={'Body Text Scale: ' + Math.round((tpl.content_scale||1)*100) + '%'}>
                      <input type="range" min={70} max={130} value={Math.round((tpl.content_scale||1)*100)} onChange={e=>set('content_scale',parseInt(e.target.value)/100)} style={{width:'100%',accentColor:'#0a1c3e'}} />
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'.6rem',color:'#94a3b8',marginTop:2}}>
                        <span>70% (compact)</span><span style={{color:'#0a1c3e',fontWeight:700}}>100% normal</span><span>130% (large)</span>
                      </div>
                    </Field>
                    <button onClick={()=>set('content_scale',1)} style={{padding:'4px 10px',background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:6,fontSize:'.68rem',color:'#64748b',cursor:'pointer',fontWeight:600,marginTop:2}}>↺ Reset to 100%</button>
                    <p style={{fontSize:'.67rem',color:'#64748b',lineHeight:1.6,marginTop:6,marginBottom:0}}>Scales all body text / clauses globally — like Word's font size. Header &amp; footer stay fixed.</p>
                  </>
                )],
                ['tio','📥 Template File', (
                  <>
                    <input ref={importTplRef} type="file" accept=".json" style={{display:'none'}} onChange={importTemplate} />
                    <button onClick={exportTemplate} style={{width:'100%',padding:'9px',border:'1.5px solid #86efac',borderRadius:7,background:'#f0fdf4',color:'#15803d',fontSize:'.76rem',fontWeight:700,cursor:'pointer',marginBottom:7,fontFamily:'Poppins,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>⬇ Export Template (.json)</button>
                    <button onClick={()=>importTplRef.current?.click()} style={{width:'100%',padding:'9px',border:'1.5px dashed #7dd3fc',borderRadius:7,background:'#f0f9ff',color:'#0369a1',fontSize:'.76rem',fontWeight:700,cursor:'pointer',fontFamily:'Poppins,sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>⬆ Import Template (.json)</button>
                    <p style={{fontSize:'.63rem',color:'#94a3b8',lineHeight:1.6,marginTop:6,marginBottom:0}}>Export saves all settings (header, watermark, sections, colors) as a .json file. Import loads a previously exported template.</p>
                  </>
                )],
              ].map(([id, heading, content]) => (
                <details key={id} style={{ marginBottom:10, border:'1px solid #e8edf5', borderRadius:8, overflow:'hidden' }}>
                  <summary style={{ padding:'8px 11px', background:'#f3f6fb', fontSize:'.67rem', fontWeight:800, color:'#0a1c3e', textTransform:'uppercase', letterSpacing:'.07em', fontFamily:'Poppins,sans-serif', cursor:'pointer', userSelect:'none' }}>{heading}</summary>
                  <div style={{ padding:11 }}>{content}</div>
                </details>
              ))}

              {saveStatus && (
                <div style={{ textAlign:'center', fontSize:'.74rem', padding:'5px 0', fontWeight:600, color: saveStatus==='saved'?'#059669':'#dc2626' }}>
                  {saveStatus==='saved' ? ' Template saved' : ' Failed to save'}
                </div>
              )}
              <button onClick={handleSaveTemplate} style={{ width:'100%', padding:'11px', border:'none', borderRadius:8, cursor:'pointer', background:'linear-gradient(135deg,#059669,#10b981)', color:'#fff', fontFamily:'Poppins,sans-serif', fontSize:'.82rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow:'0 4px 14px rgba(5,150,105,.3)', marginTop:2 }}>
                💾 Save Template
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL: A4 pages ─── */}
      <div className={isEditMode ? 'olg-edit-active' : ''} style={{ flex:1, display:'flex', flexDirection:'column', background:'#e0e4ee', minWidth:0, overflow:'hidden', position:'relative' }}>
        {isEditMode && <InlineToolbar />}

        {/* Scrollable pages area */}
        <div style={{ flex:1, overflowY:'auto', padding:'28px 32px 60px', display:'flex', flexDirection:'column', alignItems:'center', gap:28 }}>
          <div style={{ width: Math.round(A4_PX_W * previewZoom / 100), display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
            {isEditMode ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:'.72rem', color:'#0369a1', fontWeight:600, fontFamily:'Inter,sans-serif' }}>✏️ Edit mode — click a section's Edit button to modify</span>
                <button
                  onClick={() => { handleSaveTemplate(); setIsEditMode(false); setEditingSec(null); }}
                  style={{ padding:'5px 14px', background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:6, color:'#fff', fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:5, boxShadow:'0 2px 8px rgba(5,150,105,.35)', whiteSpace:'nowrap' }}
                >💾 Save &amp; Exit</button>
                <button
                  onClick={() => { setIsEditMode(false); setEditingSec(null); }}
                  style={{ padding:'5px 10px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:6, color:'#64748b', fontSize:'.72rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}
                >✕ Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditMode(true)}
                style={{ padding:'6px 18px', background:'#0a1c3e', border:'none', borderRadius:7, color:'#fff', fontSize:'.73rem', fontWeight:700, cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:6, boxShadow:'0 2px 8px rgba(10,28,62,.3)' }}
              >✏️ Edit Template</button>
            )}
            <span style={{ fontSize:'.68rem', color:'#94a3b8' }}>A4 · {totalPages} page{totalPages>1?'s':''} · {Math.round((tpl.content_scale||1)*100)}% text</span>
          </div>

          {/* N PAGES — rendered dynamically */}
          {groups.map((group, pgIdx) => {
            const isFirst = pgIdx === 0;
            const isLast = pgIdx === groups.length - 1;
            const showHeader = isFirst || tpl.header_all_pages !== false;
            const bodyStyle = isFirst ? BODY_PAD : { ...BODY_PAD, paddingTop: 38 };
            const fp = tpl.footer_page || 'last';
            const showFooter = fp === 'all' || (fp === 'first' && isFirst) || (fp === 'last' && isLast);
            return (
              <div key={pgIdx} style={{ width: Math.round(A4_PX_W * previewZoom/100), height: Math.round(A4_PX_H * previewZoom/100), position:'relative', flexShrink:0 }}>
                <div style={{ position:'absolute', top:0, left:0, transformOrigin:'top left', transform:`scale(${previewZoom/100})` }}>
                  <div ref={el => { pageRefs.current[pgIdx] = el; }} style={PAGE_STYLE} className="olg-page">
                    {wm}
                    {showHeader && renderHeader()}
                    {showHeader && brandStrip}
                    <div style={bodyStyle}>
                      {isFirst && (
                        <>
                          <div style={{ textAlign:'right', fontSize:'.8rem', color:'#718096', marginBottom:14, fontFamily:'Inter,sans-serif' }}>
                            Date: <strong style={{ color:'#0a1c3e' }}>{formattedDate}</strong>
                          </div>
                          <div style={{ fontFamily:'Poppins,sans-serif', fontSize:'.96rem', fontWeight:800, color:'#0a1c3e', textAlign:'center', padding:'7px 0 13px', borderBottom:'2px solid #0a1c3e', marginBottom:11 }}
                            dangerouslySetInnerHTML={{ __html: tpl.subject_line || 'Offer of Appointment' }} />
                          <div style={{ fontSize:'.84rem', marginBottom:6, color:'#1a2540', fontWeight:600, fontFamily:'Inter,sans-serif' }}>
                            Dear <strong style={{ color:'#0a1c3e' }}>{displayName}</strong>,
                          </div>
                          {tpl.greeting_intro && <p style={{ fontSize:'.82rem', lineHeight:1.7, color:'#111827', marginBottom:8, textAlign:'justify', fontFamily:'Inter,sans-serif', fontWeight:500 }} dangerouslySetInnerHTML={{ __html: tpl.greeting_intro }} />}
                          {tpl.greeting_intro2 && <p style={{ fontSize:'.82rem', lineHeight:1.7, color:'#111827', marginBottom:12, textAlign:'justify', fontFamily:'Inter,sans-serif', fontWeight:500 }} dangerouslySetInnerHTML={{ __html: tpl.greeting_intro2 }} />}
                        </>
                      )}
                      {group.map(si => <SectionBlock key={si} sec={activeSections[si]} si={si} />)}
                      {isEditMode && isLast && (
                        <div data-pdf-hide="1" style={{ display:'flex', gap:8, marginBottom:14, marginTop:4 }}>
                          <button onClick={addSection} style={{ width:'100%', padding:'7px 0', background:'#f0f9ff', border:'1.5px dashed #7dd3fc', borderRadius:6, color:'#0369a1', fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>➕ Add Section</button>
                        </div>
                      )}
                      {isLast && acceptanceBlock}
                    </div>
                    {showFooter && renderFooter()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Zoom bar (Word-style bottom) ── */}
        <div style={{ background:'#c8cdd8', borderTop:'1px solid #b0b5c0', padding:'5px 18px', display:'flex', alignItems:'center', gap:8, flexShrink:0, userSelect:'none' }}>
          <span style={{ fontSize:'.72rem', color:'#374151', fontWeight:700 }}>&#128269;</span>
          <button onClick={() => setPreviewZoom(z => Math.max(40, z - 10))} style={{ width:22, height:22, border:'1px solid #9ca3af', borderRadius:4, background:'#fff', cursor:'pointer', fontWeight:900, fontSize:'1rem', lineHeight:1, color:'#374151', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>&#8722;</button>
          <input type="range" min={40} max={130} value={previewZoom} onChange={e => setPreviewZoom(+e.target.value)} style={{ width:100, accentColor:'#0a1c3e' }} />
          <button onClick={() => setPreviewZoom(z => Math.min(130, z + 10))} style={{ width:22, height:22, border:'1px solid #9ca3af', borderRadius:4, background:'#fff', cursor:'pointer', fontWeight:900, fontSize:'1rem', lineHeight:1, color:'#374151', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>&#43;</button>
          <span style={{ fontSize:'.73rem', fontWeight:700, color:'#374151', minWidth:36 }}>{previewZoom}%</span>
          <button onClick={() => setPreviewZoom(85)} style={{ fontSize:'.62rem', padding:'2px 7px', border:'1px solid #9ca3af', borderRadius:4, background:'#fff', cursor:'pointer', color:'#64748b', fontWeight:600 }}>Reset</button>
          <div style={{ width:1, height:16, background:'#9ca3af', margin:'0 4px' }} />
          <span style={{ fontSize:'.63rem', color:'#4b5563', fontWeight:600 }}>Text: {Math.round((tpl.content_scale||1)*100)}%</span>
          <input type="range" min={70} max={130} value={Math.round((tpl.content_scale||1)*100)} onChange={e => set('content_scale', parseInt(e.target.value)/100)} style={{ width:70, accentColor:'#cc1818' }} />
          <span style={{ marginLeft:'auto', fontSize:'.6rem', color:'#6b7280' }}>Preview zoom <strong style={{color:'#374151'}}>&#8597;</strong> (left slider) · Text size <strong style={{color:'#cc1818'}}>T</strong> (right slider)</span>
        </div>
      </div>
    </div>
  );
};

export default OfferLetterGenerator;
