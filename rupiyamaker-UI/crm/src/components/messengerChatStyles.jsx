import React from 'react';

export const MSGR = {
  blue: '#0084ff',
  bg: '#ffffff',
  chatBg: '#ffffff',
  received: '#e4e6eb',
  text: '#050505',
  muted: '#65676b',
  border: '#e4e6eb',
  inputBg: '#f0f2f5',
};

export const formatTime = (time) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(time));

export const formatRelativeTime = (time) => {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diffSec < 45) return 'Just now';
  if (diffSec < 90) return '1 min ago';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr === 1 ? '1 hr ago' : `${diffHr} hr ago`;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, yesterday)) return 'Yesterday';

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;

  return formatDateLabel(time);
};

export function RelativeTime({ time, className = '', style = {} }) {
  const [, tick] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, [time]);

  return (
    <span className={className} style={style}>
      {formatRelativeTime(time)}
    </span>
  );
}

export const formatDateLabel = (time) => {
  const date = new Date(time);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    timeZone: 'Asia/Kolkata',
  }).format(date);
};

export const getInitials = (name) => {
  if (!name || name === 'User') return '?';
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const AVATAR_COLORS = ['#0084ff', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2'];

export const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

export const getBubbleRadius = (isMine, sameAsPrev, sameAsNext) => {
  if (isMine) {
    if (sameAsPrev && sameAsNext) return 'rounded-[18px] rounded-r-[6px]';
    if (sameAsPrev) return 'rounded-[18px] rounded-tr-[6px] rounded-br-[6px]';
    if (sameAsNext) return 'rounded-[18px] rounded-br-[6px]';
    return 'rounded-[18px] rounded-br-[6px]';
  }
  if (sameAsPrev && sameAsNext) return 'rounded-[18px] rounded-l-[6px]';
  if (sameAsPrev) return 'rounded-[18px] rounded-tl-[6px] rounded-bl-[6px]';
  if (sameAsNext) return 'rounded-[18px] rounded-bl-[6px]';
  return 'rounded-[18px] rounded-bl-[6px]';
};

export const scrollStyles = `
  .msgr-scroll::-webkit-scrollbar { width: 4px; }
  .msgr-scroll::-webkit-scrollbar-track { background: transparent; }
  .msgr-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 99px; }
  .msgr-scroll::-webkit-scrollbar-button { display: none; }
`;

export function DatePill({ label }) {
  return (
    <div className="flex justify-center py-2">
      <span
        className="px-3 py-1 rounded-full text-[11px] font-medium text-[#65676b]"
        style={{ backgroundColor: '#e4e6eb' }}
      >
        {label}
      </span>
    </div>
  );
}
