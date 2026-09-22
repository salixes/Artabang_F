import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import { StatusBadge } from "../../components/Badges.jsx";

const REPORT_OPTIONS = [
  { value: "all", label: "All Yield Records" },
  { value: "verified", label: "Verified Yield" },
  { value: "pending", label: "Pending Yield" },
  { value: "by_crop", label: "Yield by Crop" },
  { value: "by_farmer", label: "Yield by Farmer" },
  { value: "by_date", label: "Yield by Date" },
];

function ReportTable({ rows, onVerify, onReject }) {
  return (
    <table className="data-table">
      <thead><tr><th>Farmer</th><th>Crop / Plant Name</th><th>Farm Area</th><th>Planting Date</th><th>Harvest Date</th><th>Yield Qty</th><th>Unit</th><th>Submitted</th><th>Status</th><th>Verified By</th><th></th></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.farmer_name}</td><td>{r.crop_name}</td><td>{r.farm_area ? `${r.farm_area} ha` : "—"}</td>
            <td>{r.planting_date || "—"}</td><td>{r.harvest_date}</td>
            <td>{Number(r.quantity).toLocaleString()}</td><td>{r.unit}</td>
            <td>{new Date(r.submitted_at).toLocaleDateString("en-PH")}</td>
            <td><StatusBadge status={r.status} /></td>
            <td>{r.verified_by_name || "—"}</td>
            <td>
              {r.status === "Pending" && (
                <>
                  <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => onVerify(r.id)}><i className="fa-solid fa-check"></i></button>{" "}
                  <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => onReject(r.id)}><i className="fa-solid fa-xmark"></i></button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupedReport({ rows, groupKey, groupLabel, onVerify, onReject }) {
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
      {groups.map(([key, groupRows]) => {
        const totalKg = groupRows.reduce((s, r) => s + Number(r.quantity_kg), 0);
        return (
          <div className="table-panel" key={key} style={{ marginBottom: 16 }}>
            <div className="panel-head" style={{ padding: "10px 14px" }}>
              <h3 style={{ fontSize: ".9rem" }}>{groupLabel}: {key}</h3>
              <span className="hint-text" style={{ margin: 0 }}>{groupRows.length} record{groupRows.length === 1 ? "" : "s"} · {totalKg.toLocaleString()} kg total</span>
            </div>
            <ReportTable rows={groupRows} onVerify={onVerify} onReject={onReject} />
          </div>
        );
      })}
    </>
  );
}

export default function YieldReports() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState("all");

  async function load() {
    const { data, error } = await supabase.from("yield_report").select("*").order("harvest_date", { ascending: false });
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("yield_records").update({ status, verified_by: user?.id }).eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(`Yield record marked ${status.toLowerCase()}.`, "fa-wheat-awn");
    load();
  }
  const onVerify = (id) => setStatus(id, "Verified");
  const onReject = (id) => setStatus(id, "Rejected");

  const filteredRows = useMemo(() => {
    if (report === "verified") return rows.filter((r) => r.status === "Verified");
    if (report === "pending") return rows.filter((r) => r.status === "Pending");
    if (report === "by_date") return [...rows].sort((a, b) => new Date(a.harvest_date) - new Date(b.harvest_date));
    return rows;
  }, [rows, report]);

  const totalKg = filteredRows.reduce((s, r) => s + Number(r.quantity_kg), 0);
  const verifiedCount = rows.filter((r) => r.status === "Verified").length;
  const pendingCount = rows.filter((r) => r.status === "Pending").length;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-file-lines"></i> Yield Reports</h2>
        <div className="head-actions">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".82rem", color: "var(--ink-soft)" }}>
            Select Report
            <select className="filter-select" value={report} onChange={(e) => setReport(e.target.value)}>
              {REPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Submitted farmer harvest data, presented as a report. Farm Area and Planting Date are pulled from each farmer's matching Crop Registration.</p>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card ring-total"><div className="stat-num">{filteredRows.length}</div><div className="stat-label">Records in this report</div></div>
        <div className="stat-card ring-resolved"><div className="stat-num">{verifiedCount}</div><div className="stat-label">Verified (all-time)</div></div>
        <div className="stat-card ring-pending"><div className="stat-num">{pendingCount}</div><div className="stat-label">Pending (all-time)</div></div>
        <div className="stat-card ring-progress"><div className="stat-num">{totalKg.toLocaleString()}</div><div className="stat-label">Total (kg-equivalent) in this report</div></div>
      </div>

      {report === "by_crop" && <GroupedReport rows={rows} groupKey="crop_name" groupLabel="Crop" onVerify={onVerify} onReject={onReject} />}
      {report === "by_farmer" && <GroupedReport rows={rows} groupKey="farmer_name" groupLabel="Farmer" onVerify={onVerify} onReject={onReject} />}
      {["all", "verified", "pending", "by_date"].includes(report) && (
        <div className="table-panel"><ReportTable rows={filteredRows} onVerify={onVerify} onReject={onReject} /></div>
      )}
    </section>
  );
}
