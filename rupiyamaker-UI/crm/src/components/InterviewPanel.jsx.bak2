"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, RefreshCw, Settings, ChevronDown, ChevronRight, MoreVertical,
  CheckCircle, XCircle, Clock, Users, TrendingUp, BarChart2, Calendar,
  Phone, MessageCircle, AlertTriangle, Eye, Edit2, Trash2, Filter,
  PlayCircle, X, ArrowRight, FileText, UserCheck, Activity, Bell,
  Download, Upload, Star, Award, Target, Briefcase, ClipboardList,
  ChevronLeft, RotateCcw, AlertCircle
} from 'lucide-react';
import EditInterview from './EditInterview';
import DuplicateInterviewModal from './DuplicateInterviewModal';
import API, { interviewSettingsAPI } from '../services/api';
import { formatDate as formatDateUtil, getISTDateYMD, toISTDateYMD } from '../utils/dateUtils';
import { hasPermission, getUserPermissions } from '../utils/permissions';

// ─────────────────────────────────────────────────────────────────────────────
// Stage detection helpers
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_KW = {
  round_2:    ['round_2','round2','round 2','second round','r2','2nd round'],
  job_offered:['job_offer','job offer','offered','offer job','shortlisted'],
  training:   ['training','onboarding','induction'],
  hired:      ['hired','hire','joined','selected','appointment'],
  rejected:   ['reject','decline','no_show','no show','not_relevant','not relevant','drop','cancel'],
};

function getStageFromStatus(status) {
  if (!status) return 'interview';
  const s = status.toLowerCase().replace(/_/g, ' ');
  for (const [stage, kws] of Object.entries(STAGE_KW)) {
    if (kws.some(k => s.includes(k))) return stage;
  }
  return 'interview';
}

