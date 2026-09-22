import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function CropsRegistered() {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [cropFilter, setCropFilter] = useState("All");

  useEffect(() => {
    (async () => {
      const [{ data }, { data: dir }] = await Promise.all([
        supabase.from("crop_registrations").select("*").order("registered_at", { ascending: false }),
        supabase.from("farmer_directory").select("id, full_name"),
      ]);
      setRows(data || []);
      setNames(Object.fromEntries((dir || []).map((d) => [d.id, d.full_name])));
    })();
  }, []);

  const crops = useMemo(() => ["All", ...new Set(rows.map((r) => r.crop_name))], [rows]);
  const filtered = cropFilter === "All" ? rows : rows.filter((r) => r.crop_name === cropFilter);

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-tractor"></i> Crop Registered Farmers</h2>
        <select className="filter-select" value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
          {crops.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Crop / Plant Name</th><th>Area</th><th>Planting Date</th><th>Land Category</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}><td>{names[r.farmer_id] || "—"}</td><td>{r.crop_name}</td><td>{r.area} ha</td><td>{r.planting_date}</td><td>{r.land_category || "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
