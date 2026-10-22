import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { tr } from "../lib/i18n";
import { useMemberScope, inScope } from "../lib/memberScope";

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
  const scope = useMemberScope(); // president: association members only
  const assistS = useMemo(() => (assist ? assist.filter((r) => inScope(scope, r.farmer_id)) : null), [assist, scope]);
  const yieldsS = useMemo(() => (yields ? yields.filter((r) => inScope(scope, r.farmer_id)) : null), [yields, scope]);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: y }] = await Promise.all([
        supabase.from("assistance_records").select("farmer_id, assistance_type, status"),
        supabase.from("yield_records").select("farmer_id, crop_name, status, quantity_kg"),
      ]);
      setAssist(a || []);
      setYields(y || []);
    })();
  }, []);

  const assistRows = useMemo(() => {
    const by = {};
    (assistS || []).forEach((r) => {
      const t = (by[r.assistance_type] ||= { type: r.assistance_type, total: 0 });
      t.total += 1;
      const col = STATUS_COLS.find((c) => c.key === r.status || (c.also || []).includes(r.status));
      if (col) t[col.key] = (t[col.key] || 0) + 1;
    });
    return Object.values(by).sort((a, b) => b.total - a.total);
  }, [assistS]);

  const yieldRows = useMemo(() => {
    const by = {};
    (yieldsS || []).forEach((r) => {
      const c = (by[r.crop_name] ||= { crop: r.crop_name, records: 0, verified: 0, kg: 0 });
      c.records += 1;
      if (r.status === "Verified") { c.verified += 1; c.kg += Number(r.quantity_kg) || 0; }
    });
    return Object.values(by).sort((a, b) => b.kg - a.kg);
  }, [yieldsS]);

  if (!assist || !yields || scope === undefined) return null;
  const sum = (k) => assistRows.reduce((s, r) => s + (r[k] || 0), 0);
  const totalKg = yieldRows.reduce((s, r) => s + r.kg, 0);
  const link = (to) => (e) => { e.preventDefault(); navigate(to); };

  return (
    <div className="dash-grid report-summary" style={{ marginTop: 18 }}>
      <div className="panel">
        <div className="panel-head"><h3><i className="fa-solid fa-file-invoice"></i> {tr("Assistance Report")}</h3>
          <a href="#" className="link-more" onClick={link(`${basePath}/reports`)}>{tr("Full report")}</a></div>
        <div className="table-panel no-shadow">
          <table className="data-table compact">
            <thead><tr><th>{tr("Type")}</th>{STATUS_COLS.map((c) => <th key={c.key}>{c.label}</th>)}<th>{tr("Total")}</th></tr></thead>
            <tbody>
              {assistRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>{tr("No assistance records yet.")}</td></tr>}
              {assistRows.map((r) => (
                <tr key={r.type}><td>{tr(r.type)}</td>{STATUS_COLS.map((c) => <td key={c.key}>{r[c.key] || 0}</td>)}<td><b>{r.total}</b></td></tr>
              ))}
              {assistRows.length > 0 && (
                <tr><td><b>{tr("All types")}</b></td>{STATUS_COLS.map((c) => <td key={c.key}><b>{sum(c.key)}</b></td>)}<td><b>{sum("total")}</b></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3><i className="fa-solid fa-wheat-awn"></i> {tr("Yield Report")}</h3>
          <a href="#" className="link-more" onClick={link(basePath === "/admin" ? "/admin/yield" : `${basePath}/reports`)}>{tr("Full report")}</a></div>
        <div className="table-panel no-shadow">
          <table className="data-table compact">
            <thead><tr><th>{tr("Crop")}</th><th>{tr("Records")}</th><th>{tr("Verified")}</th><th>{tr("Verified yield (kg)")}</th></tr></thead>
            <tbody>
              {yieldRows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--ink-soft)" }}>{tr("No yield records yet.")}</td></tr>}
              {yieldRows.map((r) => (
                <tr key={r.crop}><td>{r.crop}</td><td>{r.records}</td><td>{r.verified}</td><td><b>{Math.round(r.kg).toLocaleString()}</b></td></tr>
              ))}
              {yieldRows.length > 0 && (
                <tr><td><b>{tr("All crops")}</b></td><td><b>{yieldRows.reduce((s, r) => s + r.records, 0)}</b></td><td><b>{yieldRows.reduce((s, r) => s + r.verified, 0)}</b></td><td><b>{Math.round(totalKg).toLocaleString()}</b></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