function fmtStatus(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag component
// ─────────────────────────────────────────────────────────────────────────────
function Tag({ label, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-700 border border-blue-200',
    green:  'bg-green-100 text-green-700 border border-green-200',
    red:    'bg-red-100 text-red-700 border border-red-200',
    orange: 'bg-orange-100 text-orange-700 border border-orange-200',
    indigo: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    gray:   'bg-gray-100 text-gray-600 border border-gray-200',
    yellow: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ForwardRemarkModal — mandatory remark when moving stage
// ─────────────────────────────────────────────────────────────────────────────
function ForwardRemarkModal({ interview, targetStage, onConfirm, onClose }) {
  const [remark, setRemark] = useState('');
  const [jobOfferDirect, setJobOfferDirect] = useState(false);

  const stageLabel = {
    round_2: 'Round 2',
    job_offered: 'Job Offered',
    training: 'Training',
    hired: 'Hired',
  }[targetStage] || targetStage;

  const canOfferDirect = targetStage === 'round_2';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Move to {stageLabel}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Candidate</p>
            <p className="font-semibold text-gray-800">{interview?.candidate_name}</p>
          </div>
          {canOfferDirect && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={jobOfferDirect} onChange={e => setJobOfferDirect(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Skip Round 2 — directly give Job Offer</span>
            </label>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              rows={3}
              placeholder="Enter feedback or remarks..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!remark.trim()}
            onClick={() => onConfirm(jobOfferDirect ? 'job_offered' : targetStage, remark)}
            className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RescheduleModal
// ─────────────────────────────────────────────────────────────────────────────
function RescheduleModal({ interview, onConfirm, onClose }) {
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Reschedule Interview</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Candidate</p>
            <p className="font-semibold text-gray-800">{interview?.candidate_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Date &amp; Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this being rescheduled?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!newDate || !reason.trim()}
            onClick={() => onConfirm(newDate, reason)}
            className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DeclineModal
// ─────────────────────────────────────────────────────────────────────────────
function DeclineModal({ interview, declineReasons, onConfirm, onClose }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [remarks, setRemarks] = useState('');

  const defaultReasons = [
    'Not Relevant', 'Package Mismatch', 'No Show', 'Candidate Not Interested',
    'Already Placed', 'Skill Mismatch', 'Other',
  ];
  const reasons = declineReasons?.length ? declineReasons : defaultReasons;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Decline / Reject Candidate</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Candidate</p>
            <p className="font-semibold text-gray-800">{interview?.candidate_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={e => setSelectedReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Select reason...</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={3}
              placeholder="Additional remarks..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!selectedReason || !remarks.trim()}
            onClick={() => onConfirm(selectedReason, remarks)}
            className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CandidateDetailModal
// ─────────────────────────────────────────────────────────────────────────────
function CandidateDetailModal({ interview, onClose }) {
  if (!interview) return null;

  const Field = ({ label, value }) => (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Candidate Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold">
              {interview.candidate_name?.[0] || '?'}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">{interview.candidate_name}</h4>
              <p className="text-sm text-gray-500">{interview.mobile_number}</p>
              {interview.status && <Tag label={fmtStatus(interview.status)} color="blue" />}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Gender" value={interview.gender} />
            <Field label="Age" value={interview.age} />
            <Field label="Qualification" value={interview.qualification} />
            <Field label="Experience Type" value={interview.experience_type} />
            <Field label="Total Experience" value={interview.total_experience ? `${interview.total_experience} yrs` : null} />
            <Field label="City" value={interview.city} />
            <Field label="State" value={interview.state} />
            <Field label="Alternate Number" value={interview.alternate_number} />
            <Field label="Marital Status" value={interview.marital_status} />
            <Field label="Job Opening" value={interview.job_opening} />
            <Field label="Interview Type" value={interview.interview_type} />
            <Field label="Source Portal" value={interview.source_portal} />
            <Field label="Old Salary" value={interview.old_salary ? `₹${Number(interview.old_salary).toLocaleString()}` : null} />
            <Field label="Offered Salary" value={interview.monthly_salary_offered ? `₹${Number(interview.monthly_salary_offered).toLocaleString()}` : null} />
            <Field label="Interview Date" value={interview.interview_date ? formatDateUtil(interview.interview_date) : null} />
            <Field label="Created By" value={interview.created_by} />
            <Field label="Living Arrangement" value={interview.living_arrangement} />
            <Field label="Primary Earner" value={interview.primary_earning_member} />
            <Field label="Business Type" value={interview.type_of_business} />
            <Field label="Banking Experience" value={interview.banking_experience} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuditHistoryModal
// ─────────────────────────────────────────────────────────────────────────────
function AuditHistoryModal({ interview, reassignments, onClose }) {
  const [tab, setTab] = useState('reassign');

  const myReassignments = reassignments?.filter(r =>
    r.interview_id === interview?._id || r.interview === interview?._id
  ) || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Audit History — {interview?.candidate_name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-4 border-b flex gap-2 flex-shrink-0">
          {[['reassign','Reassignments'],['timeline','Full Track']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'reassign' && (
            myReassignments.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">No reassignment history</p>
              : <div className="space-y-3">
                  {myReassignments.map((r, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.status === 'approved' ? 'bg-green-100 text-green-700' :
                          r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {r.status || 'Pending'}
                        </span>
                        <span className="text-xs text-gray-400">{r.created_at ? formatDateUtil(r.created_at) : ''}</span>
                      </div>
                      <p className="text-sm text-gray-700">From: <span className="font-medium">{r.from_user || r.requested_by || '—'}</span></p>
                      <p className="text-sm text-gray-700">To: <span className="font-medium">{r.to_user || r.assigned_to || '—'}</span></p>
                      {r.reason && <p className="text-xs text-gray-500 mt-1">Reason: {r.reason}</p>}
                    </div>
                  ))}
                </div>
          )}
          {tab === 'timeline' && (
            <div className="relative pl-4">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
              {[
                { label: 'Created', date: interview?.created_at },
                { label: `Status: ${fmtStatus(interview?.status)}`, date: interview?.updated_at },
              ].filter(e => e.label).map((event, i) => (
                <div key={i} className="relative mb-4 pl-6">
                  <div className="absolute left-0 w-4 h-4 rounded-full bg-blue-500 -translate-x-0.5 mt-0.5" />
                  <p className="text-sm font-medium text-gray-800">{event.label}</p>
                  <p className="text-xs text-gray-500">{event.date ? formatDateUtil(event.date) : '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardView
// ─────────────────────────────────────────────────────────────────────────────
function DashboardView({ interviews }) {
  const [dateFilter, setDateFilter] = useState('month');
  const now = new Date();

  const filtered = useMemo(() => {
    if (dateFilter === 'today') {
      return interviews.filter(i => new Date(i.created_at || i.interview_date).toDateString() === now.toDateString());
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return interviews.filter(i => new Date(i.created_at || i.interview_date) >= weekAgo);
    }
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return interviews.filter(i => new Date(i.created_at || i.interview_date) >= monthAgo);
  }, [interviews, dateFilter]);

  const total = filtered.length;
  const hiredCount = filtered.filter(i => getStageFromStatus(i.status) === 'hired').length;
  const rejectedCount = filtered.filter(i => getStageFromStatus(i.status) === 'rejected').length;
  const inPipeline = total - hiredCount - rejectedCount;

  const hrMap = {};
  filtered.forEach(i => {
    const hr = i.created_by || 'Unknown';
    if (!hrMap[hr]) hrMap[hr] = { name: hr, created: 0, round2: 0, offered: 0, training: 0, hired: 0, rejected: 0 };
    hrMap[hr].created++;
    const stage = getStageFromStatus(i.status);
    if (stage === 'round_2') hrMap[hr].round2++;
    else if (stage === 'job_offered') hrMap[hr].offered++;
    else if (stage === 'training') hrMap[hr].training++;
    else if (stage === 'hired') hrMap[hr].hired++;
    else if (stage === 'rejected') hrMap[hr].rejected++;
  });
  const hrRows = Object.values(hrMap).sort((a, b) => b.created - a.created);

  const KPI = ({ label, value, icon: Icon, bg }) => (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );

  const funnelStages = [
    { label: 'Interview',   count: filtered.filter(i => getStageFromStatus(i.status) === 'interview').length,   color: 'bg-blue-500' },
    { label: 'Round 2',     count: filtered.filter(i => getStageFromStatus(i.status) === 'round_2').length,     color: 'bg-indigo-500' },
    { label: 'Job Offered', count: filtered.filter(i => getStageFromStatus(i.status) === 'job_offered').length, color: 'bg-purple-500' },
    { label: 'Training',    count: filtered.filter(i => getStageFromStatus(i.status) === 'training').length,    color: 'bg-yellow-500' },
    { label: 'Hired',       count: hiredCount,                                                                   color: 'bg-green-500' },
  ];
  const maxCount = funnelStages[0].count || 1;

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex items-center gap-2">
        {[['today','Today'],['week','This Week'],['month','This Month']].map(([v,l]) => (
          <button key={v} onClick={() => setDateFilter(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              dateFilter === v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Total Pipeline"  value={total}      icon={Users}     bg="bg-blue-500" />
        <KPI label="In Pipeline"     value={inPipeline} icon={Activity}  bg="bg-indigo-500" />
        <KPI label="Hired"           value={hiredCount} icon={UserCheck} bg="bg-green-500" />
        <KPI label="Rejected"        value={rejectedCount} icon={XCircle} bg="bg-red-500" />
      </div>

      {/* HR Performance */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">HR Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['HR Name','Created','Round 2','Job Offered','Training','Hired','Rejected'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hrRows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No data available</td></tr>
              )}
              {hrRows.map(row => (
                <tr key={row.name} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600">{row.created}</td>
                  <td className="px-4 py-3"><span className="text-indigo-600 font-medium">{row.round2}</span></td>
                  <td className="px-4 py-3"><span className="text-blue-600 font-medium">{row.offered}</span></td>
                  <td className="px-4 py-3"><span className="text-yellow-600 font-medium">{row.training}</span></td>
                  <td className="px-4 py-3"><span className="text-green-600 font-medium">{row.hired}</span></td>
                  <td className="px-4 py-3"><span className="text-red-500 font-medium">{row.rejected}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Pipeline Funnel</h3>
        <div className="space-y-2">
          {funnelStages.map(stage => {
            const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
            const barWidth = Math.max((stage.count / maxCount) * 100, 2);
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className="w-28 text-sm text-gray-600 text-right shrink-0">{stage.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                  <div className={`${stage.color} h-full rounded-full flex items-center pl-2 transition-all`}
                    style={{ width: `${barWidth}%` }}>
                    {stage.count > 0 && <span className="text-white text-xs font-medium">{stage.count}</span>}
                  </div>
                </div>
                <div className="w-10 text-xs text-gray-400 shrink-0">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CandidateTableRow
// ─────────────────────────────────────────────────────────────────────────────
function CandidateTableRow({
  idx, interview, stage, reassignments,
  onForward, onReschedule, onDecline, onNoShow,
  onViewDetails, onWhatsApp, onEditInterview,
}) {
  const [ddOpen, setDdOpen] = useState(false);
  const ddRef = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasReassign = reassignments?.some(r =>
    (r.interview_id === interview._id || r.interview === interview._id) && r.status === 'pending'
  );
  const isRescheduled = interview.status?.toLowerCase().includes('reschedule');
  const dateStr = interview.interview_date ? formatDateUtil(interview.interview_date) : '—';

  const actionBtn = (() => {
    switch (stage) {
      case 'interview':   return { label: 'Move to Round 2', cls: 'bg-blue-600 hover:bg-blue-700 text-white', action: () => onForward('round_2') };
      case 'round_2':     return { label: 'Offer Job',       cls: 'bg-blue-600 hover:bg-blue-700 text-white', action: () => onForward('job_offered') };
      case 'job_offered': return { label: 'Start Train',     cls: 'bg-blue-600 hover:bg-blue-700 text-white', action: () => onForward('training') };
      case 'training':    return { label: 'Hire Candidate',  cls: 'bg-green-600 hover:bg-green-700 text-white', action: () => onForward('hired') };
      default: return null;
    }
  })();

  const stageColor = {
    interview: 'blue', round_2: 'indigo', job_offered: 'purple',
    training: 'yellow', hired: 'green', rejected: 'red',
  }[stage] || 'gray';

  return (
    <tr className="hover:bg-blue-50/30 transition-colors border-b border-gray-50 last:border-0">
      {/* # */}
      <td className="px-4 py-4 text-sm text-gray-400 font-medium w-10">{idx}</td>

      {/* Created */}
      <td className="px-4 py-4 whitespace-nowrap">
        <p className="text-xs text-gray-600">{interview.created_at ? formatDateUtil(interview.created_at) : '—'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{interview.created_by || '—'}</p>
      </td>

      {/* Owner */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
            {((interview.created_by || '?')[0]).toUpperCase()}
          </div>
          <span className="text-sm text-gray-700 whitespace-nowrap">{interview.created_by || '—'}</span>
        </div>
      </td>

      {/* Candidate */}
      <td className="px-4 py-4">
        <button
          onClick={onViewDetails}
          className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors text-left block"
        >
          {interview.candidate_name}
        </button>
        <div className="flex items-center gap-1 mt-0.5">
          <Phone size={11} className="text-gray-400" />
          <span className="text-xs text-gray-500">{interview.mobile_number}</span>
        </div>
      </td>

      {/* Exp & Gender */}
      <td className="px-4 py-4">
        <p className="text-sm text-gray-700">{interview.experience_type || '—'}</p>
        <p className="text-xs text-gray-500">{interview.gender || '—'}{interview.age ? ` · ${interview.age}y` : ''}</p>
        {interview.total_experience && (
          <p className="text-xs text-gray-400">{interview.total_experience} yrs exp</p>
        )}
      </td>

      {/* Role & Source */}
      <td className="px-4 py-4">
        <p className="text-sm font-medium text-gray-800 whitespace-nowrap">{interview.job_opening || '—'}</p>
        <p className="text-xs text-gray-500">{interview.source_portal || interview.interview_type || '—'}</p>
      </td>

      {/* Date & Alerts */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Calendar size={12} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 whitespace-nowrap">{dateStr}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {hasReassign && <Tag label="Reassigned" color="orange" />}
          {isRescheduled && <Tag label="Rescheduled" color="indigo" />}
          {stage === 'round_2' && interview.round1_remarks && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium border border-indigo-200">
              R1 Notes
            </span>
          )}
          {stage === 'rejected' && interview.decline_reason && (
            <Tag label={interview.decline_reason} color="red" />
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <Tag label={fmtStatus(interview.status) || 'Unknown'} color={stageColor} />
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5">
          {/* WhatsApp */}
          <button
            onClick={onWhatsApp}
            title="Send WhatsApp invite"
            className="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
          >
            <MessageCircle size={14} />
          </button>

          {/* Primary stage action */}
          {actionBtn && (
            <button
              onClick={actionBtn.action}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${actionBtn.cls}`}
            >
              {actionBtn.label}
            </button>
          )}

          {/* Edit */}
          <button
            onClick={onEditInterview}
            title="Edit interview"
            className="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <Edit2 size={14} />
          </button>

          {/* 3-dot dropdown */}
          <div className="relative" ref={ddRef}>
            <button
              onClick={() => setDdOpen(!ddOpen)}
              className="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <MoreVertical size={14} />
            </button>
            {ddOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 w-48">
                <button onClick={() => { onReschedule(); setDdOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <RotateCcw size={14} className="text-gray-400" /> Reschedule
                </button>
                {stage !== 'rejected' && (
                  <button onClick={() => { onNoShow(); setDdOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <AlertCircle size={14} className="text-gray-400" /> Mark No-Show
                  </button>
                )}
                <button onClick={() => { onViewDetails(); setDdOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <Eye size={14} className="text-gray-400" /> View Details
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { onDecline(); setDdOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <XCircle size={14} /> Decline / Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InterviewTable
// ─────────────────────────────────────────────────────────────────────────────
function InterviewTable({
  interviews, stage, reassignments,
  onForward, onReschedule, onDecline, onNoShow,
  onViewDetails, onWhatsApp, onEditInterview,
}) {
  if (interviews.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
        <ClipboardList size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No candidates found</p>
        <p className="text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '960px' }}>
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['#','Created','Owner','Candidate','Exp & Gender','Role & Source','Date & Alerts','Status','Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {interviews.map((iv, i) => (
              <CandidateTableRow
                key={iv._id || i}
                idx={i + 1}
                interview={iv}
                stage={stage}
                reassignments={reassignments}
                onForward={targetStage => onForward(iv, targetStage)}
                onReschedule={() => onReschedule(iv)}
                onDecline={() => onDecline(iv)}
                onNoShow={() => onNoShow(iv)}
                onViewDetails={() => onViewDetails(iv)}
                onWhatsApp={() => onWhatsApp(iv)}
                onEditInterview={() => onEditInterview(iv)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateInterviewDrawer
// ─────────────────────────────────────────────────────────────────────────────
function CreateInterviewDrawer({
  open, onClose, onSubmit,
  statusOptions, jobOpeningOptions, interviewTypeOptions, sourcePortalOptions,
  saving,
}) {
  const initialForm = {
    candidate_name: '', mobile_number: '', alternate_number: '', gender: '',
    qualification: '', experience_type: 'fresher', total_experience: '',
    age: '', marital_status: '', city: '', state: '',
    job_opening: '', interview_type: '', source_portal: '', status: '',
    date_time: '', old_salary: '', monthly_salary_offered: '',
    living_arrangement: '', primary_earning_member: '', type_of_business: '', banking_experience: '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setFormData(initialForm);
      setErrors({});
    }
  }, [open]);

  const SKIP_UPPER = ['mobile_number','alternate_number','total_experience','old_salary',
    'monthly_salary_offered','experience_type','gender','interview_type','status',
    'qualification','marital_status','living_arrangement','primary_earning_member',
    'type_of_business','banking_experience','source_portal','age','date_time','job_opening'];

  const inp = e => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: SKIP_UPPER.includes(name) ? value : value.toUpperCase() }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!formData.candidate_name?.trim()) e.candidate_name = 'Required';
    if (!formData.mobile_number?.trim() || formData.mobile_number.trim().length !== 10) e.mobile_number = '10-digit number required';
    if (!formData.gender) e.gender = 'Required';
    if (!formData.qualification) e.qualification = 'Required';
    if (!formData.job_opening?.trim()) e.job_opening = 'Required';
    if (!formData.interview_type) e.interview_type = 'Required';
    if (!formData.date_time) e.date_time = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      candidate_name: formData.candidate_name,
      mobile_number: formData.mobile_number,
      gender: formData.gender,
      job_opening: formData.job_opening,
      interview_type: formData.interview_type,
      status: formData.status || statusOptions?.[0] || 'new_interview',
      alternate_number: formData.alternate_number || '',
      city: formData.city?.trim() || 'Not Specified',
      state: formData.state?.trim() || 'Not Specified',
      qualification: formData.qualification || '',
      experience_type: formData.experience_type || 'fresher',
      total_experience: formData.total_experience || '',
      old_salary: formData.old_salary ? parseFloat(formData.old_salary) : null,
      monthly_salary_offered: formData.monthly_salary_offered ? parseFloat(formData.monthly_salary_offered) : null,
      offer_salary: formData.monthly_salary_offered ? parseFloat(formData.monthly_salary_offered) : null,
      marital_status: formData.marital_status || '',
      age: formData.age || '',
      living_arrangement: formData.living_arrangement || '',
      primary_earning_member: formData.primary_earning_member || '',
      type_of_business: formData.type_of_business || '',
      banking_experience: formData.banking_experience || '',
      source_portal: formData.source_portal || '',
      interview_date: toISTDateYMD(formData.date_time),
      interview_time: formData.date_time.split('T')[1] || '10:00',
      date_time: formData.date_time,
    });
  };

  const inputCls = name =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`;

  const selectCls = name =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors[name] ? 'border-red-400' : 'border-gray-300'}`;

  const Label = ({ children, required }) => (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New Interview</h2>
            <p className="text-xs text-gray-400">Fill in candidate details</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <form className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label required>Candidate Name</Label>
              <input name="candidate_name" value={formData.candidate_name} onChange={inp} className={inputCls('candidate_name')} />
              {errors.candidate_name && <p className="text-xs text-red-500 mt-0.5">{errors.candidate_name}</p>}
            </div>
            <div>
              <Label required>Mobile Number</Label>
              <input name="mobile_number" type="tel" maxLength={10} value={formData.mobile_number} onChange={inp} className={inputCls('mobile_number')} />
              {errors.mobile_number && <p className="text-xs text-red-500 mt-0.5">{errors.mobile_number}</p>}
            </div>
            <div>
              <Label>Alternate Number</Label>
              <input name="alternate_number" type="tel" maxLength={10} value={formData.alternate_number} onChange={inp} className={inputCls('alternate_number')} />
            </div>
            <div>
              <Label required>Gender</Label>
              <select name="gender" value={formData.gender} onChange={inp} className={selectCls('gender')}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors.gender && <p className="text-xs text-red-500 mt-0.5">{errors.gender}</p>}
            </div>
            <div>
              <Label>Age</Label>
              <input name="age" type="number" value={formData.age} onChange={inp} className={inputCls('age')} />
            </div>
            <div>
              <Label>Marital Status</Label>
              <select name="marital_status" value={formData.marital_status} onChange={inp} className={selectCls('marital_status')}>
                <option value="">Select...</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div>
              <Label required>Qualification</Label>
              <select name="qualification" value={formData.qualification} onChange={inp} className={selectCls('qualification')}>
                <option value="">Select...</option>
                {['10th','12th','Diploma','Graduate','Post Graduate','PhD'].map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              {errors.qualification && <p className="text-xs text-red-500 mt-0.5">{errors.qualification}</p>}
            </div>
            <div>
              <Label>Experience Type</Label>
              <select name="experience_type" value={formData.experience_type} onChange={inp} className={selectCls('experience_type')}>
                <option value="fresher">Fresher</option>
                <option value="experienced">Experienced</option>
              </select>
            </div>
            <div>
              <Label>Total Experience (yrs)</Label>
              <input name="total_experience" type="number" step="0.5" min="0" value={formData.total_experience} onChange={inp} className={inputCls('total_experience')} />
            </div>
            <div>
              <Label>City</Label>
              <input name="city" value={formData.city} onChange={inp} className={inputCls('city')} />
            </div>
            <div>
              <Label>State</Label>
              <input name="state" value={formData.state} onChange={inp} className={inputCls('state')} />
            </div>
          </div>

          {/* Job details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label required>Job Opening</Label>
              <select name="job_opening" value={formData.job_opening} onChange={inp} className={selectCls('job_opening')}>
                <option value="">Select...</option>
                {jobOpeningOptions?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors.job_opening && <p className="text-xs text-red-500 mt-0.5">{errors.job_opening}</p>}
            </div>
            <div>
              <Label required>Interview Type</Label>
              <select name="interview_type" value={formData.interview_type} onChange={inp} className={selectCls('interview_type')}>
                <option value="">Select...</option>
                {interviewTypeOptions?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors.interview_type && <p className="text-xs text-red-500 mt-0.5">{errors.interview_type}</p>}
            </div>
            <div>
              <Label>Source Portal</Label>
              <select name="source_portal" value={formData.source_portal} onChange={inp} className={selectCls('source_portal')}>
                <option value="">Select...</option>
                {sourcePortalOptions?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <Label>Initial Status</Label>
              <select name="status" value={formData.status} onChange={inp} className={selectCls('status')}>
                <option value="">Select...</option>
                {statusOptions?.map(o => <option key={o} value={o}>{fmtStatus(o)}</option>)}
              </select>
            </div>
            <div>
              <Label required>Date &amp; Time</Label>
              <input name="date_time" type="datetime-local" value={formData.date_time} onChange={inp} className={inputCls('date_time')} />
              {errors.date_time && <p className="text-xs text-red-500 mt-0.5">{errors.date_time}</p>}
            </div>
          </div>

          {/* Salary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Current Salary (₹)</Label>
              <input name="old_salary" type="number" value={formData.old_salary} onChange={inp} className={inputCls('old_salary')} />
            </div>
            <div>
              <Label>Offered Salary (₹/month)</Label>
              <input name="monthly_salary_offered" type="number" value={formData.monthly_salary_offered} onChange={inp} className={inputCls('monthly_salary_offered')} />
            </div>
          </div>

          {/* Living / Banking */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Living Arrangement</Label>
              <select name="living_arrangement" value={formData.living_arrangement} onChange={inp} className={selectCls('living_arrangement')}>
                <option value="">Select...</option>
                {['Own House','Rented','PG','Family'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label>Primary Earning Member</Label>
              <select name="primary_earning_member" value={formData.primary_earning_member} onChange={inp} className={selectCls('primary_earning_member')}>
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <Label>Type of Business</Label>
              <input name="type_of_business" value={formData.type_of_business} onChange={inp} className={inputCls('type_of_business')} />
            </div>
            <div>
              <Label>Banking Experience</Label>
              <select name="banking_experience" value={formData.banking_experience} onChange={inp} className={selectCls('banking_experience')}>
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </form>

        <div className="border-t p-6 flex gap-3 shrink-0 bg-white">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : 'Create Interview'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsModal
// ─────────────────────────────────────────────────────────────────────────────
function SettingsModal({ open, onClose }) {
  const [declineReasons, setDeclineReasons] = useState([]);
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    if (open) {
      interviewSettingsAPI?.getDeclineReasons?.()
        .then(r => { if (r?.success) setDeclineReasons(r.data || []); })
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Interview Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Decline Reasons</h4>
          <div className="flex gap-2 mb-4">
            <input
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newReason.trim()) { setDeclineReasons(p => [...p, newReason.trim()]); setNewReason(''); } }}
              placeholder="Add new decline reason..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              disabled={!newReason.trim()}
              onClick={() => { if (newReason.trim()) { setDeclineReasons(p => [...p, newReason.trim()]); setNewReason(''); } }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <div className="space-y-2">
            {declineReasons.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No decline reasons configured</p>
            )}
            {declineReasons.map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700">{r}</span>
                <button onClick={() => setDeclineReasons(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-0.5">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t p-4 shrink-0">
          <button onClick={onClose} className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchBar
// ─────────────────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, count }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative max-w-xs flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Search candidates..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
      <span className="text-sm text-gray-500 whitespace-nowrap">{count} candidate{count !== 1 ? 's' : ''}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main InterviewPanel Component
// ─────────────────────────────────────────────────────────────────────────────
const InterviewPanel = () => {
  const navigate = useNavigate();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Navigation state ────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState('dashboard');
  const [subTab, setSubTab] = useState('today');

  // ── Dropdown data ────────────────────────────────────────────────────────────
  const [statusOptions, setStatusOptions] = useState([]);
  const [statusOptionsWithSubs, setStatusOptionsWithSubs] = useState([]);
  const [jobOpeningOptions, setJobOpeningOptions] = useState([]);
  const [interviewTypeOptions, setInterviewTypeOptions] = useState([]);
  const [sourcePortalOptions, setSourcePortalOptions] = useState([]);
  const [declineReasons, setDeclineReasons] = useState([]);

  // ── Reassignment state ───────────────────────────────────────────────────────
  const [reassignmentRequests, setReassignmentRequests] = useState([]);

  // ── Permissions ──────────────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState({});

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [forwardModal, setForwardModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [declineModal, setDeclineModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [auditModal, setAuditModal] = useState(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [createDrawer, setCreateDrawer] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [duplicateModal, setDuplicateModal] = useState({ visible: false, data: null });

  // ── Permission helpers ────────────────────────────────────────────────────────
  const isSuperAdmin = useCallback(() => {
    const des = (localStorage.getItem('designation') || '').toLowerCase();
    const role = (localStorage.getItem('roleName') || localStorage.getItem('userRole') || localStorage.getItem('role') || '').toLowerCase();
    const admins = ['admin','super admin','superadmin','administrator'];
    if (admins.includes(des) || admins.includes(role)) return true;
    const perms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    if (Array.isArray(perms)) {
      for (const p of perms) {
        if (p?.page === '*' || p?.page === 'Global') return true;
        const isIvPage = p?.page === 'interview' || p?.page === 'interviews';
        if (isIvPage) {
          const acts = p?.actions;
          if (acts === '*' || acts === 'all') return true;
          if (Array.isArray(acts) && (acts.includes('*') || acts.includes('all'))) return true;
        }
      }
    }
    return false;
  }, []);

  const checkPerms = useCallback(() => {
    if (isSuperAdmin()) return { can_view_all: true, can_delete: true, can_add: true, can_edit: true };
    const perms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    const has = action => Array.isArray(perms) && perms.some(p => {
      const isIv = p?.page === 'interview' || p?.page === 'interviews';
      if (!isIv) return false;
      return Array.isArray(p?.actions)
        ? p.actions.includes(action) || p.actions.includes('all')
        : p?.actions === action || p?.actions === 'all';
    });
    return { can_view_all: has('all'), can_delete: has('delete'), can_add: true, can_edit: true };
  }, [isSuperAdmin]);

  useEffect(() => {
    setPermissions(checkPerms());
    const handler = () => setPermissions(checkPerms());
    window.addEventListener('permissionsUpdated', handler);
    return () => window.removeEventListener('permissionsUpdated', handler);
  }, [checkPerms]);

  // ── Data loading ──────────────────────────────────────────────────────────────
  const loadInterviews = useCallback(async () => {
    try {
      setLoading(true);
      const data = await API.interviews.getInterviews(1, 1000);
      setInterviews(data || []);
    } catch (err) {
      console.error('Failed to load interviews:', err);
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDropdownOptions = useCallback(async () => {
    try {
      const [jobRes, typeRes, srcRes, statusRes] = await Promise.allSettled([
        interviewSettingsAPI.getJobOpenings(),
        interviewSettingsAPI.getInterviewTypes(),
        interviewSettingsAPI.getSourcePortals(),
        interviewSettingsAPI.getStatuses(),
      ]);

      const extractList = res => res.status === 'fulfilled' && res.value?.success
        ? res.value.data?.map(i => typeof i === 'object' ? (i.name || i.value || String(i)) : i) || []
        : [];

      setJobOpeningOptions(extractList(jobRes));
      setInterviewTypeOptions(extractList(typeRes));
      setSourcePortalOptions(extractList(srcRes));

      if (statusRes.status === 'fulfilled' && statusRes.value?.success) {
        const statuses = statusRes.value.data || [];
        setStatusOptionsWithSubs(statuses);
        setStatusOptions(statuses.map(s => s.name || s.value || s));
      }

      try {
        const decRes = await interviewSettingsAPI.getDeclineReasons?.();
        if (decRes?.success) setDeclineReasons(decRes.data || []);
      } catch {}
    } catch (err) {
      console.error('Failed to load dropdown options:', err);
    }
  }, []);

  const loadReassignments = useCallback(async () => {
    try {
      const res = await API.interviews.getAllReassignments();
      if (res?.success && res.data) setReassignmentRequests(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadInterviews();
    loadDropdownOptions();
    loadReassignments();
    const onFocus = () => loadDropdownOptions();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadInterviews, loadDropdownOptions, loadReassignments]);

  // ── Computed data ─────────────────────────────────────────────────────────────
  const today = new Date().toDateString();
  const canViewAll = permissions.can_view_all || isSuperAdmin();
  const currentUserId = localStorage.getItem('userId');

  const visibleInterviews = useMemo(() => {
    if (canViewAll) return interviews;
    return interviews.filter(i =>
      i.created_by === currentUserId || i.created_by_id === currentUserId || i.assigned_to === currentUserId
    );
  }, [interviews, canViewAll, currentUserId]);

  const byStage = useMemo(() => {
    const result = { interview: [], round_2: [], job_offered: [], training: [], hired: [], rejected: [] };
    visibleInterviews.forEach(i => {
      const stage = getStageFromStatus(i.status);
      if (result[stage]) result[stage].push(i);
    });
    return result;
  }, [visibleInterviews]);

  const interviewSubLists = useMemo(() => ({
    today:    byStage.interview.filter(i => i.interview_date && new Date(i.interview_date).toDateString() === today),
    upcoming: byStage.interview.filter(i => i.interview_date && new Date(i.interview_date) > new Date()),
    no_show:  byStage.interview.filter(i => i.status?.toLowerCase().includes('no_show') || i.status?.toLowerCase().includes('no show')),
    round_2:  byStage.round_2,
  }), [byStage, today]);

  const applySearch = useCallback(list => {
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(i =>
      i.candidate_name?.toLowerCase().includes(q) ||
      i.mobile_number?.includes(q) ||
      i.job_opening?.toLowerCase().includes(q) ||
      i.created_by?.toLowerCase().includes(q) ||
      i.status?.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const counts = useMemo(() => ({
    interview:   byStage.interview.length + byStage.round_2.length,
    job_offered: byStage.job_offered.length,
    training:    byStage.training.length,
    hired:       byStage.hired.length,
    rejected:    byStage.rejected.length,
    audit_logs:  reassignmentRequests.filter(r => r.status === 'pending').length,
  }), [byStage, reassignmentRequests]);

  const currentList = useMemo(() => {
    if (mainTab === 'interview') {
      let base;
      if (subTab === 'round_2') base = interviewSubLists.round_2;
      else if (subTab === 'no_show') base = interviewSubLists.no_show;
      else if (subTab === 'upcoming') base = interviewSubLists.upcoming;
      else base = interviewSubLists.today;
      return applySearch(base);
    }
    return applySearch(byStage[mainTab] || []);
  }, [mainTab, subTab, interviewSubLists, byStage, applySearch]);

  const currentStage = mainTab === 'interview' && subTab === 'round_2' ? 'round_2' : mainTab;

  // ── Status resolution ─────────────────────────────────────────────────────────
  const resolveStatus = useCallback(targetStage => {
    const kws = STAGE_KW[targetStage] || [];
    const match = statusOptionsWithSubs.find(s =>
      kws.some(k => (s.name || '').toLowerCase().replace(/_/g, ' ').includes(k))
    );
    if (match) return match.name;
    const fallbacks = {
      round_2: 'round_2', job_offered: 'job_offered', training: 'training',
      hired: 'hired', rejected: 'rejected', no_show: 'no_show', rescheduled: 'rescheduled',
    };
    return fallbacks[targetStage] || targetStage;
  }, [statusOptionsWithSubs]);

  // ── Stage transition handlers ─────────────────────────────────────────────────
  const handleForwardStage = async (interview, targetStage, remark) => {
    try {
      setSaving(true);
      const newStatus = resolveStatus(targetStage);
      await API.interviews.updateInterview(interview._id, {
        status: newStatus,
        ...(remark ? { forward_remark: remark } : {}),
      });
      setInterviews(prev => prev.map(i => i._id === interview._id ? { ...i, status: newStatus } : i));
      setForwardModal(null);
    } catch (err) {
      alert('Failed to update stage: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleReschedule = async (interview, newDate, reason) => {
    try {
      setSaving(true);
      await API.interviews.updateInterview(interview._id, {
        interview_date: newDate.split('T')[0],
        interview_time: newDate.split('T')[1] || '10:00',
        date_time: newDate,
        reschedule_reason: reason,
      });
      setInterviews(prev => prev.map(i =>
        i._id === interview._id
          ? { ...i, interview_date: newDate.split('T')[0], interview_time: newDate.split('T')[1] }
          : i
      ));
      setRescheduleModal(null);
    } catch (err) {
      alert('Failed to reschedule: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = async (interview, reason, remarks) => {
    try {
      setSaving(true);
      const newStatus = resolveStatus('rejected');
      await API.interviews.updateInterview(interview._id, {
        status: newStatus,
        decline_reason: reason,
        decline_remarks: remarks,
      });
      setInterviews(prev => prev.map(i =>
        i._id === interview._id ? { ...i, status: newStatus, decline_reason: reason } : i
      ));
      setDeclineModal(null);
    } catch (err) {
      alert('Failed to decline: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleNoShow = async interview => {
    try {
      const newStatus = resolveStatus('no_show');
      await API.interviews.updateInterview(interview._id, { status: newStatus });
      setInterviews(prev => prev.map(i => i._id === interview._id ? { ...i, status: newStatus } : i));
    } catch (err) {
      alert('Failed to mark no-show: ' + (err.message || err));
    }
  };

  const handleWhatsApp = interview => {
    const msg = encodeURIComponent(
      `Hi ${interview.candidate_name}, you have been scheduled for an interview for the role of ${interview.job_opening || 'the position'}. Please confirm your attendance.`
    );
    window.open(`https://wa.me/${interview.mobile_number}?text=${msg}`, '_blank');
  };

  // ── Create interview ──────────────────────────────────────────────────────────
  const handleCreateSubmit = async data => {
    try {
      setSaving(true);
      const dupCheck = await API.interviews.checkDuplicatePhone(data.mobile_number).catch(() => null);
      if (dupCheck?.isDuplicate || dupCheck?.is_duplicate) {
        setDuplicateModal({ visible: true, data });
        setCreateDrawer(false);
        return;
      }
      await API.interviews.createInterview(data);
      setCreateDrawer(false);
      await loadInterviews();
      setMainTab('interview');
      setSubTab('today');
    } catch (err) {
      alert('Failed to create interview: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleProceedDuplicate = async () => {
    if (!duplicateModal.data) return;
    try {
      setSaving(true);
      await API.interviews.createInterview(duplicateModal.data);
      setDuplicateModal({ visible: false, data: null });
      await loadInterviews();
      setMainTab('interview');
      setSubTab('today');
    } catch (err) {
      alert('Failed to create interview: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInterview = async (interviewId, updatedData) => {
    try {
      await API.interviews.updateInterview(interviewId, updatedData);
      await loadInterviews();
      setSelectedInterview(null);
    } catch (err) {
      alert('Failed to save: ' + (err.message || err));
      throw err;
    }
  };

  // ── Reassignment handlers ─────────────────────────────────────────────────────
  const handleApproveReassignment = async requestId => {
    try {
      await API.interviews.approveReassignment(requestId, localStorage.getItem('userId'));
      await loadReassignments();
    } catch (err) {
      alert('Failed to approve: ' + (err.message || err));
    }
  };

  const handleRejectReassignment = async (requestId, remarks = 'Rejected') => {
    try {
      await API.interviews.rejectReassignment(requestId, localStorage.getItem('userId'), remarks);
      await loadReassignments();
    } catch (err) {
      alert('Failed to reject: ' + (err.message || err));
    }
  };

  // ── Tab config ────────────────────────────────────────────────────────────────
  const mainTabs = [
    { id: 'dashboard',   label: 'Dashboard',   icon: BarChart2 },
    { id: 'interview',   label: 'Interview',   icon: Users,         count: counts.interview },
    { id: 'job_offered', label: 'Job Offered', icon: Briefcase,     count: counts.job_offered },
    { id: 'training',    label: 'Training',    icon: Award,         count: counts.training },
    { id: 'hired',       label: 'Hired',       icon: CheckCircle,   count: counts.hired },
    { id: 'rejected',    label: 'Rejected',    icon: XCircle,       count: counts.rejected },
    { id: 'audit_logs',  label: 'Audit Logs',  icon: ClipboardList, count: counts.audit_logs },
  ];

  const interviewSubTabs = [
    { id: 'today',    label: 'Today',    count: interviewSubLists.today.length },
    { id: 'upcoming', label: 'Upcoming', count: interviewSubLists.upcoming.length },
    { id: 'no_show',  label: 'No-Show',  count: interviewSubLists.no_show.length },
    { id: 'round_2',  label: 'Round 2',  count: interviewSubLists.round_2.length },
  ];

  const pendingReassignments  = reassignmentRequests.filter(r => r.status === 'pending');
  const auditedReassignments  = reassignmentRequests.filter(r => r.status !== 'pending');

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Interview Panel</h1>
            <p className="text-sm text-gray-500">
              {visibleInterviews.length} total · {byStage.hired.length} hired · {byStage.rejected.length} rejected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadInterviews(); loadReassignments(); }}
              title="Refresh"
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setSettingsModal(true)}
              title="Settings"
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => setCreateDrawer(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} /> New Interview
            </button>
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {mainTabs.map(tab => {
            const Icon = tab.icon;
            const active = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setMainTab(tab.id); setSearchTerm(''); }}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={15} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="p-6">

        {/* DASHBOARD */}
        {mainTab === 'dashboard' && (
          <DashboardView interviews={visibleInterviews} />
        )}

        {/* INTERVIEW (with sub-tabs) */}
        {mainTab === 'interview' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {interviewSubTabs.map(st => {
                const active = subTab === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => setSubTab(st.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {st.label}
                    {st.count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {st.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <SearchBar value={searchTerm} onChange={setSearchTerm} count={currentList.length} />

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <InterviewTable
                interviews={currentList}
                stage={currentStage}
                reassignments={reassignmentRequests}
                onForward={(iv, stage) => setForwardModal({ interview: iv, targetStage: stage })}
                onReschedule={iv => setRescheduleModal(iv)}
                onDecline={iv => setDeclineModal(iv)}
                onNoShow={handleNoShow}
                onViewDetails={iv => setDetailModal(iv)}
                onWhatsApp={handleWhatsApp}
                onEditInterview={iv => setSelectedInterview(iv)}
              />
            )}
          </div>
        )}

        {/* JOB OFFERED / TRAINING / HIRED / REJECTED */}
        {['job_offered','training','hired','rejected'].includes(mainTab) && (
          <div className="space-y-4">
            <SearchBar value={searchTerm} onChange={setSearchTerm} count={currentList.length} />
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <InterviewTable
                interviews={currentList}
                stage={mainTab}
                reassignments={reassignmentRequests}
                onForward={(iv, stage) => setForwardModal({ interview: iv, targetStage: stage })}
                onReschedule={iv => setRescheduleModal(iv)}
                onDecline={iv => setDeclineModal(iv)}
                onNoShow={handleNoShow}
                onViewDetails={iv => setDetailModal(iv)}
                onWhatsApp={handleWhatsApp}
                onEditInterview={iv => setSelectedInterview(iv)}
              />
            )}
          </div>
        )}

        {/* AUDIT LOGS */}
        {mainTab === 'audit_logs' && (
          <div className="space-y-6">
            {/* Pending */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Pending Reassignment Requests
                  {pendingReassignments.length > 0 && (
                    <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                      {pendingReassignments.length}
                    </span>
                  )}
                </h3>
                <button onClick={loadReassignments} className="text-sm text-blue-600 hover:underline">
                  Refresh
                </button>
              </div>
              {pendingReassignments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pendingReassignments.map(req => (
                    <div key={req._id || req.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-800">
                          {req.candidate_name || req.interview_name || 'Unknown Candidate'}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          <span className="font-medium">{req.from_user || req.requested_by || '—'}</span>
                          {' → '}
                          <span className="font-medium">{req.to_user || req.assigned_to || '—'}</span>
                        </p>
                        {req.reason && <p className="text-xs text-gray-400 mt-0.5">Reason: {req.reason}</p>}
                        {req.created_at && (
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateUtil(req.created_at)}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleApproveReassignment(req._id || req.id)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectReassignment(req._id || req.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Processed */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold text-gray-900">
                  Processed Reassignments
                  <span className="ml-2 text-sm font-normal text-gray-500">({auditedReassignments.length})</span>
                </h3>
              </div>
              {auditedReassignments.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No processed reassignments</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Candidate','From','To','Status','Reason','Date'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {auditedReassignments.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.candidate_name || r.interview_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{r.from_user || r.requested_by || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{r.to_user || r.assigned_to || '—'}</td>
                          <td className="px-4 py-3">
                            <Tag label={r.status || 'Unknown'} color={r.status === 'approved' ? 'green' : 'red'} />
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.reason || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {r.updated_at ? formatDateUtil(r.updated_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}

      {forwardModal && (
        <ForwardRemarkModal
          interview={forwardModal.interview}
          targetStage={forwardModal.targetStage}
          onConfirm={(finalStage, remark) => handleForwardStage(forwardModal.interview, finalStage, remark)}
          onClose={() => setForwardModal(null)}
        />
      )}

      {rescheduleModal && (
        <RescheduleModal
          interview={rescheduleModal}
          onConfirm={(date, reason) => handleReschedule(rescheduleModal, date, reason)}
          onClose={() => setRescheduleModal(null)}
        />
      )}

      {declineModal && (
        <DeclineModal
          interview={declineModal}
          declineReasons={declineReasons}
          onConfirm={(reason, remarks) => handleDecline(declineModal, reason, remarks)}
          onClose={() => setDeclineModal(null)}
        />
      )}

      {detailModal && (
        <CandidateDetailModal
          interview={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}

      {auditModal && (
        <AuditHistoryModal
          interview={auditModal}
          reassignments={reassignmentRequests}
          onClose={() => setAuditModal(null)}
        />
      )}

      <SettingsModal open={settingsModal} onClose={() => setSettingsModal(false)} />

      <CreateInterviewDrawer
        open={createDrawer}
        onClose={() => setCreateDrawer(false)}
        onSubmit={handleCreateSubmit}
        statusOptions={statusOptions}
        jobOpeningOptions={jobOpeningOptions}
        interviewTypeOptions={interviewTypeOptions}
        sourcePortalOptions={sourcePortalOptions}
        saving={saving}
      />

      {selectedInterview && (
        <EditInterview
          interview={selectedInterview}
          onSave={handleSaveInterview}
          onClose={() => setSelectedInterview(null)}
          statusOptions={statusOptions}
          statusOptionsWithSubs={statusOptionsWithSubs}
          jobOpeningOptions={jobOpeningOptions}
          interviewTypeOptions={interviewTypeOptions}
          sourcePortalOptions={sourcePortalOptions}
        />
      )}

      {duplicateModal.visible && (
        <DuplicateInterviewModal
          isOpen={duplicateModal.visible}
          onClose={() => setDuplicateModal({ visible: false, data: null })}
          onProceed={handleProceedDuplicate}
          phoneNumber={duplicateModal.data?.mobile_number}
        />
      )}
    </div>
  );
};

export default InterviewPanel;
