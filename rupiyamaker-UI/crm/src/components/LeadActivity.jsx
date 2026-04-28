import React, { useState, useEffect } from 'react';

/* ─────────────────── CONFIG ─────────────────── */

const TYPE_CONFIG = {
  create:               { label: 'Lead Created',          icon: '🎯', bg: '#f0fdf4', badge: '#16a34a', dot: '#16a34a' },
  created:              { label: 'Lead Created',          icon: '🎯', bg: '#f0fdf4', badge: '#16a34a', dot: '#16a34a' },
  field_update:         { label: 'Field Updated',         icon: '✏️',  bg: '#faf5ff', badge: '#7c3aed', dot: '#7c3aed' },
  status_change:        { label: 'Status Changed',        icon: '🔄', bg: '#fffbeb', badge: '#d97706', dot: '#d97706' },
  status_changed:       { label: 'Status Changed',        icon: '🔄', bg: '#fffbeb', badge: '#d97706', dot: '#d97706' },
  sub_status_change:    { label: 'Sub-Status Changed',    icon: '🔁', bg: '#fff7ed', badge: '#b45309', dot: '#b45309' },
  assignment:           { label: 'Lead Assigned',         icon: '👤', bg: '#ecfeff', badge: '#0891b2', dot: '#0891b2' },
  assigned:             { label: 'Lead Assigned',         icon: '👤', bg: '#ecfeff', badge: '#0891b2', dot: '#0891b2' },
  department_transfer:  { label: 'Department Transfer',   icon: '🔀', bg: '#fef2f2', badge: '#dc2626', dot: '#dc2626' },
  transfer:             { label: 'Department Transfer',   icon: '🔀', bg: '#fef2f2', badge: '#dc2626', dot: '#dc2626' },
  transferred:          { label: 'Department Transfer',   icon: '🔀', bg: '#fef2f2', badge: '#dc2626', dot: '#dc2626' },
  note:                 { label: 'Note Added',            icon: '📝', bg: '#f8fafc', badge: '#475569', dot: '#64748b' },
  remark_added:         { label: 'Note Added',            icon: '📝', bg: '#f8fafc', badge: '#475569', dot: '#64748b' },
  attachment_uploaded:  { label: 'Document Uploaded',     icon: '📎', bg: '#f0fdfa', badge: '#0f766e', dot: '#0f766e' },
  document:             { label: 'Document Uploaded',     icon: '📎', bg: '#f0fdfa', badge: '#0f766e', dot: '#0f766e' },
  task_added:           { label: 'Task Created',          icon: '✅', bg: '#f0fdf4', badge: '#059669', dot: '#059669' },
  task_updated:         { label: 'Task Updated',          icon: '🔧', bg: '#eff6ff', badge: '#0284c7', dot: '#0284c7' },
  task_completed:       { label: 'Task Completed',        icon: '🏆', bg: '#f5f3ff', badge: '#7c3aed', dot: '#7c3aed' },
  question_validation:  { label: 'Questions Validated',  icon: '✔️',  bg: '#fdf2f8', badge: '#be185d', dot: '#be185d' },
  login_form_updated:   { label: 'Sent to Login',         icon: '🔗', bg: '#eff6ff', badge: '#1d4ed8', dot: '#1d4ed8' },
  file_sent_to_login:   { label: 'Sent to Login',         icon: '🔗', bg: '#eff6ff', badge: '#1d4ed8', dot: '#1d4ed8' },
  reporting_change:     { label: 'Reporting Updated',     icon: '📊', bg: '#f9fafb', badge: '#6b7280', dot: '#6b7280' },
  update:               { label: 'Lead Updated',          icon: '📋', bg: '#eff6ff', badge: '#2563eb', dot: '#2563eb' },
  updated:              { label: 'Lead Updated',          icon: '📋', bg: '#eff6ff', badge: '#2563eb', dot: '#2563eb' },
};

function cfg(activity) {
  const t = activity.action || activity.activity_type || 'update';
  return TYPE_CONFIG[t] || { label: t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), icon: '📋', bg: '#f9fafb', badge: '#6b7280', dot: '#6b7280' };
}

function fmt(dt) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  } catch { return ''; }
}

function fmtFull(dt) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  } catch { return ''; }
}

