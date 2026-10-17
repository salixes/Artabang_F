import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { StatusBadge } from "./Badges.jsx";
import { yieldUnitText } from "../lib/businessRules";

// The Yield Report that sits inside the Assistance Report (shares its farmer / date filters).
export default function YieldReportSection({ farmer = "All", dateFrom = "", dateTo = "" }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    supabase.from("yield_report").select("*").order("harvest_date", { ascending: false }).then(({ data }) => setRows(data || []));
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (farmer !== "All" && r.farmer_name !== farmer) return false;
    if (dateFrom && new Date(r.harvest_date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(r.harvest_date) > new Date(dateTo)) return false;
    return true;
  }), [rows, farmer, dateFrom, dateTo]);

  const verifiedKg = filtered.filter((r) => r.status === "Verified").reduce((s, r) => s + (Number(r.quantity_kg) || 0), 0);
  const byCrop = useMemo(() => {
    const m = {};
    filtered.filter((r) => r.status === "Verified").forEach((r) => { m[r.crop_name] = (m[r.crop_name] || 0) + (Number(r.quantity_kg) || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <div className="yield-report-section" style={{ marginTop: 26 }}>
      <div className="view-head" style={{ marginBottom: 8 }}><h2 style={{ fontSize: "1.1rem" }}><i className="fa-solid fa-wheat-awn"></i> Yield Report</h2></div>
      <div className="table-panel">
        <table className="data-table print-table">
          <thead><tr><th>Farmer</th><th>Crop</th><th>Season</th><th>Yield</th><th>kg-equivalent</th><th>Harvest Date</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No yield records match.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.farmer_name}</td><td>{r.crop_name}</td><td>{r.season}</td>
                <td>{Number(r.quantity).toLocaleString()} {yieldUnitText(r)}</td>
                <td>{Number(r.quantity_kg).toLocaleString()} kg</td><td>{r.harvest_date}</td><td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint-text" style={{ marginTop: 8 }}>
        {filtered.length} yield record{filtered.length === 1 ? "" : "s"} · <b>{Math.round(verifiedKg).toLocaleString()} kg</b> verified
        {byCrop.length > 0 && <> ({byCrop.map(([c, kg]) => `${c} ${Math.round(kg).toLocaleString()} kg`).join(" · ")})</>}
      </p>
    </div>
  );
}
