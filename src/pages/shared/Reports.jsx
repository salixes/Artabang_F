import React, { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import { supabase } from "../../lib/supabaseClient";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import { ASSISTANCE_TYPES, ASSISTANCE_STATUSES, ASSISTANCE_SOURCES } from "../../lib/businessRules";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function Reports({ title = "Assistance Reports" }) {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [farmerFilter, setFarmerFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: assist }, { data: dir }] = await Promise.all([
        supabase.from("assistance_records").select("*").order("requested_at", { ascending: false }),
        supabase.from("farmer_directory").select("id, full_name"),
      ]);
      setNames(Object.fromEntries((dir || []).map((d) => [d.id, d.full_name])));
      setRows((assist || []).map((a) => ({ ...a, farmer_name: (dir || []).find((d) => d.id === a.farmer_id)?.full_name || "—" })));
    })();
  }, []);

  const farmerOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.farmer_name))).sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (typeFilter !== "All" && r.assistance_type !== typeFilter) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (sourceFilter !== "All" && r.source !== sourceFilter) return false;
    if (farmerFilter !== "All" && r.farmer_name !== farmerFilter) return false;
    if (dateFrom && new Date(r.requested_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(r.requested_at) > new Date(dateTo)) return false;
    return true;
  }), [rows, typeFilter, statusFilter, sourceFilter, farmerFilter, dateFrom, dateTo]);

  const byType = ASSISTANCE_TYPES.map((t) => filtered.filter((r) => r.assistance_type === t).length);

  function clearFilters() {
    setTypeFilter("All"); setStatusFilter("All"); setSourceFilter("All"); setFarmerFilter("All"); setDateFrom(""); setDateTo("");
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-chart-pie"></i> {title}</h2></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Filter and view actual assistance records. Use the filters below to generate the report you need.</p>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3>Filters</h3><button className="btn-ghost" onClick={clearFilters}>Clear</button></div>
        <div className="rsbsa-grid" style={{ padding: "0 4px 8px" }}>
          <label>Assistance Type <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>All</option>{ASSISTANCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Status <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option>{ASSISTANCE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Source <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option>All</option>{ASSISTANCE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Farmer <select value={farmerFilter} onChange={(e) => setFarmerFilter(e.target.value)}><option>All</option>{farmerOptions.map((f) => <option key={f}>{f}</option>)}</select></label>
          <label>Date From <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label>Date To <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        </div>
      </div>

      <div className="table-panel" style={{ marginBottom: 18 }}>
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Type</th><th>Quantity</th><th>Source</th><th>Requested</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records match these filters.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.farmer_name}</td><td>{r.assistance_type}</td>
                <td>{r.quantity ? `${r.quantity} ${r.unit || ""}` : "—"}</td><td><SourceBadge source={r.source} /></td>
                <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td><td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="hint-text">{filtered.length} record{filtered.length === 1 ? "" : "s"} in this report.</p>

      <div className="panel">
        <div className="panel-head"><h3>Filtered Records by Type</h3></div>
        <div style={{ padding: 12 }}><Bar data={{ labels: ASSISTANCE_TYPES, datasets: [{ label: "Records", data: byType, backgroundColor: "#2F6B45" }] }} options={{ responsive: true, plugins: { legend: { display: false } } }} /></div>
      </div>
    </section>
  );
}
