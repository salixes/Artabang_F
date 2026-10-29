import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import YieldReportSection from "../../components/YieldReportSection.jsx";
import { ASSISTANCE_TYPES, ASSISTANCE_STATUSES, ASSISTANCE_SOURCES } from "../../lib/businessRules";
import { markRenewals, REQUEST_KINDS, NEW_REQUEST, RENEWAL } from "../../lib/requestKind";

const SORTS = [
  { v: "newest", l: "Newest first" },
  { v: "oldest", l: "Oldest first" },
  { v: "new_first", l: "New requests first" },
  { v: "renewal_first", l: "Renewals first" },
  { v: "farmer", l: "Farmer A–Z" },
  { v: "type", l: "Type A–Z" },
  { v: "status", l: "Status" },
];

export default function Reports({ title = "Assistance Reports" }) {
  const [rows, setRows] = useState([]);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [farmerFilter, setFarmerFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [kindFilter, setKindFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    (async () => {
      const [{ data: assist }, { data: dir }] = await Promise.all([
        supabase.from("assistance_records").select("*").order("requested_at", { ascending: false }),
        supabase.from("farmer_directory").select("id, full_name"),
      ]);
      const nameById = Object.fromEntries((dir || []).map((d) => [d.id, d.full_name]));
      setRows(markRenewals((assist || []).map((a) => ({ ...a, farmer_name: nameById[a.farmer_id] || "—" }))));
    })();
  }, []);

  const farmerOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.farmer_name))).sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (typeFilter !== "All" && r.assistance_type !== typeFilter) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (sourceFilter !== "All" && r.source !== sourceFilter) return false;
    if (kindFilter !== "All" && r.request_kind !== kindFilter) return false;
    if (farmerFilter !== "All" && r.farmer_name !== farmerFilter) return false;
    if (dateFrom && new Date(r.requested_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(r.requested_at) > new Date(dateTo)) return false;
    return true;
  }), [rows, typeFilter, statusFilter, sourceFilter, farmerFilter, dateFrom, dateTo, kindFilter]);

  const sorted = useMemo(() => {
    const t = (r) => new Date(r.requested_at).getTime();
    const by = {
      newest: (a, b) => t(b) - t(a),
      oldest: (a, b) => t(a) - t(b),
      new_first: (a, b) => (a.request_kind === b.request_kind ? t(b) - t(a) : a.request_kind === NEW_REQUEST ? -1 : 1),
      renewal_first: (a, b) => (a.request_kind === b.request_kind ? t(b) - t(a) : a.request_kind === RENEWAL ? -1 : 1),
      farmer: (a, b) => a.farmer_name.localeCompare(b.farmer_name) || t(b) - t(a),
      type: (a, b) => a.assistance_type.localeCompare(b.assistance_type) || t(b) - t(a),
      status: (a, b) => a.status.localeCompare(b.status) || t(b) - t(a),
    };
    return [...filtered].sort(by[sortBy] || by.newest);
  }, [filtered, sortBy]);
  const newCount = filtered.filter((r) => r.request_kind === NEW_REQUEST).length;
  const renewalCount = filtered.length - newCount;

  function clearFilters() {
    setTypeFilter("All"); setStatusFilter("All"); setSourceFilter("All"); setFarmerFilter("All"); setDateFrom(""); setDateTo(""); setKindFilter("All"); setSortBy("newest");
  }

  return (
    <section>
      <div className="no-print">
        <div className="view-head">
          <h2><i className="fa-solid fa-file-invoice"></i> {title}</h2>
          <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Print</button>
        </div>
        <p className="hint-text"><i className="fa-solid fa-circle-info"></i> A plain, printable record of assistance distribution and the yield report. Filter below, then Print for a physical or PDF copy.</p>

        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head"><h3>Filters</h3><button className="btn-ghost" onClick={clearFilters}>Clear</button></div>
          <div className="rsbsa-grid" style={{ padding: "0 4px 8px" }}>
            <label>Assistance Type <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>All</option>{ASSISTANCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Status <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option>{ASSISTANCE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Source <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option>All</option>{ASSISTANCE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Farmer <select value={farmerFilter} onChange={(e) => setFarmerFilter(e.target.value)}><option>All</option>{farmerOptions.map((f) => <option key={f}>{f}</option>)}</select></label>
            <label>Date From <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
            <label>Date To <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
            <label>Request <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}><option>All</option>{REQUEST_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label>Sort by <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>{SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></label>
          </div>
        </div>
      </div>

      <div className="print-only print-report-header">
        <h1>AgriTabang — {title}</h1>
        <p>
          {typeFilter !== "All" ? `Type: ${typeFilter}  ` : ""}
          {statusFilter !== "All" ? `Status: ${statusFilter}  ` : ""}
          {sourceFilter !== "All" ? `Source: ${sourceFilter}  ` : ""}
          {farmerFilter !== "All" ? `Farmer: ${farmerFilter}  ` : ""}
          {(dateFrom || dateTo) ? `Date: ${dateFrom || "…"} to ${dateTo || "…"}` : ""}
          {typeFilter === "All" && statusFilter === "All" && sourceFilter === "All" && farmerFilter === "All" && !dateFrom && !dateTo ? "All Records" : ""}
        </p>
        <p>Generated {new Date().toLocaleString("en-PH")}</p>
      </div>

      <div className="table-panel">
        <table className="data-table print-table">
          <thead><tr><th>Farmer</th><th>Type</th><th>Request</th><th>Quantity</th><th>Source</th><th>Requested</th><th>Expected/Released</th><th>Notes</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records match these filters.</td></tr>}
            {sorted.map((r) => (
              <tr key={r.id}>
                <td>{r.farmer_name}</td><td>{r.assistance_type}</td><td><StatusBadge status={r.request_kind} /></td>
                <td>{r.quantity ? `${r.quantity} ${r.unit || ""}` : "—"}</td><td><SourceBadge source={r.source} /></td>
                <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td>
                <td>{r.distribution_date || r.expected_date || "—"}</td>
                <td>{r.value_description || "—"}</td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="hint-text no-print">{filtered.length} record{filtered.length === 1 ? "" : "s"} in this report — <b>{newCount}</b> new request{newCount === 1 ? "" : "s"} and <b>{renewalCount}</b> renewal{renewalCount === 1 ? "" : "s"}. A request is a <b>Renewal</b> when the farmer already made an earlier request for the same kind of assistance.</p>

      <YieldReportSection farmer={farmerFilter} dateFrom={dateFrom} dateTo={dateTo} />
    </section>
  );
}
