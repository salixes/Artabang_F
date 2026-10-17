import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const STATUS_COLS = [
  { key: "Pending", label: "Pending", also: ["Under Review"] },
  { key: "Incoming", label: "Incoming" },
  { key: "Released", label: "Released" },
  { key: "Denied", label: "Denied" },
];

// Dashboard summary of the two reports: Assistance Report + Yield Report (staff dashboards).
export default function ReportSummary({ basePath = "/admin" }) {
  const navigate = useNavigate();
  const [assist, setAssist] = useState(null);
  const [yields, setYields] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: y }] = await Promise.all([
        supabase.from("assistance_records").select("assistance_type, status"),
        supabase.from("yield_records").select("crop_name, status, quantity_kg"),
      ]);
      setAssist(a || []);
      setYields(y || []);
    })();
  }, []);

  const assistRows = useMemo(() => {
    const by = {};
    (assist || []).forEach((r) => {
      const t = (by[r.assistance_type] ||= { type: r.assistance_type, total: 0 });
      t.total += 1;
      const col = STATUS_COLS.find((c) => c.key === r.status || (c.also || []).includes(r.status));
      if (col) t[col.key] = (t[col.key] || 0) + 1;
    });
    return Object.values(by).sort((a, b) => b.total - a.total);
  }, [assist]);

  const yieldRows = useMemo(() => {
    const by = {};
    (yields || []).forEach((r) => {
      const c = (by[r.crop_name] ||= { crop: r.crop_name, records: 0, verified: 0, kg: 0 });
      c.records += 1;
      if (r.status === "Verified") { c.verified += 1; c.kg += Number(r.quantity_kg) || 0; }
    });
    return Object.values(by).sort((a, b) => b.kg - a.kg);
  }, [yields]);

  if (!assist || !yields) return null;
  const sum = (k) => assistRows.reduce((s, r) => s + (r[k] || 0), 0);
  const totalKg = yieldRows.reduce((s, r) => s + r.kg, 0);
  const link = (to) => (e) => { e.preventDefault(); navigate(to); };

  return (
    <div className="dash-grid report-summary" style={{ marginTop: 18 }}>
      <div className="panel">
        <div className="panel-head"><h3><i className="fa-solid fa-file-invoice"></i> Assistance Report</h3>
          <a href="#" className="link-more" onClick={link(`${basePath}/reports`)}>Full report</a></div>
        <div className="table-panel no-shadow">
          <table className="data-table compact">
            <thead><tr><th>Type</th>{STATUS_COLS.map((c) => <th key={c.key}>{c.label}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {assistRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No assistance records yet.</td></tr>}
              {assistRows.map((r) => (
                <tr key={r.type}><td>{r.type}</td>{STATUS_COLS.map((c) => <td key={c.key}>{r[c.key] || 0}</td>)}<td><b>{r.total}</b></td></tr>
              ))}
              {assistRows.length > 0 && (
                <tr><td><b>All types</b></td>{STATUS_COLS.map((c) => <td key={c.key}><b>{sum(c.key)}</b></td>)}<td><b>{sum("total")}</b></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3><i className="fa-solid fa-wheat-awn"></i> Yield Report</h3>
          <a href="#" className="link-more" onClick={link(basePath === "/admin" ? "/admin/yield" : `${basePath}/reports`)}>Full report</a></div>
        <div className="table-panel no-shadow">
          <table className="data-table compact">
            <thead><tr><th>Crop</th><th>Records</th><th>Verified</th><th>Verified yield (kg)</th></tr></thead>
            <tbody>
              {yieldRows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No yield records yet.</td></tr>}
              {yieldRows.map((r) => (
                <tr key={r.crop}><td>{r.crop}</td><td>{r.records}</td><td>{r.verified}</td><td><b>{Math.round(r.kg).toLocaleString()}</b></td></tr>
              ))}
              {yieldRows.length > 0 && (
                <tr><td><b>All crops</b></td><td><b>{yieldRows.reduce((s, r) => s + r.records, 0)}</b></td><td><b>{yieldRows.reduce((s, r) => s + r.verified, 0)}</b></td><td><b>{Math.round(totalKg).toLocaleString()}</b></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
