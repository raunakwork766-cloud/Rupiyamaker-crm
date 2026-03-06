import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FaceRegistration from './FaceRegistration';
import PaidLeaveManagement from './PaidLeaveManagement';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const AttendanceSettingsTab = ({ userId }) => {
  const [subTab, setSubTab] = React.useState('settings'); // 'settings', 'face-registration', 'leave-management'
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
          { id: 'settings',         label: 'Attendance Settings', icon: '⚙️' },
          { id: 'face-registration', label: 'Face Registration',  icon: '📷' },
          { id: 'leave-management',  label: 'Leave Management',   icon: '📋' },
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
      {subTab === 'leave-management'  && <PaidLeaveManagement />}

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

          {/* ── ROW 1: Shift Timing (full width) ── */}
          <SectionCard
            icon={<i className="fa-regular fa-clock text-sm"></i>}
            title="Shift Timing Settings (Primary)"
            subtitle="Main shift timing — overrides check-in/check-out times"
            color="blue"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TimeInput label="Shift Start Time" hint="e.g. 10:00 AM" field="shift_start_time" value={settings.shift_start_time} />
              <TimeInput label="Shift End Time"   hint="e.g. 7:00 PM"  field="shift_end_time"   value={settings.shift_end_time} />
              <div>
                <FieldLabel hint="After this = Half Day">Reporting Deadline</FieldLabel>
                <input
                  type="time"
                  value={formatTime(settings.reporting_deadline)}
                  onChange={e => handleTimeChange('reporting_deadline', e.target.value)}
                  className="w-full border-2 border-yellow-400 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:border-yellow-500 bg-yellow-50"
                />
              </div>
            </div>
            <div className="mt-3">
              <InfoBox type="info">
                <strong>Rule:</strong> Punch In before <strong>{formatTime(settings.reporting_deadline)}</strong> = Present &nbsp;|&nbsp; Punch In after <strong>{formatTime(settings.reporting_deadline)}</strong> = Half Day
              </InfoBox>
            </div>
          </SectionCard>

          {/* ── ROW 2: Working Hours + Leave Allotment ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SectionCard
              icon={<i className="fa-solid fa-timer text-sm"></i>}
              title="Working Hours (Main Calculation)"
              subtitle="These hours determine final attendance status"
              color="indigo"
            >
              <div className="space-y-3">
                <NumberInput label="Full Day Working Hours" hint="hours" field="full_day_working_hours" value={settings.full_day_working_hours} min={1} max={24} step={0.5} />
                <NumberInput label="Half Day Minimum Hours"  hint="hours" field="half_day_minimum_working_hours" value={settings.half_day_minimum_working_hours} min={1} max={12} step={0.5} />
                <InfoBox type="warning">
                  ≥ <strong>{settings.full_day_working_hours} hrs</strong> = Full Day (1) &nbsp;•&nbsp;
                  ≥ <strong>{settings.half_day_minimum_working_hours} hrs</strong> = Half Day (0.5) &nbsp;•&nbsp;
                  Below = Zero (0)
                </InfoBox>
              </div>
            </SectionCard>

            <SectionCard
              icon="📋"
              title="Monthly Leave Allotment per Employee"
              subtitle="EL & PL days credited each month per employee"
              color="teal"
            >
              <div className="space-y-3">
                <NumberInput label="EL per Month (Earned Leave)" hint="days" field="default_earned_leave_monthly" value={settings.default_earned_leave_monthly} min={0} max={5} step={0.5} />
                <NumberInput label="PL per Month (Paid Leave)"   hint="days" field="default_paid_leave_monthly"  value={settings.default_paid_leave_monthly}  min={0} max={5} step={0.5} />
                <InfoBox type="info">
                  Every employee gets <strong>{Math.round(settings.default_earned_leave_monthly ?? 1.5)} EL</strong> and <strong>{settings.default_paid_leave_monthly ?? 1} PL</strong> per month.
                </InfoBox>
              </div>
            </SectionCard>
          </div>

          {/* ── ROW 3: Grace Period ── */}
          <SectionCard
            icon="⏱️"
            title="Grace Period Configuration"
            subtitle="Allow limited late arrival without penalty"
            color="yellow"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput label="Grace Period" hint="minutes" field="grace_period_minutes" value={settings.grace_period_minutes} min={0} max={60} step={5} />
              <NumberInput label="Grace Usage Limit" hint="per month" field="grace_usage_limit" value={settings.grace_usage_limit} min={0} max={10} step={1} />
            </div>
            <div className="mt-3">
              <InfoBox type="info">
                Deadline {formatTime(settings.reporting_deadline)} + {settings.grace_period_minutes} min grace = check-in by <strong>{(() => {
                  const [h, m] = (settings.reporting_deadline || '10:15').split(':').map(Number);
                  const total = h * 60 + m + (settings.grace_period_minutes || 0);
                  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                })()}</strong> = Present (if grace applies)
              </InfoBox>
            </div>
          </SectionCard>

          {/* ── ROW 4: Auto Grace ── */}
          <SectionCard
            icon="🎖️"
            title="Auto Grace — Threshold Based"
            subtitle="Grace marks earned automatically based on monthly attendance"
            color="green"
          >
            <div className="space-y-4">
              <Toggle
                label={settings.auto_grace_enabled ? '✅ Auto Grace Enabled' : '⛔ Auto Grace Disabled'}
                field="auto_grace_enabled"
                value={settings.auto_grace_enabled}
                color="green"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <NumberInput label="Max Graces / Month" field="auto_grace_monthly_limit" value={settings.auto_grace_monthly_limit} min={1} max={10} disabled={!settings.auto_grace_enabled} />
                <div>
                  <FieldLabel hint="unlock 1st grace">🥉 Grace 1 — Present Days</FieldLabel>
                  <input type="number" value={settings.auto_grace_threshold_1} onChange={e => handleSettingChange('auto_grace_threshold_1', parseInt(e.target.value))} min={1} max={31} disabled={!settings.auto_grace_enabled}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-400 bg-white disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
                <div>
                  <FieldLabel hint="unlock 2nd grace">🥈 Grace 2 — Present Days</FieldLabel>
                  <input type="number" value={settings.auto_grace_threshold_2} onChange={e => handleSettingChange('auto_grace_threshold_2', parseInt(e.target.value))} min={1} max={31} disabled={!settings.auto_grace_enabled}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-400 bg-white disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
                <div>
                  <FieldLabel hint="unlock 3rd grace">🥇 Grace 3 — Present Days</FieldLabel>
                  <input type="number" value={settings.auto_grace_threshold_3} onChange={e => handleSettingChange('auto_grace_threshold_3', parseInt(e.target.value))} min={1} max={31} disabled={!settings.auto_grace_enabled}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-400 bg-white disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
              </div>
              <InfoBox type="success">
                🥉 After <strong>{settings.auto_grace_threshold_1} days</strong> → Grace 1 &nbsp;|&nbsp;
                🥈 After <strong>{settings.auto_grace_threshold_2} days</strong> → Grace 2 &nbsp;|&nbsp;
                🥇 After <strong>{settings.auto_grace_threshold_3} days</strong> → Grace 3 &nbsp;|&nbsp;
                Max <strong>{settings.auto_grace_monthly_limit}</strong> graces/month. All auto-applied on check-out.
              </InfoBox>
            </div>
          </SectionCard>

          {/* ── ROW 5: Leave Rules + Sunday Rules ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SectionCard icon="🚫" title="Leave & Absconding Rules" subtitle="Auto-conversion and penalty settings" color="red">
              <div className="space-y-3">
                <NumberInput label="Pending Leave Auto-Convert" hint="days" field="pending_leave_auto_convert_days" value={settings.pending_leave_auto_convert_days} min={1} max={7} />
                <div>
                  <FieldLabel hint="fixed at -1">Absconding Penalty</FieldLabel>
                  <input type="number" value={settings.absconding_penalty} disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 cursor-not-allowed" />
                </div>
                <InfoBox type="error">
                  Leave not approved for <strong>{settings.pending_leave_auto_convert_days} days</strong> → Auto Absconding (-1). Manager can still approve to convert back.
                </InfoBox>
              </div>
            </SectionCard>

            <SectionCard icon="📅" title="Sunday & Sandwich Rules" subtitle="Weekend penalty rules for absconding" color="purple">
              <div className="space-y-4">
                <Toggle
                  label="Sunday Sandwich Rule"
                  desc="Saturday/Monday absconding → Sunday automatically becomes Zero"
                  field="enable_sunday_sandwich_rule"
                  value={settings.enable_sunday_sandwich_rule}
                  color="blue"
                />
                <Toggle
                  label="Adjacent Absconding Rule"
                  desc="Sat Abscond → next Sunday = Absent | Mon Abscond → prev Sunday = Absent"
                  field="enable_adjacent_absconding_rule"
                  value={settings.enable_adjacent_absconding_rule ?? true}
                  color="yellow"
                />
                <NumberInput
                  label="Minimum Working Days for Sunday"
                  hint="if less → Sunday = 0"
                  field="minimum_working_days_for_sunday"
                  value={settings.minimum_working_days_for_sunday}
                  min={3} max={6}
                  disabled={!settings.enable_sunday_sandwich_rule}
                />
                <InfoBox type="warning">
                  Working days &lt; <strong>{settings.minimum_working_days_for_sunday}</strong> in a week → Sunday = <strong>Zero (0)</strong>. Penalty applied once per Sunday.
                </InfoBox>
              </div>
            </SectionCard>
          </div>

          {/* ── ROW 6: Time Config + Working Hours (Legacy) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SectionCard icon={<i className="fa-regular fa-clock text-sm"></i>} title="Time Configuration (Legacy)" subtitle="Standard check-in/check-out times (overridden by Shift Timing above)" color="blue">
              <div className="grid grid-cols-2 gap-3">
                <TimeInput label="Check-in Time"              field="check_in_time"            value={settings.check_in_time} />
                <TimeInput label="Check-out Time"             field="check_out_time"           value={settings.check_out_time} />
                <TimeInput label="Late Arrival Threshold"     hint="after = half day" field="late_arrival_threshold"  value={settings.late_arrival_threshold} />
                <TimeInput label="Early Departure Threshold"  hint="before = half day" field="early_departure_threshold" value={settings.early_departure_threshold} />
              </div>
            </SectionCard>

            <SectionCard icon="🕐" title="Working Hours Configuration (Legacy)" subtitle="Legacy minimum hours per attendance status" color="indigo">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Total Working Hours"     hint="hrs/day" field="total_working_hours"           value={settings.total_working_hours}           min={1} max={24} step={0.5} />
                <NumberInput label="Min Hours Full Day"      hint="hours"   field="minimum_working_hours_full_day" value={settings.minimum_working_hours_full_day} min={1} max={24} step={0.5} />
                <NumberInput label="Min Hours Half Day"      hint="hours"   field="minimum_working_hours_half_day" value={settings.minimum_working_hours_half_day} min={1} max={12} step={0.5} />
                <NumberInput label="Overtime Threshold"      hint="hours"   field="overtime_threshold"             value={settings.overtime_threshold}             min={1} max={24} step={0.5} />
              </div>
            </SectionCard>
          </div>

          {/* ── ROW 7: Weekend + Permissions + Security + Geofence ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SectionCard icon="📆" title="Weekend Configuration" subtitle="Days considered as non-working weekends" color="teal">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {weekDays.map(d => (
                  <label key={d.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition text-sm font-medium ${
                    settings.weekend_days.includes(d.value)
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={settings.weekend_days.includes(d.value)}
                      onChange={() => handleWeekendDayChange(d.value)}
                      className="hidden"
                    />
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${settings.weekend_days.includes(d.value) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                      {settings.weekend_days.includes(d.value) && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                    </div>
                    {d.label}
                  </label>
                ))}
              </div>
            </SectionCard>

            <div className="space-y-5">
              <SectionCard icon="🔐" title="Check-in/out Permissions" subtitle="Control early/late check-in and check-out" color="green">
                <div className="space-y-3">
                  <Toggle label="Allow Early Check-in"  desc="Employees can check in before scheduled time" field="allow_early_check_in"  value={settings.allow_early_check_in}  color="green" />
                  <Toggle label="Allow Late Check-out"  desc="Employees can check out after scheduled time" field="allow_late_check_out"  value={settings.allow_late_check_out}   color="green" />
                </div>
              </SectionCard>

              <SectionCard icon={<i className="fa-solid fa-camera text-sm"></i>} title="Requirements & Security" subtitle="Mandatory fields and validations" color="indigo">
                <div className="space-y-3">
                  <Toggle label="Photo Required"          desc="Selfie required for check-in/check-out"          field="require_photo"       value={settings.require_photo}       color="blue" />
                  <Toggle label="Geolocation Required"    desc="GPS location required for check-in/check-out"     field="require_geolocation" value={settings.require_geolocation} color="blue" />
                  <Toggle label="Enable Geofence"         desc="Restrict check-in to office radius"               field="geofence_enabled"    value={settings.geofence_enabled}    color="blue" />
                </div>
              </SectionCard>
            </div>
          </div>

          {/* ── ROW 8: Geofence ── */}
          {settings.geofence_enabled && (
            <SectionCard icon={<i className="fa-solid fa-location-dot text-sm"></i>} title="Geofence Configuration" subtitle="Set office location and allowed radius" color="teal">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <FieldLabel>Office Latitude</FieldLabel>
                  <input type="number" step="any" value={settings.office_latitude || ''} onChange={e => handleSettingChange('office_latitude', parseFloat(e.target.value) || null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-teal-400 bg-white" />
                </div>
                <div>
                  <FieldLabel>Office Longitude</FieldLabel>
                  <input type="number" step="any" value={settings.office_longitude || ''} onChange={e => handleSettingChange('office_longitude', parseFloat(e.target.value) || null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-teal-400 bg-white" />
                </div>
                <NumberInput label="Geofence Radius" hint="meters" field="geofence_radius" value={settings.geofence_radius} min={10} max={10000} step={10} />
              </div>
            </SectionCard>
          )}

        </div>
      )}
    </div>
  );
};

export default AttendanceSettingsTab;
