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
    style={{
      width: "100%",
      padding: "11px 14px",
      border: "1.5px solid #e2e8f0",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 500,
      color: "#0f172a",
      fontFamily: "'Inter', sans-serif",
      cursor: "pointer",
      background: "#fff",
      boxSizing: "border-box",
      outline: "none",
    }}
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
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 36,
          outline: "none",
        }}
      >
        <span style={{ color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {triggerText}
        </span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            maxHeight: 250,
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "4px 0" }}>
            {/* All option */}
            <label
              style={{
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={selected.length === 0}
                onChange={() => onChange([])}
                style={{ cursor: "pointer", width: 14, height: 14 }}
              />
              All
            </label>
            {filtered.map((opt) => (
              <label
                key={opt}
                style={{
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  style={{ cursor: "pointer", width: 14, height: 14 }}
                />
                {opt}
              </label>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "10px 14px", color: "#64748b", fontSize: 13 }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Sort Header ──────────────────────────────────────────────────────────────
const SortIcon = ({ col, sortCol, asc }) => {
  if (sortCol !== col) return <span style={{ color: "#94a3b8", marginLeft: 4, fontSize: 10 }}>⇅</span>;
  return <span style={{ color: "#3b82f6", marginLeft: 4, fontSize: 10 }}>{asc ? "▲" : "▼"}</span>;
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const userId = localStorage.getItem("userId") || "";
  const token = localStorage.getItem("token") || "";

  // Filter state
  const [timeFilter, setTimeFilter] = useState("today");
  const [customRange, setCustomRange] = useState([null, null]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customMode, setCustomMode] = useState("range"); // "single" | "range"

  // Modal temp state (tracks selections inside modal before Apply)
  const [modalTempRange, setModalTempRange] = useState([null, null]);
  const [modalTempMode, setModalTempMode] = useState("range");
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

  // Fetch teams / employees list once
  useEffect(() => {
    if (!userId) return;
    fetch(buildApiUrl(`/dashboard/teams?user_id=${userId}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setAllTeams(data.teams || []);
        setAllEmployees(data.employees || []);
      })
      .catch(() => {});
  }, [userId, token]);

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

      let employees = data.employees || [];

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

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    wrapper: {
      fontFamily: "'Inter', sans-serif",
      background: "#f1f5f9",
      color: "#0f172a",
      padding: 16,
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      fontSize: 13,
      overflow: "hidden",
      gap: 12,
    },
    navRoot: { display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 },
    navRow: {
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)",
      border: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    row1: { padding: "8px 20px", gap: 24 },
    row2: { padding: "10px 20px", gap: 16 },
    timeSel: {
      display: "flex",
      alignItems: "center",
      color: "#fff",
      background: "#0f172a",
      padding: "8px 14px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      border: "none",
      cursor: "pointer",
      outline: "none",
      marginTop: 4,
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    },
    dateLabel: {
      fontSize: 18,
      fontWeight: 900,
      color: "#0f172a",
      letterSpacing: "-0.5px",
      whiteSpace: "nowrap",
      lineHeight: 1.25,
    },
    kpiGroup: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flex: 1 },
    kpi: (variant) => ({
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "10px 24px",
      borderRadius: 10,
      border: "1px solid",
      flex: 1,
      boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      ...(variant === "leads"
        ? { background: "linear-gradient(145deg,#f0f9ff,#e0f2fe)", borderColor: "#bae6fd" }
        : { background: "linear-gradient(145deg,#f0fdf4,#dcfce7)", borderColor: "#bbf7d0" }),
    }),
    kpiIcon: (variant) => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 44,
      height: 44,
      borderRadius: 10,
      background: "#fff",
      flexShrink: 0,
      color: variant === "leads" ? "#0284c7" : "#16a34a",
      border: `1px solid ${variant === "leads" ? "#bae6fd" : "#bbf7d0"}`,
    }),
    kpiLbl: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#475569", letterSpacing: "0.5px", lineHeight: 1 },
    kpiVal: { fontSize: 26, fontWeight: 900, color: "#0f172a", lineHeight: 1 },
    searchInput: {
      width: "100%",
      padding: "9px 14px 9px 40px",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      background: "#f8fafc",
      color: "#0f172a",
      fontSize: 13,
      fontFamily: "inherit",
      fontWeight: 600,
      outline: "none",
    },
    filterItem: { display: "flex", alignItems: "center", gap: 12, position: "relative", minWidth: 200 },
    filterLabel: {
      fontWeight: 800,
      color: "#64748b",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      whiteSpace: "nowrap",
    },
    tableContainer: {
      flexGrow: 1,
      background: "#fff",
      borderRadius: 10,
      boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
      border: "1px solid #e2e8f0",
      overflow: "auto",
    },
  };

  const TH = ({ col, children, style, className }) => (
    <th
      className={className}
      onClick={col ? () => handleSort(col) : undefined}
      style={{
        cursor: col ? "pointer" : "default",
        userSelect: "none",
        fontWeight: 700,
        fontSize: 12,
        padding: "12px 16px",
        borderBottom: "1px solid #e2e8f0",
        textAlign: "center",
        background: "#f8fafc",
        color: "#64748b",
        position: "sticky",
        top: 45,
        zIndex: 20,
        ...style,
      }}
    >
      {children}
      {col && <SortIcon col={col} sortCol={sortCol} asc={sortAsc} />}
    </th>
  );

  return (
    <div style={S.wrapper}>
      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      {/* react-datepicker calendar — match flatpickr clean style */}
      <style>{`
        .rdp-dashboard .react-datepicker {
          font-family: 'Inter', sans-serif !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.12) !important;
          overflow: hidden;
        }
        .rdp-dashboard .react-datepicker__header {
          background: #fff !important;
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 12px 0 0 !important;
        }
        .rdp-dashboard .react-datepicker__current-month {
          font-size: 14px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          margin-bottom: 8px;
        }
        .rdp-dashboard .react-datepicker__day-name {
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #64748b !important;
          width: 36px !important;
          line-height: 36px !important;
        }
        .rdp-dashboard .react-datepicker__day {
          width: 36px !important;
          line-height: 36px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #0f172a !important;
          border-radius: 6px !important;
          margin: 1px !important;
        }
        .rdp-dashboard .react-datepicker__day:hover {
          background: #e2e8f0 !important;
          border-radius: 6px !important;
        }
        .rdp-dashboard .react-datepicker__day--selected,
        .rdp-dashboard .react-datepicker__day--range-start,
        .rdp-dashboard .react-datepicker__day--range-end {
          background: #0f172a !important;
          color: #fff !important;
          font-weight: 700 !important;
          border-radius: 6px !important;
        }
        .rdp-dashboard .react-datepicker__day--in-range,
        .rdp-dashboard .react-datepicker__day--in-selecting-range {
          background: #e2e8f0 !important;
          color: #0f172a !important;
          border-radius: 0 !important;
        }
        .rdp-dashboard .react-datepicker__day--keyboard-selected {
          background: #f1f5f9 !important;
          color: #0f172a !important;
        }
        .rdp-dashboard .react-datepicker__day--today {
          font-weight: 800 !important;
          color: #2563eb !important;
        }
        .rdp-dashboard .react-datepicker__day--today.react-datepicker__day--selected {
          color: #fff !important;
        }
        .rdp-dashboard .react-datepicker__day--outside-month {
          color: #94a3b8 !important;
        }
        .rdp-dashboard .react-datepicker__navigation--previous,
        .rdp-dashboard .react-datepicker__navigation--next {
          top: 14px !important;
        }
        .rdp-dashboard .react-datepicker__triangle { display: none !important; }
        .rdp-dashboard .react-datepicker-popper { z-index: 9999 !important; }
      `}</style>

      {/* ─── Control Rows ─── */}
      <div style={S.navRoot}>
        {/* Row 1: Time + KPIs */}
        <div style={{ ...S.navRow, ...S.row1 }}>
          {/* Time filter — custom dropdown */}
          <div ref={timeDropdownRef} style={{ display: "flex", alignItems: "flex-start", gap: 6, minWidth: "max-content", position: "relative", flexWrap: "wrap" }}>
            {/* Trigger button */}
            <button
              onClick={() => {
                setShowDatePicker(false);
                setShowTimeDropdown((prev) => !prev);
              }}
              style={S.timeSel}
            >
              {getTimeLabel()}
              <svg style={{ marginLeft: 6, flexShrink: 0 }} width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* Dropdown list */}
            {showTimeDropdown && (
              <div style={{ position: "absolute", top: 44, left: 0, zIndex: 1001, background: "#fff", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0", overflow: "hidden", minWidth: 170 }}>
                {TIME_OPTIONS.map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => handleTimeChange(val)}
                    style={{
                      display: "block", width: "100%", padding: "10px 16px",
                      border: "none", background: timeFilter === val ? "#f1f5f9" : "transparent",
                      color: timeFilter === val ? "#0f172a" : "#475569",
                      fontFamily: "inherit", fontSize: 13, fontWeight: timeFilter === val ? 700 : 500,
                      textAlign: "left", cursor: "pointer",
                    }}
                  >{label}</button>
                ))}
                <div style={{ borderTop: "1px solid #e2e8f0" }}>
                  <button
                    onClick={() => handleTimeChange("custom")}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 16px",
                      border: "none", background: timeFilter === "custom" ? "#f1f5f9" : "transparent",
                      color: timeFilter === "custom" ? "#0f172a" : "#475569",
                      fontFamily: "inherit", fontSize: 13, fontWeight: timeFilter === "custom" ? 700 : 500,
                      textAlign: "left", cursor: "pointer",
                    }}
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
              </div>
            )}

            {/* Custom Date Modal — clean card with toggle + inputs + Cancel/Apply */}
            {showDatePicker && (
              <div
                ref={datePickerWrapRef}
                style={{
                  position: "absolute",
                  top: 52,
                  left: 0,
                  zIndex: 1200,
                  background: "#fff",
                  borderRadius: 14,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)",
                  border: "1px solid #e2e8f0",
                  padding: "20px",
                  minWidth: 310,
                  maxWidth: 360,
                }}
              >
                {/* Single Date / Date Range toggle */}
                <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 }}>
                  {[
                    { key: "single", label: "Single Date" },
                    { key: "range", label: "Date Range" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setModalTempMode(key);
                        setModalTempRange([null, null]);
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        border: "none",
                        borderRadius: 7,
                        background: modalTempMode === key ? "#fff" : "transparent",
                        boxShadow: modalTempMode === key ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: 600,
                        color: modalTempMode === key ? "#0f172a" : "#64748b",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Date input(s) */}
                {modalTempMode === "single" ? (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                      SELECT DATE
                    </label>
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
                      <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                        START DATE
                      </label>
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
                      <label style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                        END DATE
                      </label>
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

                {/* Cancel / Apply buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleCancelDateModal}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#fff",
                      color: "#475569",
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyDateModal}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      border: "none",
                      borderRadius: 8,
                      background: "#0f172a",
                      color: "#fff",
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity:
                        (modalTempMode === "single" && modalTempRange[0]) ||
                        (modalTempMode === "range" && modalTempRange[0] && modalTempRange[1])
                          ? 1
                          : 0.45,
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                ...S.dateLabel,
                ...(timeFilter === "custom" && customRange[0] ? { cursor: "pointer" } : {}),
              }}
              onClick={() => {
                if (timeFilter === "custom" && customRange[0] && !showDatePicker) {
                  setModalTempRange([...customRange]);
                  setModalTempMode(customMode);
                  setShowDatePicker(true);
                }
              }}
              title={timeFilter === "custom" && customRange[0] ? "Click to edit date" : undefined}
            >
              {dateLabel.split("  →  ").map((part, i, arr) => (
                <div key={i}>
                  {i > 0 && <span style={{ fontSize: 14, color: "#64748b" }}>→ </span>}
                  {part}
                </div>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div style={S.kpiGroup}>
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
              <div key={variant} style={S.kpi(variant)}>
                <div style={S.kpiIcon(variant)}>{icon}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={S.kpiLbl}>{label}</span>
                  <span style={S.kpiVal}>{loading ? "—" : value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2: Search + Filters */}
        <div style={{ ...S.navRow, ...S.row2 }}>
          {/* Search */}
          <div style={{ flex: 1, position: "relative" }}>
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx={11} cy={11} r={8} />
              <line x1={21} y1={21} x2={16.65} y2={16.65} />
            </svg>
            <input
              type="text"
              placeholder="Search employee, team..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              style={S.searchInput}
            />
          </div>

          {/* Team filter */}
          <div style={{ flex: 1, maxWidth: 280 }}>
            <MultiSelect
              options={allTeams}
              selected={selectedTeams}
              onChange={setSelectedTeams}
              placeholder="All Teams"
            />
          </div>

          {/* Employee filter */}
          <div style={{ flex: 1, maxWidth: 280 }}>
            <MultiSelect
              options={allEmployees.map((e) => e.name)}
              selected={selectedEmployees}
              onChange={setSelectedEmployees}
              placeholder="All Employees"
            />
          </div>

          {/* Employee Status filter */}
          <div style={{ flexShrink: 0 }}>
            <select
              value={empStatusFilter}
              onChange={(e) => setEmpStatusFilter(e.target.value)}
              style={{
                padding: "8px 32px 8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#f8fafc",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                height: 36,
                color: "#0f172a",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div style={S.tableContainer}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            textAlign: "left",
            whiteSpace: "nowrap",
          }}
        >
          <thead>
            {/* Group headers */}
            <tr>
              <th
                colSpan={2}
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: 14,
                  borderBottom: "2px solid #000",
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 50,
                  boxShadow: "2px 0 0 0 #94a3b8",
                }}
              >
                Identity
              </th>
              <th
                colSpan={1 + leadStatuses.length}
                style={{
                  background: "#1e3a8a",
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: 14,
                  borderBottom: "2px solid #172554",
                  position: "sticky",
                  top: 0,
                  zIndex: 30,
                }}
              >
                Leads Pipeline Zone
              </th>
              <th
                colSpan={1 + loginStatuses.length}
                style={{
                  background: "#064e3b",
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: 14,
                  borderBottom: "2px solid #022c22",
                  borderLeft: "4px solid #475569",
                  position: "sticky",
                  top: 0,
                  zIndex: 30,
                }}
              >
                Logins Pipeline Zone
              </th>
            </tr>

            {/* Sub-headers */}
            <tr>
              {/* Identity */}
              <TH
                col="name"
                style={{
                  minWidth: 160,
                  width: 160,
                  textAlign: "left",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 45,
                  left: 0,
                  zIndex: 40,
                }}
              >
                Employee Name
              </TH>
              <TH
                col="team"
                style={{
                  minWidth: 100,
                  width: 100,
                  textAlign: "left",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 45,
                  left: 160,
                  zIndex: 40,
                  borderRight: "2px solid #94a3b8",
                  boxShadow: "2px 0 5px rgba(0,0,0,0.08)",
                }}
              >
                Team
              </TH>

              {/* Leads — dynamic */}
              <TH col="totalLeads" style={{ background: "#dbeafe", color: "#1e40af" }}>
                Total Leads
              </TH>
              {leadStatuses.map((s) => (
                <TH key={s} col={`leads.${s}`}>{s.replace(/_/g, " ")}</TH>
              ))}

              {/* Logins — dynamic */}
              <TH col="totalLogins" style={{ background: "#d1fae5", color: "#166534", borderLeft: "4px solid #475569" }}>
                Total Logins
              </TH>
              {loginStatuses.map((s) => (
                <TH key={s} col={`logins.${s}`}>{s.replace(/_/g, " ")}</TH>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={2 + 1 + leadStatuses.length + 1 + loginStatuses.length}
                  style={{ textAlign: "center", padding: 40, color: "#64748b", fontSize: 15 }}
                >
                  Loading...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + 1 + leadStatuses.length + 1 + loginStatuses.length}
                  style={{ textAlign: "center", padding: 40, color: "#64748b", fontSize: 15 }}
                >
                  No records found. Try adjusting criteria.
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={row.id}
                  style={{ transition: "background 0.15s" }}
                  onMouseEnter={(e) => {
                    Array.from(e.currentTarget.cells).forEach((td) => {
                      if (td.dataset.zone === "leads") td.style.background = "#f1f5f9";
                      else if (td.dataset.zone === "logins") td.style.background = "#e6f4ea";
                      else if (td.dataset.zone === "identity") td.style.background = "#f8fafc";
                    });
                  }}
                  onMouseLeave={(e) => {
                    Array.from(e.currentTarget.cells).forEach((td) => {
                      if (td.dataset.zone === "leads") td.style.background = "#f8fafc";
                      else if (td.dataset.zone === "logins") td.style.background = "#f0fdf4";
                      else if (td.dataset.zone === "identity") td.style.background = "#fff";
                    });
                  }}
                >
                  {/* Employee Name */}
                  <td
                    data-zone="identity"
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e2e8f0",
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      background: row.isAssignedView ? "#fffbeb" : "#fff",
                      fontWeight: 700,
                      color: "#0f172a",
                      minWidth: 160,
                      width: 160,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{row.name}</span>
                      {row.isAssignedView && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.5px",
                          color: "#92400e",
                          background: "#fef3c7",
                          border: "1px solid #fcd34d",
                          borderRadius: 4,
                          padding: "1px 5px",
                          textTransform: "uppercase",
                        }}>
                          Assigned
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Team */}
                  <td
                    data-zone="identity"
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e2e8f0",
                      position: "sticky",
                      left: 160,
                      zIndex: 3,
                      background: "#fff",
                      fontWeight: 700,
                      color: "#0f172a",
                      minWidth: 100,
                      width: 100,
                      borderRight: "2px solid #94a3b8",
                      boxShadow: "2px 0 5px rgba(0,0,0,0.08)",
                    }}
                  >
                    {row.team}
                  </td>

                  {/* Total Leads */}
                  <Nc
                    zone="total-leads"
                    style={{ background: "#eff6ff", color: "#1e3a8a", fontSize: 14 }}
                  >
                    {row.totalLeads}
                  </Nc>

                  {/* Lead Statuses — dynamic */}
                  {leadStatuses.map((s) => (
                    <Nc key={s} zone="leads" style={{ color: "#2563eb" }}>{row.leads[s] ?? 0}</Nc>
                  ))}

                  {/* Total Logins */}
                  <Nc
                    zone="total-logins"
                    style={{ background: "#dcfce7", color: "#064e3b", fontSize: 14, borderLeft: "4px solid #475569" }}
                  >
                    {row.totalLogins}
                  </Nc>

                  {/* Login Statuses — dynamic */}
                  {loginStatuses.map((s) => (
                    <Nc key={s} zone="logins" style={{ color: "#059669" }}>{row.logins[s] ?? 0}</Nc>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Number Cell helper ───────────────────────────────────────────────────────
function Nc({ zone, style, children }) {
  const base = {
    padding: "12px 16px",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "center",
    fontFamily: "'SFMono-Regular', Consolas, monospace",
    fontSize: 14,
    fontWeight: 600,
  };

  let bg = {};
  if (zone === "leads") bg = { background: "#f8fafc" };
  if (zone === "logins") bg = { background: "#f0fdf4" };
  if (zone === "total-leads") bg = { fontWeight: 800 };
  if (zone === "total-logins") bg = { fontWeight: 800 };

  return (
    <td data-zone={zone === "total-leads" ? "leads" : zone === "total-logins" ? "logins" : zone} style={{ ...base, ...bg, ...style }}>
      {children}
    </td>
  );
}
