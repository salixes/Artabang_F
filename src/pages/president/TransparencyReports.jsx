import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import YieldReportSection from "../../components/YieldReportSection.jsx";
import { ASSISTANCE_TYPES } from "../../lib/businessRules";
import { markRenewals } from "../../lib/requestKind";
import { useMemberScope, inScope } from "../../lib/memberScope";

const REPORT_OPTIONS = [
  { value: "all", label: "All Assistance Records" },
  { value: "by_type", label: "By Assistance Type" },
  { value: "by_status", label: "By Status" },
  { value: "by_farmer", label: "By Farmer" },
  { value: "by_request", label: "New Requests vs Renewals" },
];

function FlatTable({ rows }) {
  return (
    <table className="data-table print-table">
      <thead><tr><th>Farmer</th><th>Type</th><th>Request</th><th>Quantity</th><th>Source</th><th>Requested</th><th>Status</th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.farmer_name}</td><td>{r.assistance_type}</td><td><StatusBadge status={r.request_kind} /></td>
            <td>{r.quantity ? `${r.quantity} ${r.unit || ""}` : "—"}</td><td><SourceBadge source={r.source} /></td>
            <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td><td><StatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupedTable({ rows, groupKey }) {
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r[groupKey] || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, groupKey]);

  return (
    <>
      {groups.map(([key, groupRows]) => (
        <div key={key} style={{ marginBottom: 18 }}>
          <h4 style={{ fontFamily: "var(--font-display)", color: "var(--forest-deep)", margin: "0 0 6px" }}>{key} ({groupRows.length})</h4>
          <FlatTable rows={groupRows} />
        </div>
      ))}
    </>
  );
}

export default function TransparencyReports() {
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");
  const scope = useMemberScope(); // only members of the association

  useEffect(() => {
    (async () => {
      const [{ data: assist }, { data: dir }] = await Promise.all([
        supabase.from("assistance_records").select("*").order("requested_at", { ascending: false }),
        supabase.from("farmer_directory").select("id, full_name"),
      ]);
      const nameById = Object.fromEntries((dir || []).map((d) => [d.id, d.full_name]));
      setRows((assist || []).map((a) => ({ ...a, farmer_name: nameById[a.farmer_id] || "—" })));
    })();
  }, []);

  // New Request / Renewal is worked out on the association members' records
  const scoped = useMemo(() => markRenewals(rows.filter((r) => inScope(scope, r.farmer_id))), [rows, scope]);
  const filteredRows = useMemo(() => {
    if (report === "by_status" && statusFilter !== "All") return scoped.filter((r) => r.status === statusFilter);
    return scoped;
  }, [scoped, report, statusFilter]);

  return (
    <section>
      <div className="no-print">
        <div className="view-head">
          <h2><i className="fa-solid fa-file-invoice"></i> Transparency Reports</h2>
          <div className="head-actions">
            <select className="filter-select" value={report} onChange={(e) => setReport(e.target.value)}>
              {REPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {report === "by_status" && (
              <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option>All</option><option>Pending</option><option>Under Review</option><option>Incoming</option><option>Released</option><option>Denied</option>
              </select>
            )}
            <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Print</button>
          </div>
        </div>
        <p className="hint-text"><i className="fa-solid fa-circle-info"></i> A plain, printable record of assistance distribution — select a report type above, then Print for a physical or PDF copy.</p>
      </div>

      <div className="print-report-page">
        <div className="print-only print-report-header">
          <h1>AgriTabang — Transparency Report</h1>
          <p>{REPORT_OPTIONS.find((o) => o.value === report)?.label}{report === "by_status" && statusFilter !== "All" ? ` — ${statusFilter}` : ""}</p>
          <p>Generated {new Date().toLocaleString("en-PH")}</p>
        </div>

        <div className="table-panel">
          {report === "all" && <FlatTable rows={filteredRows} />}
          {report === "by_status" && <FlatTable rows={filteredRows} />}
          {report === "by_type" && <GroupedTable rows={filteredRows} groupKey="assistance_type" />}
          {report === "by_farmer" && <GroupedTable rows={filteredRows} groupKey="farmer_name" />}
          {report === "by_request" && <GroupedTable rows={filteredRows} groupKey="request_kind" />}
        </div>

        <p className="hint-text no-print">{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"} in this report.</p>

        <YieldReportSection />
      </div>
    </section>
  );
}