function fmtDate(dt) {
  if (!dt) return 'Unknown Date';
  try {
    const d = new Date(dt);
    if (isNaN(d)) return 'Unknown Date';
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const toIST = (x) => new Date(x.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dIST = toIST(d);
    const todayIST = toIST(today);
    const yestIST = toIST(yesterday);
    if (dIST.toDateString() === todayIST.toDateString()) return 'Today';
    if (dIST.toDateString() === yestIST.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  } catch { return ''; }
}

/* ─────────────────── PILL COMPONENT ─────────────────── */
function Pill({ label, value, color }) {
  if (!value) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 8, padding: '5px 10px', fontSize: 12, flex: '1 1 auto', minWidth: 120,
    }}>
      <span style={{ color: '#9ca3af', fontSize: 11, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || '#111827', fontSize: 12 }}>{value}</span>
    </div>
  );
}

/* ─────────────────── ACTIVITY CARD ─────────────────── */
function ActivityCard({ activity, isLast }) {
  const type = activity.action || activity.activity_type || 'update';
  const c = cfg(activity);
  const user = activity.user_name || 'System';
  const time = fmt(activity.created_at);
  const d = activity.details || {};

  /* ── Lead Created special card ── */
  if (type === 'create' || type === 'created') {
    // assigned_to_name could be null/Unknown User — fall back gracefully
    const assignedToRaw = d.assigned_to_name || d.to_user_name || activity.assigned_to_name || null;
    const assignedTo = assignedToRaw && assignedToRaw !== 'Unknown User' ? assignedToRaw : null;
    const createdBy = d.created_by_name || user;
    const fullDt = fmtFull(activity.created_at);
    return (
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        {/* Timeline dot */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: c.badge, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: '0 0 0 4px #dcfce7', zIndex: 1
          }}>{c.icon}</div>
          {!isLast && <div style={{ width: 2, flex: 1, background: '#e5e7eb', marginTop: 4 }} />}
        </div>
        {/* Card */}
        <div style={{
          flex: 1, background: c.bg, border: '1px solid #bbf7d0',
          borderRadius: 10, padding: '12px 14px', marginBottom: 2,
          boxShadow: '0 1px 4px rgba(22,163,74,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                background: c.badge, color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '2px 9px', borderRadius: 20, letterSpacing: '0.03em'
              }}>Lead Created</span>
            </div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{time}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill label="Created by" value={createdBy} color="#16a34a" />
            {assignedTo && <Pill label="Assigned to" value={assignedTo} color="#0891b2" />}
            <Pill label="Date & Time" value={fullDt} color="#374151" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Field name for field_update ── */
  const cardLabel = type === 'field_update'
    ? (d.field_display_name || d.field_name || 'Field Changed')
    : c.label;

  /* ── Description row ── */
  let desc = null;

  if (type === 'field_update' && (d.old_value !== undefined || d.new_value !== undefined)) {
    const newStr = String(d.new_value ?? '');
    const oldStr = String(d.old_value ?? '');
    const isMultiline = newStr.includes('\n') || oldStr.includes('\n');

    if (isMultiline) {
      // Obligation row or check_eligibility — render as structured list
      // Filter out legacy alias field lines baked into old DB activity records
      const JUNK_LINE_PREFIXES = ['Workplace:', 'Employer:', 'Organization:', 'Employer Name:', 'Birth Place:',
        // "Company:" alone is an alias; "Company Name:" is valid — use exact prefix
        'Company: '];
      const lines = newStr.split('\n').filter(line => {
        if (!line.trim()) return false;
        return !JUNK_LINE_PREFIXES.some(p => line.trimStart().startsWith(p));
      });
      desc = (
        <div style={{ marginTop: 6 }}>
          {oldStr && oldStr !== 'Not Set' && oldStr !== 'Updated' && !oldStr.includes('\n') && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Previous: {oldStr}</div>
          )}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '6px 10px' }}>
            {lines.map((line, i) => {
              // Each line is like "Field Label: old → new" or "Field Label: value"
              const arrowIdx = line.indexOf(' → ');
              if (arrowIdx !== -1) {
                const label = line.slice(0, arrowIdx).split(':')[0];
                const rest = line.slice(line.indexOf(':') + 1);
                const parts = rest.split(' → ');
                const fromVal = parts[0]?.trim();
                const toVal = parts[1]?.trim();
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '2px 0', borderBottom: i < lines.length - 1 ? '1px dashed #d1fae5' : 'none', flexWrap: 'wrap' }}>
                    <span style={{ color: '#6b7280', minWidth: 80 }}>{label}:</span>
                    {fromVal && <span style={{ color: '#dc2626', textDecoration: 'line-through', fontSize: 11 }}>{fromVal}</span>}
                    {fromVal && <span style={{ color: '#9ca3af' }}>→</span>}
                    <span style={{ color: '#15803d', fontWeight: 500 }}>{toVal || fromVal}</span>
                  </div>
                );
              }
              return (
                <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0' }}>{line}</div>
              );
            })}
          </div>
        </div>
      );
    } else {
      // Simple single-line field change
      const hasOld = oldStr && oldStr !== '' && oldStr !== 'Not Set' && oldStr !== 'null';
      desc = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {hasOld && (
            <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 5, fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {oldStr.slice(0, 100)}
            </span>
          )}
          {hasOld && <span style={{ color: '#9ca3af', fontSize: 14 }}>→</span>}
          <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 5, fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {newStr.slice(0, 100) || '(empty)'}
          </span>
        </div>
      );
    }
  } else if (type === 'status_change' || type === 'status_changed') {
    const from = d.from_status || d.from_status_name;
    const to = d.to_status || d.to_status_name;
    if (from || to) desc = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {from && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{from}</span>}
        {from && <span style={{ color: '#9ca3af', fontSize: 14 }}>→</span>}
        {to && <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{to}</span>}
      </div>
    );
  } else if (type === 'sub_status_change') {
    const from = d.from_sub_status;
    const to = d.to_sub_status;
    if (from || to) desc = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {from && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{from}</span>}
        {from && <span style={{ color: '#9ca3af', fontSize: 14 }}>→</span>}
        {to && <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{to}</span>}
      </div>
    );
  } else if (type === 'assignment' || type === 'assigned') {
    const from = d.from_user_name;
    const to = d.to_user_name || d.assigned_to_name;
    if (from || to) desc = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {from && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>From: {from}</span>}
        {from && to && <span style={{ color: '#9ca3af', fontSize: 14 }}>→</span>}
        {to && <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>To: {to}</span>}
      </div>
    );
  } else if (type === 'department_transfer' || type === 'transfer' || type === 'transferred') {
    const from = d.from_department_name;
    const to = d.to_department_name || d.department;
    if (from || to) desc = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {from && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{from}</span>}
        {from && to && <span style={{ color: '#9ca3af', fontSize: 14 }}>→</span>}
        {to && <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{to}</span>}
      </div>
    );
  } else if (type === 'note' || type === 'remark_added') {
    if (d.note_text) desc = (
      <div style={{ marginTop: 6, fontSize: 12, color: '#374151', fontStyle: 'italic', background: '#fff', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #94a3b8' }}>
        "{d.note_text.slice(0, 200)}{d.note_text.length > 200 ? '...' : ''}"
      </div>
    );
  } else if (type === 'attachment_uploaded' || type === 'document') {
    const name = d.filename || d.document_name || activity.description;
    if (name) desc = (
      <div style={{ marginTop: 6, fontSize: 12, color: '#0f766e', fontWeight: 500 }}>📄 {name}</div>
    );
  } else if (type === 'task_added' || type === 'task_updated' || type === 'task_completed') {
    const title = d.task_title || d.title;
    if (title) desc = (
      <div style={{ marginTop: 6, fontSize: 12, color: '#374151', fontWeight: 500 }}>📌 {title}</div>
    );
  } else if (type === 'login_form_updated' || type === 'file_sent_to_login') {
    if (d.form_type) desc = (
      <div style={{ marginTop: 6, fontSize: 12, color: '#1d4ed8', fontWeight: 500 }}>Form: {d.form_type}</div>
    );
  } else if (type === 'reporting_change') {
    const from = d.from_reporting_name || d.from_user_name;
    const to = d.to_reporting_name || d.to_user_name;
    if (from || to) desc = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {from && <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{from}</span>}
        {from && to && <span style={{ color: '#9ca3af', fontSize: 14 }}>→</span>}
        {to && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 5, fontSize: 12 }}>{to}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
      {/* Timeline dot + line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: c.bg, border: '2px solid ' + c.dot,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0, zIndex: 1
        }}>{c.icon}</div>
        {!isLast && <div style={{ width: 2, flex: 1, background: '#e5e7eb', marginTop: 4 }} />}
      </div>

      {/* Card body */}
      <div style={{
        flex: 1, background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, padding: '10px 13px', marginBottom: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Header: badge + user + time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              background: c.badge + '18', color: c.badge, fontSize: 11, fontWeight: 700,
              padding: '2px 9px', borderRadius: 20, letterSpacing: '0.02em', border: '1px solid ' + c.badge + '30'
            }}>{cardLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>👤 {user}</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>•</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{time}</span>
          </div>
        </div>

        {/* Description */}
        {desc}
      </div>
    </div>
  );
}

/* ─────────────────── MAIN COMPONENT ─────────────────── */
export default function Activities({ leadId, userId, leadData }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const resolvedLeadId = leadId
    ? String(leadId)
    : leadData?._id ? String(leadData._id)
    : leadData?.id ? String(leadData.id)
    : null;

  const resolvedUserId = userId
    ? String(userId)
    : localStorage.getItem('userId') || localStorage.getItem('user_id') || (() => {
        try { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u._id || u.id || null; }
        catch { return null; }
      })();

  useEffect(() => {
    if (resolvedLeadId && resolvedUserId) fetchActivities();
  }, [resolvedLeadId, resolvedUserId]);

  async function fetchActivities() {
    setIsLoading(true); setError('');
    try {
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const url = isLoginLead
        ? `/api/lead-login/login-leads/${resolvedLeadId}/activities?user_id=${resolvedUserId}`
        : `/api/leads/${resolvedLeadId}/activities?user_id=${resolvedUserId}`;
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Status ' + res.status);
      let data = await res.json();

      // Inject synthetic Lead Created if missing
      // Parse assigned_to name from lead data
      const parseAssignedToName = (ld) => {
        if (!ld) return null;
        if (ld.assigned_to_name) return ld.assigned_to_name;
        if (ld.assignedToName) return ld.assignedToName;
        // assigned_to can be JSON string array, array of objects, or comma-separated string
        try {
          let at = ld.assigned_to;
          if (typeof at === 'string') {
            try { at = JSON.parse(at); } catch { /* not JSON */ }
          }
          if (Array.isArray(at) && at.length > 0) {
            const first = at[0];
            if (typeof first === 'object' && first !== null) return first.name || first.username || null;
            if (typeof first === 'string' && first.length < 60 && !first.match(/^[a-f0-9]{24}$/i)) return first;
          }
          if (typeof at === 'string' && at.length < 60 && !at.match(/^[a-f0-9]{24}$/i)) return at;
        } catch { /* ignore */ }
        return null;
      };

      const assignedToName = parseAssignedToName(leadData);
      const createdByName = (typeof leadData?.created_by_name === 'object'
        ? leadData.created_by_name?.name || leadData.created_by_name?.first_name
        : leadData?.created_by_name) || null;

      const hasCreate = data.some(a => ['create', 'created'].includes(a.action || a.activity_type));
      if (!hasCreate && leadData) {
        data = [...data, {
          _id: '__created_' + resolvedLeadId,
          action: 'create', activity_type: 'create',
          user_name: createdByName || 'System',
          created_at: leadData.created_at || leadData.createdAt || leadData.lead_date,
          details: {
            created_by_name: createdByName || 'System',
            assigned_to_name: assignedToName,
          },
        }];
      } else {
        // Enrich existing create activity with leadData info if details missing
        data = data.map(a => {
          if ((a.action === 'create' || a.activity_type === 'created' || a.activity_type === 'create') && leadData) {
            return {
              ...a,
              details: {
                ...a.details,
                assigned_to_name: a.details?.assigned_to_name || assignedToName,
                created_by_name: a.details?.created_by_name || a.user_name || createdByName,
              }
            };
          }
          return a;
        });
      }

      // Filter out junk/legacy alias field activities (old DB records before the guard was added)
      // These are duplicate/alias fields that were mistakenly tracked: employer, workplace, organization, birth_place, etc.
      const JUNK_FIELD_NAMES = new Set([
        'workplace', 'employer', 'company', 'organization', 'employer_name',
        'birth_place', 'birthplace', 'birth place',
        'Workplace', 'Employer', 'Company', 'Organization', 'Employer Name',
        'Birth Place', 'Birthplace',
      ]);
      data = data.filter(a => {
        if (a.activity_type !== 'field_update' && a.action !== 'field_update') return true;
        const desc = (a.description || a.details?.field_display_name || '').trim();
        return !JUNK_FIELD_NAMES.has(desc);
      });

      setActivities(data);
    } catch (e) {
      setError('Could not load activity history.');
    } finally {
      setIsLoading(false);
    }
  }

  const FILTERS = [
    { value: 'all',          label: 'All' },
    { value: 'field_update', label: '✏️ Fields' },
    { value: 'status_change','label': '🔄 Status' },
    { value: 'assignment',   label: '👤 Assigned' },
    { value: 'note',         label: '📝 Notes' },
    { value: 'document',     label: '📎 Docs' },
    { value: 'task',         label: '✅ Tasks' },
  ];

  function matches(a) {
    if (filter === 'all') return true;
    const t = a.action || a.activity_type || '';
    if (filter === 'task') return t.startsWith('task_');
    if (filter === 'status_change') return ['status_change','status_changed','sub_status_change'].includes(t);
    if (filter === 'assignment') return ['assignment','assigned'].includes(t);
    if (filter === 'note') return ['note','remark_added'].includes(t);
    if (filter === 'document') return ['attachment_uploaded','document'].includes(t);
    return t === filter;
  }

  const filtered = activities.filter(matches);

  // Group by date, newest first
  const byDate = {};
  for (const a of filtered) {
    const dk = fmtDate(a.created_at);
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(a);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) =>
    new Date(byDate[b][0].created_at) - new Date(byDate[a][0].created_at)
  );

  const totalCount = activities.length;
  const filteredCount = filtered.length;

  return (
    <div style={{ padding: '16px 12px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Activity Timeline</div>
          {!isLoading && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {filteredCount} {filter !== 'all' ? 'filtered' : 'total'} {filteredCount !== totalCount ? `of ${totalCount}` : ''} activities
            </div>
          )}
        </div>
        <button
          onClick={fetchActivities}
          style={{
            fontSize: 12, color: '#2563eb', background: '#eff6ff',
            border: '1px solid #bfdbfe', borderRadius: 7, padding: '5px 12px',
            cursor: 'pointer', fontWeight: 500
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Filter tabs ── */}
      <div style={{
        display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16,
        background: '#f9fafb', padding: 6, borderRadius: 10, border: '1px solid #e5e7eb'
      }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            fontSize: 11, padding: '4px 11px', borderRadius: 8, border: 'none',
            cursor: 'pointer', transition: 'all 0.15s',
            background: filter === f.value ? '#fff' : 'transparent',
            color: filter === f.value ? '#1d4ed8' : '#6b7280',
            fontWeight: filter === f.value ? 700 : 400,
            boxShadow: filter === f.value ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          }}>{f.label}</button>
        ))}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 13 }}>Loading activities...</div>
        </div>
      )}

      {/* ── Error ── */}
      {!isLoading && error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 13, color: '#b91c1c', flex: 1 }}>{error}</span>
          <button onClick={fetchActivities} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13 }}>No activities found{filter !== 'all' ? ' for this filter' : ''}.</div>
        </div>
      )}

      {/* ── Timeline ── */}
      {!isLoading && sortedDates.map((date, di) => {
        const dayActivities = byDate[date].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return (
          <div key={date} style={{ marginBottom: 4 }}>
            {/* Date separator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: di > 0 ? 12 : 0
            }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#374151',
                background: '#f3f4f6', border: '1px solid #e5e7eb',
                padding: '3px 12px', borderRadius: 12, whiteSpace: 'nowrap'
              }}>📅 {date}</span>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>

            {/* Activities for this date */}
            {dayActivities.map((activity, i) => (
              <ActivityCard
                key={activity._id || i}
                activity={activity}
                isLast={i === dayActivities.length - 1 && di === sortedDates.length - 1}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
