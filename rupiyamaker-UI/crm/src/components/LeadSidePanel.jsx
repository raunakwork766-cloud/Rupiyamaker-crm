import React, { useState, useEffect, useMemo } from 'react';
import RemarkSection from './Remark.jsx';
import {
  MSGR,
  formatDateLabel,
  getInitials,
  getAvatarColor,
  getBubbleRadius,
  scrollStyles,
  DatePill,
  RelativeTime,
} from './messengerChatStyles.jsx';

const API_BASE_URL = '/api';

const getStatusName = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return value.name || value.label || '';
  return String(value);
};

function StatusTimeline({ leadData, refreshToken = 0 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const leadId = leadData?._id || leadData?.id;
  const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
  const currentUserId = userId;

  const currentStatus = getStatusName(leadData?.status);
  const currentSubStatus = getStatusName(leadData?.sub_status);

  const fetchStatusRemarks = async () => {
    if (!leadId || !userId) return;

    setLoading(true);
    try {
      const isLoginLead = leadData && (leadData.original_lead_id || leadData.login_created_at);
      const url = isLoginLead
        ? `${API_BASE_URL}/lead-login/login-leads/${leadId}/activities?user_id=${userId}&limit=100`
        : `${API_BASE_URL}/leads/${leadId}/activities?user_id=${userId}&limit=100`;

      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const remarkItems = (data || []).filter((a) => {
        const type = a.action || a.activity_type || '';
        if (!['status_change', 'status_changed', 'sub_status_change'].includes(type)) return false;
        const remark = a.details?.remark;
        return typeof remark === 'string' && remark.trim().length > 0;
      });

      setItems(remarkItems);
    } catch (err) {
      console.error('Status remarks error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusRemarks();
  }, [leadId, refreshToken]);

  const grouped = useMemo(() => {
    const groups = [];
    let currentDate = null;

    items.forEach((item) => {
      const dateKey = new Date(item.created_at).toDateString();
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ type: 'date', label: formatDateLabel(item.created_at), key: `date-${dateKey}` });
      }
      groups.push({ type: 'item', data: item, key: item._id || `${item.created_at}-${item.activity_type}` });
    });

    return groups;
  }, [items]);

  const statusLine = [currentStatus, currentSubStatus].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: MSGR.chatBg }}>
      <style>{scrollStyles}</style>

      {statusLine && (
        <div className="px-4 py-2 text-center border-b flex-shrink-0" style={{ borderColor: MSGR.border, backgroundColor: MSGR.inputBg }}>
          <p className="text-[11px] font-medium truncate" style={{ color: MSGR.muted }}>
            Current: <span style={{ color: MSGR.text }}>{statusLine}</span>
          </p>
        </div>
      )}

      <div className="msgr-scroll flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {loading && items.length === 0 && (
          <p className="text-center text-sm py-12" style={{ color: MSGR.muted }}>Loading...</p>
        )}

        {!loading && items.length === 0 && (
          <p className="text-center text-sm py-12 px-6" style={{ color: MSGR.muted }}>
            Status change remarks will show here
          </p>
        )}

        <div>
          {grouped.map((entry, index) => {
            if (entry.type === 'date') {
              return <DatePill key={entry.key} label={entry.label} />;
            }

            const activity = entry.data;
            const remark = (activity.details?.remark || '').trim();
            const user = activity.user_name || 'User';
            const isMine = String(activity.user_id) === String(currentUserId);

            const prevEntry = grouped[index - 1];
            const nextEntry = grouped[index + 1];
            const prevActivity = prevEntry?.type === 'item' ? prevEntry.data : null;
            const nextActivity = nextEntry?.type === 'item' ? nextEntry.data : null;

            const sameAsPrev = prevActivity && prevActivity.user_id === activity.user_id;
            const sameAsNext = nextActivity && nextActivity.user_id === activity.user_id;
            const showAvatar = !isMine && !sameAsPrev;
            const radius = getBubbleRadius(isMine, sameAsPrev, sameAsNext);

            return (
              <div
                key={entry.key}
                className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${sameAsPrev ? 'mt-[2px]' : 'mt-3'}`}
              >
                <div className="w-7 flex-shrink-0 self-end">
                  {showAvatar ? (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                      style={{ backgroundColor: getAvatarColor(user) }}
                    >
                      {getInitials(user)}
                    </div>
                  ) : (
                    <div className="w-7 h-7" />
                  )}
                </div>

                <div className={`max-w-[78%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {!isMine && showAvatar && (
                    <span className="text-[11px] font-medium mb-[2px] px-1" style={{ color: MSGR.muted }}>
                      {user}
                    </span>
                  )}

                  <div
                    className={`px-3 py-2 ${radius}`}
                    style={{
                      backgroundColor: isMine ? MSGR.blue : MSGR.received,
                      color: isMine ? '#fff' : MSGR.text,
                    }}
                  >
                    <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">{remark}</p>
                  </div>
                  <RelativeTime
                    time={activity.created_at}
                    className="text-[9px] mt-0.5 px-1 leading-none"
                    style={{ color: MSGR.muted }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LeadSidePanel({ leadData, canEdit = true, refreshToken = 0 }) {
  const [activeTab, setActiveTab] = useState('remarks');

  const leadName =
    leadData?.name ||
    leadData?.customer_name ||
    leadData?.full_name ||
    leadData?.custom_lead_id ||
    'Lead';

  const leadInitials = getInitials(leadName);

  return (
    <div
      className="w-[360px] min-w-[360px] flex-shrink-0 flex flex-col overflow-hidden h-full"
      style={{
        backgroundColor: MSGR.bg,
        borderLeft: `1px solid ${MSGR.border}`,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ backgroundColor: MSGR.bg, borderBottom: `1px solid ${MSGR.border}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ring-2 ring-white shadow-sm"
            style={{ backgroundColor: MSGR.blue }}
          >
            {leadInitials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold truncate leading-tight" style={{ color: MSGR.text }}>
              {leadName}
            </h3>
            <p className="text-[11px] truncate mt-0.5" style={{ color: MSGR.muted }}>
              Lead conversation
            </p>
          </div>
        </div>

        <div className="flex mt-3 -mb-px">
          {[
            { id: 'remarks', label: 'Remarks' },
            { id: 'status', label: 'Status' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 pb-2.5 text-[13px] font-semibold transition-colors relative"
              style={{ color: activeTab === tab.id ? MSGR.blue : MSGR.muted }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                  style={{ backgroundColor: MSGR.blue }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'remarks' ? (
          <RemarkSection leadData={leadData} canEdit={canEdit} refreshToken={refreshToken} />
        ) : (
          <StatusTimeline leadData={leadData} refreshToken={refreshToken} />
        )}
      </div>
    </div>
  );
}
