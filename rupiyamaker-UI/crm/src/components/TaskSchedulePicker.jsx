/**
 * TaskSchedulePicker - Schedule Date + Time picker
 *   - Date: button dropdown with Today / Tomorrow / Custom (+ inline calendar)
 *   - Time: text input with filter + scrollable dropdown (08:00 AM – 08:00 PM, 30-min steps)
 *           When no filter typed, only shows slots >= current time (upcoming slots first)
 */
import { useState, useRef, useEffect } from "react";
import { formatDate } from '../utils/dateUtils';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ---------- time slot helpers (identical to task_creation.html) ----------

// Office hours: 8 AM to 8 PM, 30-min steps
const TIME_SLOTS = (() => {
  const slots = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 20 && minute > 0) break;
      const d = new Date(2026, 0, 1, hour, minute, 0, 0);
      slots.push(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
  }
  return slots;
})();

/**
 * Returns slots at or after the current time.
 * If already past 8 PM, returns empty array (caller can fall back to all slots).
 */
function getUpcomingSlots() {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return TIME_SLOTS.filter(slot => {
    const match = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return true;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return (h * 60 + m) >= nowMinutes;
  });
}

/**
 * Round current time UP to nearest 30-min slot.
 * Office hours: min 08:00 AM, max 08:00 PM.
 */
export function getNearestTimeSlot(baseDate) {
  const probe = new Date(baseDate.getTime());
  probe.setSeconds(0, 0);
  if (probe.getHours() < 8) return '08:00 AM';
  // Past 8 PM → cap at 08:00 PM
  if (probe.getHours() >= 20) return '08:00 PM';
  const roundedMinutes = probe.getMinutes() <= 30 ? 30 : 60;
  if (roundedMinutes === 60) {
    probe.setHours(probe.getHours() + 1, 0, 0, 0);
  } else {
    probe.setMinutes(30, 0, 0);
  }
  // Re-check after rounding
  if (probe.getHours() >= 20) return '08:00 PM';
  const candidate = probe.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return TIME_SLOTS.indexOf(candidate) !== -1 ? candidate : '08:00 AM';
}

// ---------- date helpers ----------

function getToday() { return formatDate(new Date()); }

function getTomorrow() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return formatDate(t);
}

/**
 * Parse a formatted date string (e.g. "08 April 2026") to a JS Date object.
 * react-datepicker needs a real Date for its `selected` prop.
 */
