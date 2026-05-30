import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { buildApiUrl } from "../config/api";

// ─── Constants (fallback only — actual values come from API) ─────────────────
const FALLBACK_LEAD_STATUSES = ["ACTIVE LEADS", "NOT A LEAD", "LOST BY MISTAKE", "LOST LEAD"];
const FALLBACK_LOGIN_STATUSES = [
  "ACTIVE LOGIN",
  "APPROVED",
  "DISBURSED",
  "LOST BY MISTAKE",
  "LOST LOGIN",
  "MULTI LOGIN DISBURSED BY US BY OTHER BANK",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(d) {
  return `${DAYS_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Custom Date Input (used inside the custom date modal) ───────────────────
const DateInput = React.forwardRef(({ value, onClick, placeholder }, ref) => (
  <input
    ref={ref}
    value={value}
    onClick={onClick}
    onChange={() => {}}
    placeholder={placeholder || "DD-MM-YYYY"}
    readOnly
    className="dashboard-date-input"
  />
));
DateInput.displayName = "DateInput";

// ─── Multi-Select Dropdown ────────────────────────────────────────────────────
const MultiSelect = React.memo(function MultiSelect({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const triggerText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? selected[0]
      : `${selected.length} Selected`;

  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div ref={ref} className="dashboard-multiselect">
      <button type="button" onClick={() => setOpen((p) => !p)} className="dashboard-multiselect-trigger">
        <span>{triggerText}</span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="dashboard-multiselect-menu">
          <div className="dashboard-multiselect-search-wrap">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="dashboard-multiselect-search"
            />
          </div>
          <div className="dashboard-multiselect-options">
            <label className="dashboard-multiselect-option dashboard-multiselect-option-all">
              <input
                type="checkbox"
                checked={selected.length === 0}
                onChange={() => onChange([])}
              />
              All
            </label>
            {filtered.map((opt) => (
              <label key={opt} className="dashboard-multiselect-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                {opt}
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="dashboard-multiselect-empty">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Sort Header ──────────────────────────────────────────────────────────────
const SortIcon = ({ col, sortCol, asc }) => {
  if (sortCol !== col) return <span className="dashboard-sort-icon muted">⇅</span>;
  return <span className="dashboard-sort-icon active">{asc ? "▲" : "▼"}</span>;
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const userId = localStorage.getItem("userId") || "";
  const token = localStorage.getItem("token") || "";

  // Filter state
  const [timeFilter, setTimeFilter] = useState("today");
  const [customRange, setCustomRange] = useState([null, null]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customMode, setCustomMode] = useState("single"); // "single" | "range"

  // Modal temp state (tracks selections inside modal before Apply)
  const [modalTempRange, setModalTempRange] = useState([null, null]);
  const [modalTempMode, setModalTempMode] = useState("single");
  const [prevTimeFilter, setPrevTimeFilter] = useState("today");
  const [calendarOpen, setCalendarOpen] = useState(false); // tracks if date popup inside modal is open

  // Filter options (loaded from API)
  const [allEmployees, setAllEmployees] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [empStatusFilter, setEmpStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [globalSearch, setGlobalSearch] = useState("");

  // Table data
  const [tableData, setTableData] = useState([]);
  const [totals, setTotals] = useState({ leads: 0, logins: 0 });
  const [loading, setLoading] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState(FALLBACK_LEAD_STATUSES);
  const [loginStatuses, setLoginStatuses] = useState(FALLBACK_LOGIN_STATUSES);

  // Sort state
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const datePickerRef = useRef(null);
  const datePickerWrapRef = useRef(null);
  const timeDropdownRef = useRef(null);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  // Close datepicker AND time-dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      // Don't close if the react-datepicker calendar popup itself is open
      if (calendarOpen) return;
      const insidePicker = datePickerWrapRef.current && datePickerWrapRef.current.contains(e.target);
      const insideDropdown = timeDropdownRef.current && timeDropdownRef.current.contains(e.target);
      if (!insidePicker && !insideDropdown) {
        setShowDatePicker(false);
        setShowTimeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calendarOpen]);

  // Derive date label for display
  const dateLabel = useMemo(() => {
    if (timeFilter === "today") return fmtDate(new Date());
    if (timeFilter === "this_week") {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now); mon.setDate(diff);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return `${fmtDate(mon)}  →  ${fmtDate(sun)}`;
    }
    if (timeFilter === "this_month") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${fmtDate(first)}  →  ${fmtDate(last)}`;
    }
    if (timeFilter === "all_time") return "Complete Historical View";
    if (timeFilter === "custom") {
      const [s, e] = customRange;
      if (!s) return "Pick a date...";
      if (!e || s.toDateString() === e.toDateString()) return fmtDate(s);
      return `${fmtDate(s)}  →  ${fmtDate(e)}`;
    }
    return "";
  }, [timeFilter, customRange]);

  // Format date as YYYY-MM-DD using LOCAL calendar date (IST-safe — avoids toISOString UTC shift)
  const toLocalYMD = useCallback(
    (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    []
  );

  // Build query params for API call
  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ user_id: userId, time_filter: timeFilter });
    if (timeFilter === "custom") {
      const [s, e] = customRange;
      if (s) p.set("date_from", toLocalYMD(s));
      if (e) p.set("date_to", toLocalYMD(e));
      else if (s) p.set("date_to", toLocalYMD(s));
    }
    if (empStatusFilter !== "all") p.set("emp_status", empStatusFilter);
    return p;
  }, [userId, timeFilter, customRange, empStatusFilter, toLocalYMD]);

  // Teams/employees are derived entirely from /stats response — no separate API call needed.
  // This ensures dropdown filters only show teams/employees that have actual lead/login data
  // within the user's permission scope and selected time period.

  // Fetch stats whenever filters change
  const fetchStats = useCallback(async () => {
    if (!userId) return;
    // Don't fetch for custom if no date selected yet
    if (timeFilter === "custom" && !customRange[0]) return;

    setLoading(true);
    try {
      const params = buildParams();
      const resp = await fetch(buildApiUrl(`/dashboard/stats?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();

      // Update dynamic statuses from API response
      if (data.leadStatuses && data.leadStatuses.length > 0) setLeadStatuses(data.leadStatuses);
      if (data.loginStatuses && data.loginStatuses.length > 0) setLoginStatuses(data.loginStatuses);

      const allEmps = data.employees || [];

      // Backend already filters out zero-data users.
      // Derive dropdown options directly from the response (all have data > 0).
      const freshTeams = [...new Set(
        allEmps.map((e) => e.team).filter(Boolean)
      )].sort();
      setAllTeams(freshTeams);
      setAllEmployees(allEmps.slice().sort((a, b) => a.name.localeCompare(b.name)));

      // allEmps already contains only users with leads/logins > 0
      let employees = allEmps;

      // Apply team filter client-side (API already supports but we also do it here for UX)
      if (selectedTeams.length > 0)
        employees = employees.filter((e) => selectedTeams.includes(e.team));
      if (selectedEmployees.length > 0)
        employees = employees.filter((e) => selectedEmployees.includes(e.name));
      if (globalSearch.trim())
        employees = employees.filter(
          (e) =>
            e.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
            e.team.toLowerCase().includes(globalSearch.toLowerCase())
        );

      setTableData(employees);
      // Recompute totals from filtered set
      const tLeads = employees.reduce((s, e) => s + e.totalLeads, 0);
      const tLogins = employees.reduce((s, e) => s + e.totalLogins, 0);
      setTotals({ leads: tLeads, logins: tLogins });
    } catch {
      // silently ignore – table stays empty
    } finally {
      setLoading(false);
    }
  }, [userId, token, buildParams, selectedTeams, selectedEmployees, globalSearch, timeFilter, customRange, empStatusFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Sort table
  const sortedData = useMemo(() => {
    if (!sortCol) return tableData;
    return [...tableData].sort((a, b) => {
      let va, vb;
      if (sortCol === "name") { va = a.name; vb = b.name; }
      else if (sortCol === "team") { va = a.team; vb = b.team; }
      else if (sortCol === "totalLeads") { va = a.totalLeads; vb = b.totalLeads; }
      else if (sortCol === "totalLogins") { va = a.totalLogins; vb = b.totalLogins; }
      else if (sortCol.startsWith("leads.")) {
        const key = sortCol.slice(6);
        va = a.leads[key] ?? 0; vb = b.leads[key] ?? 0;
      } else if (sortCol.startsWith("logins.")) {
        const key = sortCol.slice(7);
        va = a.logins[key] ?? 0; vb = b.logins[key] ?? 0;
      } else { va = 0; vb = 0; }
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }, [tableData, sortCol, sortAsc]);

  // Compute per-column totals from the currently visible (filtered+sorted) data
  const columnTotals = useMemo(() => {
    const t = {
      totalLeads: 0,
      totalLogins: 0,
      leads: {},
      logins: {},
    };
    for (const s of leadStatuses) t.leads[s] = 0;
    for (const s of loginStatuses) t.logins[s] = 0;
    for (const row of sortedData) {
      t.totalLeads += row.totalLeads || 0;
      t.totalLogins += row.totalLogins || 0;
      for (const s of leadStatuses) t.leads[s] += row.leads[s] ?? 0;
      for (const s of loginStatuses) t.logins[s] += row.logins[s] ?? 0;
    }
    return t;
  }, [sortedData, leadStatuses, loginStatuses]);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc((p) => !p);
    else { setSortCol(col); setSortAsc(col === "name" || col === "team"); }
  };

  const TIME_OPTIONS = [
    { val: "today", label: "Today" },
    { val: "this_week", label: "This Week" },
    { val: "this_month", label: "This Month" },
    { val: "all_time", label: "All Time" },
  ];

  const handleTimeChange = (val) => {
    setShowTimeDropdown(false);
    if (val === "custom") {
      setPrevTimeFilter(timeFilter === "custom" ? prevTimeFilter : timeFilter);
      setTimeFilter("custom");
      // Pre-fill modal with already-applied custom range (if any)
      setModalTempRange(customRange[0] ? [...customRange] : [null, null]);
      setModalTempMode(customMode);
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
      setTimeFilter(val);
    }
  };

  const getTimeLabel = () => {
    if (timeFilter === "custom") {
      if (customRange[0] && customRange[1]) {
        return `${customRange[0].toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${customRange[1].toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
      }
      if (customRange[0]) return customRange[0].toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      return "Custom Date Range";
    }
    return TIME_OPTIONS.find((o) => o.val === timeFilter)?.label || "Today";
  };

  // Apply custom date modal
  const handleApplyDateModal = () => {
    if (modalTempMode === "single" && modalTempRange[0]) {
      setCustomRange([modalTempRange[0], modalTempRange[0]]);
      setCustomMode("single");
      setShowDatePicker(false);
    } else if (modalTempMode === "range" && modalTempRange[0] && modalTempRange[1]) {
      setCustomRange([...modalTempRange]);
      setCustomMode("range");
      setShowDatePicker(false);
    }
    // If incomplete selection, do nothing (modal stays open)
  };

  // Cancel custom date modal
  const handleCancelDateModal = () => {
    setShowDatePicker(false);
    // If no custom date was previously applied, revert to previous time filter
    if (!customRange[0]) {
      setTimeFilter(prevTimeFilter || "today");
    }
  };

  const dashboardPageStyles = `
    .task-page-container.dashboard-page { padding: 0; max-width: 100%; background: #f1f5f9; min-height: 100vh; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; display: flex; flex-direction: column; overflow: hidden; }
    .dashboard-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow: hidden; }
    .dashboard-nav-row { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; }
    .dashboard-row1 { padding: 8px 20px; gap: 24px; flex-wrap: wrap; }
    .dashboard-row2 { padding: 10px 20px; gap: 16px; flex-wrap: wrap; }
    .dashboard-time-btn { display: flex; align-items: center; color: #fff; background: #0f172a; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: none; cursor: pointer; outline: none; margin-top: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .dashboard-time-btn:hover { opacity: 0.9; }
    .dashboard-date-label { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; white-space: nowrap; line-height: 1.25; }
    .dashboard-date-arrow { font-size: 13px; color: #64748b; }
    .dashboard-kpi-group { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex: 1; flex-wrap: wrap; }
    .dashboard-kpi { display: flex; align-items: center; gap: 16px; padding: 10px 24px; border-radius: 10px; border: 1px solid; flex: 1; min-width: 220px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); transition: transform 0.2s ease; }
    .dashboard-kpi:hover { transform: translateY(-2px); }
    .dashboard-kpi.leads { background: linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 100%); border-color: #bae6fd; }
    .dashboard-kpi.logins { background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%); border-color: #bbf7d0; }
    .dashboard-kpi-icon { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 10px; background: #ffffff; flex-shrink: 0; }
    .dashboard-kpi-icon.leads { color: #0284c7; border: 1px solid #bae6fd; }
    .dashboard-kpi-icon.logins { color: #16a34a; border: 1px solid #bbf7d0; }
    .dashboard-kpi-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; line-height: 1; }
    .dashboard-kpi-val { font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1; }
    .dashboard-search-wrap { flex: 1; position: relative; min-width: 200px; }
    .dashboard-search-wrap svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none; }
    .dashboard-search-input { width: 100%; padding: 9px 14px 9px 40px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; color: #0f172a; font-size: 13px; font-family: inherit; font-weight: 600; outline: none; box-sizing: border-box; height: 36px; }
    .dashboard-search-input::placeholder { color: #64748b; }
    .dashboard-search-input:focus { border-color: #3b82f6; background: #ffffff; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .dashboard-filter-select { padding: 8px 32px 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; color: #0f172a; font-size: 13px; font-weight: 600; cursor: pointer; outline: none; height: 36px; appearance: none; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: right 8px center; }
    .dashboard-filter-select:focus { border-color: #3b82f6; background-color: #ffffff; }
    .dashboard-multiselect { position: relative; flex: 1; min-width: 0; }
    .dashboard-multiselect-trigger { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; align-items: center; height: 36px; outline: none; color: #0f172a; }
    .dashboard-multiselect-trigger:hover { border-color: #3b82f6; background: #ffffff; }
    .dashboard-multiselect-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dashboard-multiselect-menu { position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 9999; display: flex; flex-direction: column; max-height: 250px; }
    .dashboard-multiselect-search-wrap { padding: 10px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px 8px 0 0; }
    .dashboard-multiselect-search { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; outline: none; font-family: inherit; background: #ffffff; color: #0f172a; box-sizing: border-box; }
    .dashboard-multiselect-options { overflow-y: auto; padding: 4px 0; }
    .dashboard-multiselect-option { padding: 8px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; font-weight: 500; color: #0f172a; }
    .dashboard-multiselect-option:hover { background: #f1f5f9; color: #3b82f6; }
    .dashboard-multiselect-option-all { font-weight: 700; }
    .dashboard-multiselect-empty { padding: 10px 14px; color: #64748b; font-size: 13px; }
    .dashboard-date-input { width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; font-weight: 500; color: #0f172a; font-family: inherit; cursor: pointer; background: #ffffff; box-sizing: border-box; outline: none; }
    .dashboard-date-input:focus { border-color: #3b82f6; }
    .dashboard-time-dropdown { position: absolute; top: 44px; left: 0; z-index: 1001; background: #ffffff; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden; min-width: 170px; }
    .dashboard-time-option { display: block; width: 100%; padding: 10px 16px; border: none; background: transparent; color: #0f172a; font-family: inherit; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; }
    .dashboard-time-option:hover { background: #f1f5f9; }
    .dashboard-time-option.active { background: #eff6ff; color: #1d4ed8; font-weight: 700; }
    .dashboard-time-option-custom { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 16px; border: none; background: transparent; color: #0f172a; font-family: inherit; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; border-top: 1px solid #e2e8f0; }
    .dashboard-time-option-custom.active { background: #eff6ff; color: #1d4ed8; font-weight: 700; }
    .dashboard-date-modal { position: absolute; top: 52px; left: 0; z-index: 1200; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; padding: 20px; min-width: 310px; max-width: 360px; }
    .dashboard-date-toggle { display: flex; background: #f1f5f9; border-radius: 8px; padding: 4px; margin-bottom: 20px; gap: 4px; }
    .dashboard-date-toggle-btn { flex: 1; padding: 8px 0; border: none; border-radius: 6px; background: transparent; font-family: inherit; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s; }
    .dashboard-date-toggle-btn.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .dashboard-date-field-label { display: block; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
    .dashboard-date-actions { display: flex; gap: 10px; }
    .dashboard-btn-secondary { flex: 1; padding: 10px 0; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff; color: #0f172a; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .dashboard-btn-secondary:hover { background: #f8fafc; }
    .dashboard-btn-primary { flex: 1; padding: 10px 0; border: none; border-radius: 6px; background: #0f172a; color: #fff; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
    .dashboard-btn-primary:hover { opacity: 0.9; }
    .dashboard-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .dashboard-table-container { flex: 1; min-height: 0; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.04); overflow: auto; }
    .dashboard-table-container::-webkit-scrollbar { width: 8px; height: 10px; }
    .dashboard-table-container::-webkit-scrollbar-track { background: #f8fafc; border-radius: 8px; }
    .dashboard-table-container::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 8px; }
    .dashboard-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; white-space: nowrap; }
    .dashboard-th { cursor: pointer; user-select: none; font-weight: 700; font-size: 12px; padding: 12px 16px; border-bottom: 2px solid #e2e8f0; text-align: center; background: #f8fafc; color: #64748b; position: sticky; top: 45px; z-index: 20; transition: background-color 0.2s; }
    .dashboard-th:hover { background: #e2e8f0; color: #0f172a; }
    .dashboard-th-static { cursor: default; }
    .dashboard-sort-icon { margin-left: 4px; font-size: 10px; }
    .dashboard-sort-icon.muted { color: #94a3b8; }
    .dashboard-sort-icon.active { color: #3b82f6; font-weight: bold; }
    .dashboard-group-identity { background: #0f172a; color: #ffffff; text-align: center; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; padding: 14px; border-bottom: 2px solid #000000; position: sticky; top: 0; left: 0; z-index: 50; }
    .dashboard-group-leads { background: #1e3a8a; color: #ffffff; text-align: center; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; padding: 14px; border-bottom: 2px solid #172554; position: sticky; top: 0; z-index: 30; }
    .dashboard-group-logins { background: #064e3b; color: #ffffff; text-align: center; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; padding: 14px; border-bottom: 2px solid #022c22; border-left: 4px solid #475569; position: sticky; top: 0; z-index: 30; }
    .dashboard-th-identity { background: #f8fafc !important; color: #64748b !important; text-align: left !important; position: sticky; top: 45px; z-index: 40; }
    .dashboard-th-leads-total { background: #dbeafe !important; color: #1e40af !important; }
    .dashboard-th-logins-total { background: #d1fae5 !important; color: #166534 !important; border-left: 4px solid #475569 !important; }
    .dashboard-empty-cell { text-align: center; padding: 60px 20px; color: #64748b; font-size: 15px; background: #ffffff; }
    .dashboard-assigned-badge { font-size: 9px; font-weight: 800; letter-spacing: 0.5px; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; padding: 1px 5px; text-transform: uppercase; }
    .dashboard-page .dashboard-table tbody td,
    .dashboard-page .dashboard-table tfoot td { color: #0f172a !important; font-weight: 600 !important; }
    .dashboard-page .dashboard-table tbody td[data-zone="identity"] { color: #0f172a !important; font-weight: 700 !important; }
    .dashboard-page .dashboard-table tbody td.dashboard-total-leads,
    .dashboard-page .dashboard-table tfoot td.dashboard-tfoot-total-leads { color: #1e3a8a !important; font-weight: 800 !important; }
    .dashboard-page .dashboard-table tbody td.dashboard-total-logins,
    .dashboard-page .dashboard-table tfoot td.dashboard-tfoot-total-logins { color: #064e3b !important; font-weight: 800 !important; }
    .dashboard-page .dashboard-table tfoot td.dashboard-tfoot-leads { color: #1e3a8a !important; }
    .dashboard-page .dashboard-table tfoot td.dashboard-tfoot-logins { color: #064e3b !important; }
    .dashboard-data-row td { border-bottom: 1px solid #e2e8f0; }
    .dashboard-data-row td[data-zone="identity"] { position: sticky; z-index: 10; background: #ffffff; color: #0f172a; font-weight: 700; }
    .dashboard-data-row td[data-zone="identity"]:first-child { left: 0; }
    .dashboard-data-row td[data-zone="identity"]:nth-child(2) { left: 160px; border-right: 2px solid #94a3b8; box-shadow: 2px 0 5px rgba(0,0,0,0.05); }
    .dashboard-data-row td[data-zone="leads"], .dashboard-data-row td[data-zone="total-leads"] { background: #f8fafc; color: #0f172a; }
    .dashboard-data-row td[data-zone="logins"], .dashboard-data-row td[data-zone="total-logins"] { background: #f0fdf4; color: #0f172a; }
    .dashboard-data-row td.dashboard-total-leads { background: #eff6ff !important; color: #1e3a8a !important; font-weight: 800; font-size: 14px; }
    .dashboard-data-row td.dashboard-total-logins { background: #dcfce7 !important; color: #064e3b !important; font-weight: 800; font-size: 14px; border-left: 4px solid #475569; }
    .dashboard-data-row:hover td[data-zone="identity"] { background: #f8fafc; }
    .dashboard-data-row:hover td[data-zone="leads"], .dashboard-data-row:hover td[data-zone="total-leads"] { background: #f1f5f9; }
    .dashboard-data-row:hover td[data-zone="logins"], .dashboard-data-row:hover td[data-zone="total-logins"] { background: #e6f4ea; }
    .dashboard-data-row td.dashboard-assigned-name { background: #fffbeb !important; }
    .dashboard-data-row:hover td.dashboard-assigned-name { background: #fef3c7 !important; }
    .dashboard-tfoot-label { padding: 12px 16px; font-weight: 900; font-size: 12px; letter-spacing: 0.5px; color: #0f172a; background: #f8fafc; border-top: 2px solid #e2e8f0; position: sticky; left: 0; z-index: 6; text-transform: uppercase; border-right: 2px solid #94a3b8; box-shadow: 2px 0 5px rgba(0,0,0,0.05); }
    .dashboard-tfoot-total-leads { padding: 12px 16px; text-align: center; font-family: monospace; font-size: 14px; font-weight: 900; background: #dbeafe; color: #1e40af; border-top: 2px solid #e2e8f0; }
    .dashboard-tfoot-leads { padding: 12px 16px; text-align: center; font-family: monospace; font-size: 14px; font-weight: 800; background: #f8fafc; color: #1e3a8a; border-top: 2px solid #e2e8f0; }
    .dashboard-tfoot-total-logins { padding: 12px 16px; text-align: center; font-family: monospace; font-size: 14px; font-weight: 900; background: #d1fae5; color: #166534; border-top: 2px solid #e2e8f0; border-left: 4px solid #475569; }
    .dashboard-tfoot-logins { padding: 12px 16px; text-align: center; font-family: monospace; font-size: 14px; font-weight: 800; background: #f0fdf4; color: #064e3b; border-top: 2px solid #e2e8f0; }
    .rdp-dashboard .react-datepicker { font-family: inherit !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important; overflow: hidden; background: #ffffff !important; }
    .rdp-dashboard .react-datepicker__header { background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; padding: 12px 0 0 !important; }
    .rdp-dashboard .react-datepicker__current-month { font-size: 14px !important; font-weight: 700 !important; color: #0f172a !important; margin-bottom: 8px; }
    .rdp-dashboard .react-datepicker__day-name { font-size: 11px !important; font-weight: 700 !important; color: #64748b !important; width: 36px !important; line-height: 36px !important; }
    .rdp-dashboard .react-datepicker__day { width: 36px !important; line-height: 36px !important; font-size: 13px !important; font-weight: 500 !important; color: #0f172a !important; border-radius: 6px !important; margin: 1px !important; }
    .rdp-dashboard .react-datepicker__day:hover { background: #f1f5f9 !important; border-radius: 6px !important; }
    .rdp-dashboard .react-datepicker__day--selected, .rdp-dashboard .react-datepicker__day--range-start, .rdp-dashboard .react-datepicker__day--range-end { background: #0f172a !important; color: #fff !important; font-weight: 700 !important; border-radius: 6px !important; }
    .rdp-dashboard .react-datepicker__day--in-range, .rdp-dashboard .react-datepicker__day--in-selecting-range { background: #e2e8f0 !important; color: #0f172a !important; border-radius: 0 !important; }
    .rdp-dashboard .react-datepicker__day--keyboard-selected { background: #f1f5f9 !important; color: #0f172a !important; }
    .rdp-dashboard .react-datepicker__day--today { font-weight: 800 !important; color: #2563eb !important; }
    .rdp-dashboard .react-datepicker__day--outside-month { color: #94a3b8 !important; }
    .rdp-dashboard .react-datepicker__triangle { display: none !important; }
    .rdp-dashboard .react-datepicker-popper { z-index: 9999 !important; }
  `;

  const TH = ({ col, children, style, className = "" }) => (
    <th
      className={`dashboard-th ${col ? "" : "dashboard-th-static"} ${className}`}
      onClick={col ? () => handleSort(col) : undefined}
      style={style}
    >
      {children}
      {col && <SortIcon col={col} sortCol={sortCol} asc={sortAsc} />}
    </th>
  );

  const canApplyCustomDate =
    (modalTempMode === "single" && modalTempRange[0]) ||
    (modalTempMode === "range" && modalTempRange[0] && modalTempRange[1]);

  return (
    <div className="task-page-container dashboard-page">
      <style>{dashboardPageStyles}</style>
      <div className="dashboard-content">
        <div className="dashboard-nav-row dashboard-row1">
          <div ref={timeDropdownRef} style={{ display: "flex", alignItems: "flex-start", gap: 6, minWidth: "max-content", position: "relative", flexWrap: "wrap" }}>
            <button
              type="button"
              className="dashboard-time-btn"
              onClick={() => {
                setShowDatePicker(false);
                setShowTimeDropdown((prev) => !prev);
              }}
            >
              {getTimeLabel()}
              <svg style={{ marginLeft: 6, flexShrink: 0 }} width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {showTimeDropdown && (
              <div className="dashboard-time-dropdown">
                {TIME_OPTIONS.map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    className={`dashboard-time-option${timeFilter === val ? " active" : ""}`}
                    onClick={() => handleTimeChange(val)}
                  >{label}</button>
                ))}
                <button
                  type="button"
                  className={`dashboard-time-option-custom${timeFilter === "custom" ? " active" : ""}`}
                  onClick={() => handleTimeChange("custom")}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <rect x={3} y={4} width={18} height={18} rx={2} />
                    <line x1={16} y1={2} x2={16} y2={6} />
                    <line x1={8} y1={2} x2={8} y2={6} />
                    <line x1={3} y1={10} x2={21} y2={10} />
                  </svg>
                  Custom Date Range
                </button>
              </div>
            )}

            {showDatePicker && (
              <div ref={datePickerWrapRef} className="dashboard-date-modal">
                <div className="dashboard-date-toggle">
                  {[
                    { key: "single", label: "Single Date" },
                    { key: "range", label: "Date Range" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`dashboard-date-toggle-btn${modalTempMode === key ? " active" : ""}`}
                      onClick={() => {
                        setModalTempMode(key);
                        setModalTempRange([null, null]);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {modalTempMode === "single" ? (
                  <div style={{ marginBottom: 20 }}>
                    <label className="dashboard-date-field-label">SELECT DATE</label>
                    <DatePicker
                      selected={modalTempRange[0]}
                      onChange={(date) => setModalTempRange([date, date])}
                      dateFormat="dd-MM-yyyy"
                      placeholderText="DD-MM-YYYY"
                      customInput={<DateInput />}
                      calendarClassName="rdp-dashboard"
                      popperPlacement="bottom-start"
                      popperProps={{ strategy: "fixed" }}
                      onCalendarOpen={() => setCalendarOpen(true)}
                      onCalendarClose={() => setCalendarOpen(false)}
                    />
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                    <div style={{ flex: 1 }}>
                      <label className="dashboard-date-field-label">START DATE</label>
                      <DatePicker
                        selected={modalTempRange[0]}
                        onChange={(date) => setModalTempRange([date, modalTempRange[1]])}
                        selectsStart
                        startDate={modalTempRange[0]}
                        endDate={modalTempRange[1]}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="DD-MM-YYYY"
                        customInput={<DateInput />}
                        calendarClassName="rdp-dashboard"
                        popperPlacement="bottom-start"
                        popperProps={{ strategy: "fixed" }}
                        onCalendarOpen={() => setCalendarOpen(true)}
                        onCalendarClose={() => setCalendarOpen(false)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="dashboard-date-field-label">END DATE</label>
                      <DatePicker
                        selected={modalTempRange[1]}
                        onChange={(date) => setModalTempRange([modalTempRange[0], date])}
                        selectsEnd
                        startDate={modalTempRange[0]}
                        endDate={modalTempRange[1]}
                        minDate={modalTempRange[0]}
                        dateFormat="dd-MM-yyyy"
                        placeholderText="DD-MM-YYYY"
                        customInput={<DateInput />}
                        calendarClassName="rdp-dashboard"
                        popperPlacement="bottom-start"
                        popperProps={{ strategy: "fixed" }}
                        onCalendarOpen={() => setCalendarOpen(true)}
                        onCalendarClose={() => setCalendarOpen(false)}
                      />
                    </div>
                  </div>
                )}

                <div className="dashboard-date-actions">
                  <button type="button" className="dashboard-btn-secondary" onClick={handleCancelDateModal}>Cancel</button>
                  <button type="button" className="dashboard-btn-primary" onClick={handleApplyDateModal} disabled={!canApplyCustomDate}>Apply</button>
                </div>
              </div>
            )}

            <div
              className="dashboard-date-label"
              style={timeFilter === "custom" && customRange[0] ? { cursor: "pointer" } : undefined}
              onClick={() => {
                if (timeFilter === "custom" && customRange[0] && !showDatePicker) {
                  setModalTempRange([...customRange]);
                  setModalTempMode(customMode);
                  setShowDatePicker(true);
                }
              }}
              title={timeFilter === "custom" && customRange[0] ? "Click to edit date" : undefined}
            >
              {dateLabel.split("  →  ").map((part, i) => (
                <div key={i}>
                  {i > 0 && <span className="dashboard-date-arrow">→ </span>}
                  {part}
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-kpi-group">
            {[
              {
                variant: "leads",
                label: "Total Leads Created",
                value: totals.leads,
                icon: (
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx={9} cy={7} r={4} />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
              },
              {
                variant: "logins",
                label: "Total Logins Processed",
                value: totals.logins,
                icon: (
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ),
              },
            ].map(({ variant, label, value, icon }) => (
              <div key={variant} className={`dashboard-kpi ${variant}`}>
                <div className={`dashboard-kpi-icon ${variant}`}>{icon}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="dashboard-kpi-lbl">{label}</span>
                  <span className="dashboard-kpi-val">{loading ? "—" : value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-nav-row dashboard-row2">
          <div className="dashboard-search-wrap">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={11} cy={11} r={8} />
              <line x1={21} y1={21} x2={16.65} y2={16.65} />
            </svg>
            <input
              type="text"
              placeholder="Search employee, team..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="dashboard-search-input"
            />
          </div>

          <div style={{ flex: 1, maxWidth: 280 }}>
            <MultiSelect
              options={allTeams}
              selected={selectedTeams}
              onChange={setSelectedTeams}
              placeholder={allTeams.length ? `All Teams (${allTeams.length})` : "All Teams"}
            />
          </div>

          <div style={{ flex: 1, maxWidth: 280 }}>
            <MultiSelect
              options={allEmployees.map((e) => e.name)}
              selected={selectedEmployees}
              onChange={setSelectedEmployees}
              placeholder={allEmployees.length ? `All Employees (${allEmployees.length})` : "All Employees"}
            />
          </div>

          <div style={{ flexShrink: 0 }}>
            <select
              value={empStatusFilter}
              onChange={(e) => setEmpStatusFilter(e.target.value)}
              className="dashboard-filter-select"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

      <div className="dashboard-table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th colSpan={2} className="dashboard-group-identity">Identity</th>
              <th colSpan={1 + leadStatuses.length} className="dashboard-group-leads">Leads Pipeline Zone</th>
              <th colSpan={1 + loginStatuses.length} className="dashboard-group-logins">Logins Pipeline Zone</th>
            </tr>

            <tr>
              <TH col="name" className="dashboard-th-identity" style={{ minWidth: 160, width: 160, textAlign: "left", top: 45, left: 0, zIndex: 40 }}>
                Employee Name
              </TH>
              <TH col="team" className="dashboard-th-identity" style={{ minWidth: 100, width: 100, textAlign: "left", top: 45, left: 160, zIndex: 40, borderRight: "2px solid #94a3b8", boxShadow: "2px 0 5px rgba(0,0,0,0.05)" }}>
                Team
              </TH>

              <TH col="totalLeads" className="dashboard-th-leads-total">Total Leads</TH>
              {leadStatuses.map((s) => (
                <TH key={s} col={`leads.${s}`}>{s.replace(/_/g, " ")}</TH>
              ))}

              <TH col="totalLogins" className="dashboard-th-logins-total">Total Logins</TH>
              {loginStatuses.map((s) => (
                <TH key={s} col={`logins.${s}`}>{s.replace(/_/g, " ")}</TH>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2 + 1 + leadStatuses.length + 1 + loginStatuses.length} className="dashboard-empty-cell">
                  Loading...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={2 + 1 + leadStatuses.length + 1 + loginStatuses.length} className="dashboard-empty-cell">
                  No records found. Try adjusting criteria.
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr key={row.id} className="dashboard-data-row">
                  <td
                    data-zone="identity"
                    className={row.isAssignedView ? "dashboard-assigned-name" : ""}
                    style={{ padding: "11px 16px", minWidth: 160, width: 160 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{row.name}</span>
                      {row.isAssignedView && <span className="dashboard-assigned-badge">Assigned</span>}
                    </div>
                  </td>

                  <td
                    data-zone="identity"
                    style={{ padding: "11px 16px", minWidth: 100, width: 100 }}
                  >
                    {row.team}
                  </td>

                  <Nc zone="total-leads" className="dashboard-total-leads">{row.totalLeads}</Nc>

                  {leadStatuses.map((s) => (
                    <Nc key={s} zone="leads">{row.leads[s] ?? 0}</Nc>
                  ))}

                  <Nc zone="total-logins" className="dashboard-total-logins">{row.totalLogins}</Nc>

                  {loginStatuses.map((s) => (
                    <Nc key={s} zone="logins">{row.logins[s] ?? 0}</Nc>
                  ))}
                </tr>
              ))
            )}
          </tbody>

          {sortedData.length > 0 && (
            <tfoot>
              <tr style={{ position: "sticky", bottom: 0, zIndex: 5 }}>
                <td colSpan={2} className="dashboard-tfoot-label">
                  Total ({sortedData.length})
                </td>

                <td className="dashboard-tfoot-total-leads">
                  {columnTotals.totalLeads}
                </td>

                {leadStatuses.map((s) => (
                  <td key={s} className="dashboard-tfoot-leads">
                    {columnTotals.leads[s] ?? 0}
                  </td>
                ))}

                <td className="dashboard-tfoot-total-logins">
                  {columnTotals.totalLogins}
                </td>

                {loginStatuses.map((s) => (
                  <td key={s} className="dashboard-tfoot-logins">
                    {columnTotals.logins[s] ?? 0}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </div>
    </div>
  );
}

// ─── Number Cell helper ───────────────────────────────────────────────────────
function Nc({ zone, className = "", style, children }) {
  const base = {
    padding: "11px 16px",
    textAlign: "center",
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: 600,
  };

  const dataZone = zone === "total-leads" ? "total-leads" : zone === "total-logins" ? "total-logins" : zone;

  return (
    <td data-zone={dataZone} className={className} style={{ ...base, ...style }}>
      {children}
    </td>
  );
}
