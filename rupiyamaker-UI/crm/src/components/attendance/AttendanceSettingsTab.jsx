import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FaceRegistration from './FaceRegistration';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const AttendanceSettingsTab = ({ userId }) => {
  const [subTab, setSubTab] = React.useState('settings'); // 'settings', 'face-registration'
  const [settings, setSettings] = useState({
    // Shift Timing Settings (New)
    shift_start_time: '10:00',
    shift_end_time: '19:00', // 7:00 PM
    reporting_deadline: '10:15',
    
    // Working Hours Settings (Enhanced)
    full_day_working_hours: 9.0,
    half_day_minimum_working_hours: 5.0,
    
    // Grace Period Settings (New)
    grace_period_minutes: 30,
    grace_usage_limit: 2, // per month

    // Leave Monthly Allotments — shown in attendance page PL/EL columns
    default_earned_leave_monthly: 1.5,  // EL credited per month
    default_paid_leave_monthly: 1.0,    // PL credited per month

    // Auto Grace (Threshold-Based)
    auto_grace_enabled: true,
    auto_grace_monthly_limit: 3,      // max graces per month
    auto_grace_threshold_1: 15,       // present days to earn grace 1
    auto_grace_threshold_2: 20,       // present days to earn grace 2
    auto_grace_threshold_3: 24,       // present days to earn grace 3
    
    // Leave & Absconding Rules (New)
    pending_leave_auto_convert_days: 3, // Convert to absconding after 3 days
    absconding_penalty: -1, // Count as -1 day
    enable_consecutive_absent_absconding: true,
    consecutive_absent_absconding_days: 3,
    
    // Sunday & Sandwich Rules (New)
    enable_sunday_sandwich_rule: true,
    enable_adjacent_absconding_rule: true,
    minimum_working_days_for_sunday: 5, // If less than 5 days worked, Sunday = 0
    
    // Original Settings (Keeping for compatibility)
    check_in_time: '09:30',
    check_out_time: '18:30',
    total_working_hours: 9.0,
    late_arrival_threshold: '10:30',
    early_departure_threshold: '17:30',
    minimum_working_hours_full_day: 8.0,
    minimum_working_hours_half_day: 4.0,
    overtime_threshold: 9.0,
    weekend_days: [5, 6], // Saturday, Sunday
    allow_early_check_in: true,
    allow_late_check_out: true,
    require_photo: true,
    require_geolocation: true,
    geofence_enabled: false,
    office_latitude: null,
    office_longitude: null,
    geofence_radius: 100.0,
  });

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState({});

  const API_BASE_URL = '/api'; // Always use proxy

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/settings/attendance-settings`, {
        params: { user_id: userId }
      });
      
      if (response.data.success) {
        const settingsData = response.data.data;
        setSettings(settingsData);
        setOriginalSettings(settingsData);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error loading attendance settings:', error);
      setError('Failed to load attendance settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (field, value) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    
    // Check if there are changes
    const hasChanges = JSON.stringify(newSettings) !== JSON.stringify(originalSettings);
    setHasChanges(hasChanges);
  };

  const handleTimeChange = (field, timeString) => {
    handleSettingChange(field, timeString);
  };

  const saveSettings = async () => {
    setSaveLoading(true);
    setError(null);
    
    try {
      // Prepare update data (only changed fields)
      const updateData = {};
      Object.keys(settings).forEach(key => {
        if (settings[key] !== originalSettings[key]) {
          updateData[key] = settings[key];
        }
      });

      const response = await axios.put(`${API_BASE_URL}/settings/attendance-settings`, updateData, {
        params: { user_id: userId }
      });
      
      if (response.data.message) {
        setSuccess('Attendance settings updated successfully');
        setOriginalSettings(settings);
        setHasChanges(false);
        
        // Auto-hide success message
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error('Error saving attendance settings:', error);
      setError(error.response?.data?.detail || 'Failed to save attendance settings');
    } finally {
      setSaveLoading(false);
    }
  };

  const resetToDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all attendance settings to default values?')) {
      setSaveLoading(true);
      setError(null);
      
      try {
        const response = await axios.post(`${API_BASE_URL}/settings/attendance-settings/reset`, {}, {
          params: { user_id: userId }
        });
        
        if (response.data.message) {
          setSuccess('Attendance settings reset to defaults');
          await loadSettings(); // Reload settings
          
          // Auto-hide success message
          setTimeout(() => setSuccess(null), 3000);
        }
      } catch (error) {
        console.error('Error resetting attendance settings:', error);
        setError(error.response?.data?.detail || 'Failed to reset attendance settings');
      } finally {
        setSaveLoading(false);
      }
    }
  };

  const handleWeekendDayChange = (day) => {
    setSettings(prev => ({
      ...prev,
      weekend_days: prev.weekend_days.includes(day)
        ? prev.weekend_days.filter(d => d !== day)
        : [...prev.weekend_days, day].sort()
    }));
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const weekDays = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        <i className="fa-solid fa-spinner fa-spin mr-2 text-blue-500"></i> Loading attendance settings…
      </div>
    );
  }

  // ── shared Tailwind helpers ──────────────────────────────────
  const SectionCard = ({ icon, title, subtitle, color = 'blue', children }) => {
    const border = {
      blue:   'border-blue-400',   green:  'border-green-500',
      yellow: 'border-yellow-400', red:    'border-red-400',
      purple: 'border-purple-400', indigo: 'border-indigo-400',
      teal:   'border-teal-400',
    }[color] || 'border-gray-300';
    const iconBg = {
      blue:   'bg-blue-100 text-blue-600',   green:  'bg-green-100 text-green-600',
      yellow: 'bg-yellow-100 text-yellow-600', red: 'bg-red-100 text-red-600',
      purple: 'bg-purple-100 text-purple-600', indigo: 'bg-indigo-100 text-indigo-600',
      teal:   'bg-teal-100 text-teal-600',
    }[color] || 'bg-gray-100 text-gray-600';
    return (
      <div className={`bg-white rounded-xl border-2 ${border} shadow-sm overflow-hidden`}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          {icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${iconBg} shrink-0`}>{icon}</div>}
          <div>
            <h3 className="font-black text-gray-800 text-sm leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    );
  };

  const FieldLabel = ({ children, hint }) => (
    <div className="mb-1">
      <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{children}</span>
      {hint && <span className="ml-1.5 text-[10px] text-gray-400">({hint})</span>}
    </div>
  );

  const TimeInput = ({ label, hint, field, value }) => (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="time"
        value={formatTime(value)}
        onChange={e => handleTimeChange(field, e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
      />
    </div>
  );

  const NumberInput = ({ label, hint, field, value, min, max, step = 1, disabled = false }) => (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="number"
        value={value ?? ''}
        onChange={e => handleSettingChange(field, parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );

  const Toggle = ({ label, desc, field, value, color = 'blue' }) => {
    const track = value
      ? { blue: 'bg-blue-500', green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' }[color] || 'bg-blue-500'
      : 'bg-gray-300';
    return (
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5 shrink-0">
          <input type="checkbox" checked={value} onChange={e => handleSettingChange(field, e.target.checked)} className="sr-only" />
          <div className={`w-10 h-5 rounded-full transition-colors ${track}`}></div>
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`}></div>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-700 leading-tight">{label}</div>
          {desc && <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{desc}</div>}
        </div>
      </label>
    );
  };

  const InfoBox = ({ type = 'info', children }) => {
    const styles = {
      info:    'bg-blue-50 border-blue-200 text-blue-700',
      success: 'bg-green-50 border-green-200 text-green-700',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
      error:   'bg-red-50 border-red-200 text-red-700',
    }[type];
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '🚫' }[type];
    return (
      <div className={`rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed ${styles}`}>
        <span className="mr-1">{icons}</span>{children}
      </div>
    );
  };
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* ── Sub-Tab Navigation ── */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-5">
        {[
          { id: 'settings',          label: 'Attendance Settings', icon: '⚙️' },
          { id: 'face-registration', label: 'Face Registration',   icon: '📷' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 py-2.5 px-3 text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
              subTab === t.id
                ? 'bg-[#2563eb] text-white shadow-inner'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {subTab === 'face-registration' && <FaceRegistration />}

      {subTab === 'settings' && (
        <div className="space-y-5">

          {/* ── Sticky Save Bar ── */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                <span className="text-base">⚙️</span> Attendance Settings
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Configure attendance system parameters and rules</p>
            </div>
            <div className="flex items-center gap-2">
              {(success || error) && (
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {success || error}
                </span>
              )}
              <button
                onClick={resetToDefaults}
                disabled={saveLoading}
                className="border border-gray-300 text-gray-600 hover:border-gray-700 hover:text-gray-800 px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-40"
              >
                🔄 Reset to Defaults
              </button>
              <button
                onClick={saveSettings}
                disabled={!hasChanges || saveLoading}
                className="bg-[#2563eb] hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {saveLoading ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i> Saving…</> : '💾 Save Settings'}
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 1 — SHIFT TIMING
          ═══════════════════════════════════════════════════════════ */}
          <SectionCard
            icon="🕐"
            title="Shift Timing"
            subtitle="Define official work hours and the latest acceptable check-in time"
            color="blue"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TimeInput label="Shift Start" hint="official start" field="shift_start_time" value={settings.shift_start_time} />
              <TimeInput label="Shift End"   hint="official end"   field="shift_end_time"   value={settings.shift_end_time} />
              <div>
                <FieldLabel hint="punch-in after this = Half Day">Reporting Deadline ⚠️</FieldLabel>
                <input
                  type="time"
                  value={formatTime(settings.reporting_deadline)}
                  onChange={e => handleTimeChange('reporting_deadline', e.target.value)}
                  className="w-full border-2 border-amber-400 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:border-amber-500 bg-amber-50"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-green-600 text-base">✅</span>
                <div>
                  <div className="text-[10px] font-bold text-green-700 uppercase">Full Day</div>
                  <div className="text-[11px] text-green-800">Check-in before <strong>{formatTime(settings.reporting_deadline)}</strong></div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-amber-600 text-base">🕐</span>
                <div>
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Half Day</div>
                  <div className="text-[11px] text-amber-800">Check-in after <strong>{formatTime(settings.reporting_deadline)}</strong></div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-gray-500 text-base">🔒</span>
                <div>
                  <div className="text-[10px] font-bold text-gray-600 uppercase">Permissions</div>
                  <div className="text-[11px] text-gray-700 flex gap-2">
                    <Toggle label="Early In" field="allow_early_check_in"  value={settings.allow_early_check_in}  color="green" />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 2 — WORKING HOURS
          ═══════════════════════════════════════════════════════════ */}
          <SectionCard
            icon="⏱️"
            title="Working Hours Thresholds"
            subtitle="Minimum hours required to count as Full Day or Half Day"
            color="indigo"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <NumberInput label="Full Day — Minimum Hours" hint="e.g. 9 hrs" field="full_day_working_hours" value={settings.full_day_working_hours} min={1} max={24} step={0.5} />
              </div>
              <div>
                <NumberInput label="Half Day — Minimum Hours" hint="e.g. 5 hrs" field="half_day_minimum_working_hours" value={settings.half_day_minimum_working_hours} min={1} max={12} step={0.5} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[11px] font-semibold text-blue-800">
                ≥ {settings.full_day_working_hours}h → <span className="text-green-700 ml-1">Full Day (1.0)</span>
              </div>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] font-semibold text-amber-800">
                ≥ {settings.half_day_minimum_working_hours}h → <span className="text-amber-700 ml-1">Half Day (0.5)</span>
              </div>
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] font-semibold text-red-800">
                Below {settings.half_day_minimum_working_hours}h → <span className="text-red-700 ml-1">Zero (0)</span>
              </div>
            </div>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 3 — GRACE PERIOD + AUTO GRACE (merged)
          ═══════════════════════════════════════════════════════════ */}
          <SectionCard
            icon="🎖️"
            title="Grace Period & Auto Grace"
            subtitle="Allow late arrival within a grace window — earn extra graces based on attendance performance"
            color="yellow"
          >
            {/* Grace Period row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <NumberInput label="Grace Window" hint="minutes per use" field="grace_period_minutes" value={settings.grace_period_minutes} min={0} max={60} step={5} />
                <p className="text-[10px] text-gray-500 mt-1">
                  With grace: check-in deadline extends to{' '}
                  <strong className="text-gray-700">
                    {(() => {
                      const [h, m] = (settings.reporting_deadline || '10:15').split(':').map(Number);
                      const total = h * 60 + m + (settings.grace_period_minutes || 0);
                      return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
                    })()}
                  </strong>
                </p>
              </div>
              <div>
                <NumberInput label="Manual Grace Limit" hint="uses per month" field="grace_usage_limit" value={settings.grace_usage_limit} min={0} max={10} step={1} />
                <p className="text-[10px] text-gray-500 mt-1">Employee can manually use grace up to this many times per month</p>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold text-gray-700">Auto Grace (Earned by Attendance)</p>
                  <p className="text-[10px] text-gray-500">System auto-awards grace marks when employee reaches present-day thresholds</p>
                </div>
                <Toggle
                  label={settings.auto_grace_enabled ? 'ON' : 'OFF'}
                  field="auto_grace_enabled"
                  value={settings.auto_grace_enabled}
                  color="green"
                />
              </div>

              <div className="mb-3">
                <NumberInput
                  label="Max Auto Graces per Month"
                  hint="total graces system can award"
                  field="auto_grace_monthly_limit"
                  value={settings.auto_grace_monthly_limit}
                  min={1} max={10}
                  disabled={!settings.auto_grace_enabled}
                />
              </div>

              {/* Dynamic threshold inputs based on auto_grace_monthly_limit */}
              <div className={`grid gap-3 ${!settings.auto_grace_enabled ? 'opacity-40 pointer-events-none' : ''}`}
                style={{ gridTemplateColumns: `repeat(${Math.min(settings.auto_grace_monthly_limit ?? 3, 5)}, minmax(0,1fr))` }}>
                {Array.from({ length: settings.auto_grace_monthly_limit ?? 3 }, (_, i) => {
                  const num = i + 1;
                  const medals = ['🥉','🥈','🥇','🏅','⭐','🌟','💫','🎯','🔥','👑'];
                  const field = `auto_grace_threshold_${num}`;
                  const defaultVal = 12 + (num * 4);
                  return (
                    <div key={num} className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                        <span>{medals[i] || '🎖️'}</span> Grace {num}
                      </div>
                      <div className="text-[9px] text-gray-400 mb-1.5">Present days needed</div>
                      <input
                        type="number"
                        value={settings[field] ?? defaultVal}
                        onChange={e => handleSettingChange(field, parseInt(e.target.value) || defaultVal)}
                        min={1} max={31}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-center text-gray-800 focus:outline-none focus:border-yellow-400 bg-white"
                      />
                    </div>
                  );
                })}
              </div>

              {settings.auto_grace_enabled && (
                <div className="mt-3">
                  <InfoBox type="success">
                    {Array.from({ length: settings.auto_grace_monthly_limit ?? 3 }, (_, i) => {
                      const num = i + 1;
                      const field = `auto_grace_threshold_${num}`;
                      const defaultVal = 12 + (num * 4);
                      return `Grace ${num} after ${settings[field] ?? defaultVal} days`;
                    }).join(' → ')}. Max <strong>{settings.auto_grace_monthly_limit}</strong>/month, auto-applied on check-out.
                  </InfoBox>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 4 — LEAVE & ABSCONDING RULES + SUNDAY RULES (side by side)
          ═══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <SectionCard icon="🚫" title="Absconding Rules" subtitle="Auto-conversion of leave to absconding when unapproved" color="red">
              <div className="space-y-3">
                <NumberInput label="Auto-Convert to Absconding After" hint="consecutive unapproved days" field="pending_leave_auto_convert_days" value={settings.pending_leave_auto_convert_days} min={1} max={7} />
                <InfoBox type="error">
                  Leave pending &gt; <strong>{settings.pending_leave_auto_convert_days} days</strong> without approval → auto-marked <strong>Absconding (−1)</strong>. Manager can revert.
                </InfoBox>
                <div className="pt-1 space-y-3">
                  <Toggle
                    label="Consecutive Absent → Absconding"
                    desc="Mon–Sat consecutive absents without leave auto-convert to Absconding"
                    field="enable_consecutive_absent_absconding"
                    value={settings.enable_consecutive_absent_absconding ?? true}
                    color="red"
                  />
                  <NumberInput
                    label="Consecutive Absent Threshold"
                    hint="days"
                    field="consecutive_absent_absconding_days"
                    value={settings.consecutive_absent_absconding_days ?? 3}
                    min={2} max={7}
                    disabled={!settings.enable_consecutive_absent_absconding}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard icon="📅" title="Sunday & Sandwich Rules" subtitle="Penalty rules when Sundays border absconding days" color="purple">
              <div className="space-y-3">
                <Toggle
                  label="Sunday Sandwich Rule"
                  desc="Saturday/Monday absconding → Sunday becomes Zero automatically"
                  field="enable_sunday_sandwich_rule"
                  value={settings.enable_sunday_sandwich_rule}
                  color="blue"
                />
                <Toggle
                  label="Adjacent Absconding Rule"
                  desc="Sat abscond → next Sun = Absent | Mon abscond → prev Sun = Absent"
                  field="enable_adjacent_absconding_rule"
                  value={settings.enable_adjacent_absconding_rule ?? true}
                  color="yellow"
                />
                <NumberInput
                  label="Min Working Days to Keep Sunday Paid"
                  hint="below this → Sunday = 0"
                  field="minimum_working_days_for_sunday"
                  value={settings.minimum_working_days_for_sunday}
                  min={3} max={6}
                  disabled={!settings.enable_sunday_sandwich_rule}
                />
                <InfoBox type="warning">
                  Working days &lt; <strong>{settings.minimum_working_days_for_sunday}</strong> in a week → Sunday = <strong>Zero</strong>
                </InfoBox>
              </div>
            </SectionCard>
          </div>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 5 — WEEKEND + SECURITY + GEOFENCE
          ═══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <SectionCard icon="📆" title="Weekend Days" subtitle="Select which days are non-working weekends" color="teal">
              <div className="grid grid-cols-2 gap-2">
                {weekDays.map(d => (
                  <label key={d.value} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition text-sm font-semibold ${
                    settings.weekend_days.includes(d.value)
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}>
                    <input type="checkbox" checked={settings.weekend_days.includes(d.value)} onChange={() => handleWeekendDayChange(d.value)} className="hidden" />
                    <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${settings.weekend_days.includes(d.value) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                      {settings.weekend_days.includes(d.value) && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                    </div>
                    {d.label}
                  </label>
                ))}
              </div>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard icon="🔐" title="Check-in Requirements" subtitle="Control what employees must provide when checking in" color="indigo">
                <div className="space-y-3">
                  <Toggle label="Allow Late Check-out"   desc="Employees can check out after scheduled end time" field="allow_late_check_out"  value={settings.allow_late_check_out}   color="green" />
                  <Toggle label="Photo Required"         desc="Selfie required at check-in/check-out"           field="require_photo"        value={settings.require_photo}        color="blue" />
                  <Toggle label="Geolocation Required"   desc="GPS location required at check-in/check-out"      field="require_geolocation"  value={settings.require_geolocation}  color="blue" />
                  <Toggle label="Enable Geofence"        desc="Restrict check-in to office radius only"          field="geofence_enabled"     value={settings.geofence_enabled}     color="blue" />
                </div>
              </SectionCard>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
               SECTION 6 — GEOFENCE (conditional)
          ═══════════════════════════════════════════════════════════ */}
          {settings.geofence_enabled && (
            <SectionCard icon="📍" title="Geofence Configuration" subtitle="Set office location and maximum allowed distance for check-in" color="teal">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <FieldLabel>Office Latitude</FieldLabel>
                  <input type="number" step="any" value={settings.office_latitude || ''} onChange={e => handleSettingChange('office_latitude', parseFloat(e.target.value) || null)}
                    placeholder="e.g. 28.6139"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-teal-400 bg-white" />
                </div>
                <div>
                  <FieldLabel>Office Longitude</FieldLabel>
                  <input type="number" step="any" value={settings.office_longitude || ''} onChange={e => handleSettingChange('office_longitude', parseFloat(e.target.value) || null)}
                    placeholder="e.g. 77.2090"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-teal-400 bg-white" />
                </div>
                <NumberInput label="Allowed Radius" hint="meters" field="geofence_radius" value={settings.geofence_radius} min={10} max={10000} step={10} />
              </div>
            </SectionCard>
          )}

        </div>
      )}
    </div>
  );
};

export default AttendanceSettingsTab;