function parseFormattedDate(str) {
  if (!str || str === '-') return new Date();
  // "08 April 2026" → "April 08, 2026" (universally parseable)
  const parts = str.trim().split(/\s+/);
  if (parts.length === 3) {
    const attempt = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
    if (!isNaN(attempt.getTime())) return attempt;
  }
  // Fallback: let the engine try
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

// ---------- time slot filter (matches getHourMatch in task_creation.html) ----------

function matchesFilter(slot, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const normalized = slot.toLowerCase();
  // Pure digit: match by hour number (e.g. "10" matches "10:00 AM", "10:30 AM")
  if (/^\d{1,2}$/.test(q)) {
    const hourPart = String(parseInt(normalized.split(':')[0], 10));
    return hourPart === String(parseInt(q, 10));
  }
  return normalized.includes(q);
}

// ---------- component ----------

/**
 * Props:
 *   date        {string}  - formatted date string, e.g. "08 April 2026"
 *   time        {string}  - time string, e.g. "10:00 AM"
 *   dateOption  {string}  - "today" | "tomorrow" | "custom"
 *   onDateChange(date, option) - called when date changes
 *   onTimeChange(time)         - called when time changes
 */
export default function TaskSchedulePicker({ date, time, dateOption, onDateChange, onTimeChange }) {
  const today = getToday();
  const tomorrow = getTomorrow();

  // dropdown visibility
  const [showDateMenu, setShowDateMenu]     = useState(false);
  const [showCalendar, setShowCalendar]     = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  // time input text (for filtering; resets to selected time on close)
  const [timeInput, setTimeInput] = useState(time || '');

  // calendar positioning
  const [calendarPos, setCalendarPos] = useState('below');

  const dateWrapRef = useRef(null);
  const timeWrapRef = useRef(null);

  // Keep timeInput in sync when `time` prop changes externally
  useEffect(() => {
    if (!showTimeDropdown) setTimeInput(time || '');
  }, [time, showTimeDropdown]);

  // Close date dropdowns on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (dateWrapRef.current && !dateWrapRef.current.contains(e.target)) {
        setShowDateMenu(false);
        setShowCalendar(false);
      }
      if (timeWrapRef.current && !timeWrapRef.current.contains(e.target)) {
        setShowTimeDropdown(false);
        setTimeInput(time || '');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [time]);

  // Calendar positioning (same logic as CreateTask.jsx)
  useEffect(() => {
    if (showCalendar && dateWrapRef.current) {
      const rect = dateWrapRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setCalendarPos(spaceBelow < 320 && rect.top > spaceBelow ? 'above' : 'below');
    }
  }, [showCalendar]);

  // -------- date handlers --------

  function handleDateQuick(option) {
    if (option === 'today') {
      onDateChange(today, 'today');
      setShowDateMenu(false);
      setShowCalendar(false);
    } else if (option === 'tomorrow') {
      onDateChange(tomorrow, 'tomorrow');
      setShowDateMenu(false);
      setShowCalendar(false);
    } else {
      // custom: close menu, open calendar
      setShowDateMenu(false);
      setShowCalendar(true);
    }
  }

  function handleCalendarPick(d) {
    onDateChange(formatDate(d), 'custom');
    setShowCalendar(false);
  }

  function toggleDateMenu() {
    if (showCalendar) {
      setShowCalendar(false);
      return;
    }
    setShowDateMenu(v => !v);
  }

  // -------- time handlers --------

  function handleTimeSelect(slot) {
    onTimeChange(slot);
    setTimeInput(slot);
    setShowTimeDropdown(false);
  }

  function handleTimeInputChange(e) {
    setTimeInput(e.target.value);
    setShowTimeDropdown(true);
  }

  function handleTimeInputFocus() {
    setTimeInput(''); // clear so user can type filter
    setShowTimeDropdown(true);
  }

  // When no filter typed → show upcoming slots (current time onwards)
  // When user types something → filter all slots by query
  const filteredSlots = timeInput.trim()
    ? TIME_SLOTS.filter(s => matchesFilter(s, timeInput))
    : (() => {
        const upcoming = getUpcomingSlots();
        // If all slots are past (e.g. after 8 PM) or no upcoming, show full list
        return upcoming.length > 0 ? upcoming : TIME_SLOTS;
      })();

  // -------- common styles --------

  const labelStyle = {
    fontSize: 10, fontWeight: 800, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.6px',
    marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4,
  };
  const accentBar = (
    <span style={{ display: 'inline-block', width: 3, height: 10, background: '#00aaff', borderRadius: 2 }} />
  );
  const dropdownStyle = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
    background: '#fff', border: '1px solid #dbeafe', borderRadius: 12,
    boxShadow: '0 15px 30px rgba(15,23,42,0.12)', padding: 8, zIndex: 62,
  };

  return (
    <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1.2fr 1fr', alignItems: 'start' }}>

      {/* ===== DATE COLUMN ===== */}
      <div style={{ position: 'relative' }} ref={dateWrapRef}>
        <div style={labelStyle}>{accentBar} 📅 Schedule Date</div>

        {/* Trigger button — mirrors .schedule-select-btn in HTML */}
        <button
          type="button"
          style={{
            width: '100%', border: '1.5px solid #94a3b8', background: '#fff',
            color: '#0f172a', minHeight: 42, borderRadius: 8,
            padding: '0 12px', fontSize: 13, fontWeight: 700, textAlign: 'left',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8,
          }}
          onClick={toggleDateMenu}
        >
          <span>{date || 'Select date'}</span>
          <span style={{ color: '#00aaff', fontSize: 11 }}>▾</span>
        </button>

        {/* Date option menu — mirrors .schedule-date-menu in HTML */}
        {showDateMenu && !showCalendar && (
          <div style={dropdownStyle}>
            {[
              { option: 'today',    label: 'Today',       meta: today    },
              { option: 'tomorrow', label: 'Tomorrow',    meta: tomorrow },
              { option: 'custom',   label: 'Custom Date', meta: 'Pick from calendar' },
            ].map(({ option, label, meta }) => (
              <button
                key={option}
                type="button"
                style={{
                  width: '100%', border: 'none', borderRadius: 8,
                  padding: '8px 10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left',
                  background: dateOption === option ? '#eff6ff' : 'transparent',
                }}
                onClick={() => handleDateQuick(option)}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{label}</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{meta}</span>
              </button>
            ))}
          </div>
        )}

        {/* Inline calendar (react-datepicker) */}
        {showCalendar && (
          <div
            style={{
              position: 'absolute',
              ...(calendarPos === 'above' ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
              left: 0,
              background: '#fff', border: '1px solid #dbeafe', borderRadius: 12,
              boxShadow: '0 15px 30px rgba(15,23,42,0.12)', padding: 8, zIndex: 62,
            }}
          >
            <DatePicker
              selected={parseFormattedDate(date)}
              onChange={handleCalendarPick}
              inline
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={100}
              dateFormat="dd MMM yyyy"
            />
          </div>
        )}
      </div>

      {/* ===== TIME COLUMN ===== */}
      <div style={{ position: 'relative' }} ref={timeWrapRef}>
        <div style={labelStyle}>{accentBar} ⏰ Schedule Time</div>

        {/* Text input that doubles as filter — mirrors #task-time in HTML */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={timeInput}
            placeholder="Select time"
            autoComplete="off"
            style={{
              width: '100%', border: '1.5px solid #94a3b8', minHeight: 42, borderRadius: 8,
              padding: '0 32px 0 12px', fontSize: 13, fontWeight: 700,
              color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box',
            }}
            onFocus={handleTimeInputFocus}
            onChange={handleTimeInputChange}
          />
          <button
            type="button"
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              width: 24, height: 24, borderRadius: '50%',
              border: 'none', background: '#eff6ff', color: '#0284c7',
              cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (showTimeDropdown) {
                setShowTimeDropdown(false);
                setTimeInput(time || '');
              } else {
                setTimeInput('');
                setShowTimeDropdown(true);
              }
            }}
          >
            ▾
          </button>
        </div>

        {/* Time slot dropdown — mirrors .time-dropdown in HTML */}
        {showTimeDropdown && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#fff', border: '1px solid #dbeafe', borderRadius: 12,
              boxShadow: '0 15px 30px rgba(15,23,42,0.12)',
              maxHeight: 200, overflowY: 'auto', padding: 6, zIndex: 60,
            }}
          >
            {filteredSlots.length === 0 ? (
              <div style={{ padding: 10, fontSize: 11, color: '#94a3b8' }}>No matching time slot</div>
            ) : (
              filteredSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  style={{
                    width: '100%', border: 'none', borderRadius: 6,
                    padding: '8px 10px', textAlign: 'left',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: slot === time ? '#e0f2fe' : 'transparent',
                    color: slot === time ? '#0369a1' : '#334155',
                  }}
                  onClick={() => handleTimeSelect(slot)}
                >
                  {slot}
                </button>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}
