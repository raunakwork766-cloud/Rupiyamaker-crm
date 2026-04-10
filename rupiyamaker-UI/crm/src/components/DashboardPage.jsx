import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { buildApiUrl } from "../config/api";
import { getUserPermissions, isSuperAdmin, hasPermission } from "../utils/permissions";

// ─── Constants ───────────────────────────────────────────────────────────────
const LEAD_STATUSES = ["ACTIVE LEADS", "NOT A LEAD", "LOST BY MISTAKE", "LOST LEAD"];
const LOGIN_STATUSES = [
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
// Determine dashboard permission level from stored permissions
function getDashboardPermissionLevel() {
  const perms = getUserPermissions();
  if (isSuperAdmin(perms)) return "all";
  if (hasPermission(perms, "dashboard", "all")) return "all";
  if (hasPermission(perms, "dashboard", "junior")) return "junior";
  if (hasPermission(perms, "dashboard", "own")) return "own";
  // Fallback: if super admin wildcard
  return "all";
}

export default function DashboardPage() {
  const userId = localStorage.getItem("userId") || "";
  const token = localStorage.getItem("token") || "";
  const permissionLevel = useMemo(() => getDashboardPermissionLevel(), []);

  // Filter state
  const [timeFilter, setTimeFilter] = useState("today");
  const [customRange, setCustomRange] = useState([null, null]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customMode, setCustomMode] = useState("range"); // "single" | "range"

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
      const insidePicker = datePickerWrapRef.current && datePickerWrapRef.current.contains(e.target);
      const insideDropdown = timeDropdownRef.current && timeDropdownRef.current.contains(e.target);
      if (!insidePicker && !insideDropdown) {
        setShowDatePicker(false);
        setShowTimeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  // Build query params for API call
  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ user_id: userId, time_filter: timeFilter, permission_level: permissionLevel });
    if (timeFilter === "custom") {
      const [s, e] = customRange;
      if (s) p.set("date_from", s.toISOString().slice(0, 10));
      if (e) p.set("date_to", e.toISOString().slice(0, 10));
      else if (s) p.set("date_to", s.toISOString().slice(0, 10));
    }
    if (empStatusFilter !== "all") p.set("emp_status", empStatusFilter);
    return p;
  }, [userId, timeFilter, customRange, empStatusFilter, permissionLevel]);

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
    { val: "tomorrow", label: "Tomorrow" },
    { val: "this_week", label: "This Week" },
    { val: "this_month", label: "This Month" },
    { val: "all_time", label: "All Time" },
  ];

  const handleTimeChange = (val) => {
    setShowTimeDropdown(false);
    if (val === "custom") {
      setTimeFilter("custom");
      setCustomRange([null, null]);
      setCustomMode("range");
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

            {/* Date picker popup */}
            {showDatePicker && (
              <div
                ref={datePickerWrapRef}
                style={{ position: "absolute", top: 44, left: 0, zIndex: 1000, background: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", overflow: "hidden", minWidth: 300 }}
              >
                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
                  {["single", "range"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setCustomMode(mode);
                        setCustomRange([null, null]);
                      }}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        border: "none",
                        borderBottom: customMode === mode ? "2px solid #0f172a" : "2px solid transparent",
                        background: "transparent",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 700,
                        color: customMode === mode ? "#0f172a" : "#94a3b8",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        transition: "all 0.15s",
                      }}
                    >
                      {mode === "single" ? "Single Date" : "Date Range"}
                    </button>
                  ))}
                </div>

                {/* Calendar */}
                {customMode === "single" ? (
                  <DatePicker
                    selected={customRange[0]}
                    onChange={(date) => setCustomRange([date, date])}
                    inline
                    monthsShown={1}
                  />
                ) : (
                  <DatePicker
                    selectsRange
                    startDate={customRange[0]}
                    endDate={customRange[1]}
                    onChange={(dates) => setCustomRange(dates)}
                    inline
                    monthsShown={1}
                  />
                )}

                {/* Footer */}
                <div style={{ padding: "8px 12px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    {customMode === "single"
                      ? customRange[0]
                        ? customRange[0].toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "Select a date"
                      : customRange[0] && customRange[1]
                        ? `${customRange[0].toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${customRange[1].toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                        : customRange[0]
                          ? "Select end date"
                          : "Select start date"
                    }
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setCustomRange([null, null]); setShowDatePicker(false); setTimeFilter("today"); }}
                      style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#64748b" }}
                    >Clear</button>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#0f172a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >Apply</button>
                  </div>
                </div>
              </div>
            )}

            <div style={S.dateLabel}>
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
              <option value="all">All Employees</option>
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
                  zIndex: 40,
                }}
              >
                Identity
              </th>
              <th
                colSpan={5}
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
                colSpan={7}
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
                  textAlign: "left",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 45,
                  left: 160,
                  zIndex: 40,
                  borderRight: "2px solid #94a3b8",
                }}
              >
                Team
              </TH>

              {/* Leads */}
              <TH col="totalLeads" style={{ background: "#dbeafe", color: "#1e40af" }}>
                Total Leads
              </TH>
              <TH col="leads.ACTIVE LEADS">Active Leads</TH>
              <TH col="leads.NOT A LEAD">Not a Lead</TH>
              <TH col="leads.LOST BY MISTAKE">Lost By Mistake</TH>
              <TH col="leads.LOST LEAD">Lost Lead</TH>

              {/* Logins */}
              <TH col="totalLogins" style={{ background: "#d1fae5", color: "#166534", borderLeft: "4px solid #475569" }}>
                Total Logins
              </TH>
              <TH col="logins.ACTIVE LOGIN">Active Login</TH>
              <TH col="logins.APPROVED">Approved</TH>
              <TH col="logins.DISBURSED">Disbursed</TH>
              <TH col="logins.LOST BY MISTAKE">Lost By Mistake</TH>
              <TH col="logins.LOST LOGIN">Lost Login</TH>
              <TH col="logins.MULTI LOGIN DISBURSED BY US BY OTHER BANK">Multi Login</TH>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={14}
                  style={{ textAlign: "center", padding: 40, color: "#64748b", fontSize: 15 }}
                >
                  Loading...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={14}
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
                      zIndex: 10,
                      background: "#fff",
                      fontWeight: 700,
                      color: "#0f172a",
                      minWidth: 160,
                    }}
                  >
                    {row.name}
                  </td>

                  {/* Team */}
                  <td
                    data-zone="identity"
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #e2e8f0",
                      position: "sticky",
                      left: 160,
                      zIndex: 10,
                      background: "#fff",
                      fontWeight: 700,
                      color: "#0f172a",
                      borderRight: "2px solid #94a3b8",
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

                  {/* Lead Statuses */}
                  <Nc zone="leads" style={{ color: "#2563eb" }}>{row.leads["ACTIVE LEADS"] ?? 0}</Nc>
                  <Nc zone="leads" style={{ color: "#64748b" }}>{row.leads["NOT A LEAD"] ?? 0}</Nc>
                  <Nc zone="leads" style={{ color: "#ef4444" }}>{row.leads["LOST BY MISTAKE"] ?? 0}</Nc>
                  <Nc zone="leads" style={{ color: "#ef4444" }}>{row.leads["LOST LEAD"] ?? 0}</Nc>

                  {/* Total Logins */}
                  <Nc
                    zone="total-logins"
                    style={{ background: "#dcfce7", color: "#064e3b", fontSize: 14, borderLeft: "4px solid #475569" }}
                  >
                    {row.totalLogins}
                  </Nc>

                  {/* Login Statuses */}
                  <Nc zone="logins" style={{ color: "#059669" }}>{row.logins["ACTIVE LOGIN"] ?? 0}</Nc>
                  <Nc zone="logins" style={{ color: "#15803d" }}>{row.logins["APPROVED"] ?? 0}</Nc>
                  <Nc zone="logins" style={{ color: "#065f46", fontSize: 15 }}>{row.logins["DISBURSED"] ?? 0}</Nc>
                  <Nc zone="logins" style={{ color: "#ef4444" }}>{row.logins["LOST BY MISTAKE"] ?? 0}</Nc>
                  <Nc zone="logins" style={{ color: "#ef4444" }}>{row.logins["LOST LOGIN"] ?? 0}</Nc>
                  <Nc zone="logins" style={{ color: "#64748b" }}>
                    {row.logins["MULTI LOGIN DISBURSED BY US BY OTHER BANK"] ?? 0}
                  </Nc>
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
