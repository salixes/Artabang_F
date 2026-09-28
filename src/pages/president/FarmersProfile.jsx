import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { StatusBadge } from "../../components/Badges.jsx";

export default function FarmersProfile() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [detailRow, setDetailRow] = useState(null);

  useEffect(() => {
    supabase.from("farmer_directory").select("*").order("full_name").then(({ data }) => setRows(data || []));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.full_name.toLowerCase().includes(q) || (r.barangay || r.location || "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-users"></i> Farmers Profile</h2>
        <div className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search farmer name or location…" /></div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-shield-halved"></i> Shown here is only what's needed for association coordination — personal details like birthdate, civil status, ID numbers, and full address are kept private in line with the Data Privacy Act.</p>

      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Barangay</th><th>Crops Grown</th><th>Association</th><th>Validation</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No farmers found.</td></tr>}
            {filtered.map((f) => (
              <tr key={f.id}>
                <td>{f.full_name}</td>
                <td>{f.barangay || f.location || "—"}</td>
                <td>{(f.crops || []).join(", ") || "—"}</td>
                <td>{f.association_name || "Not a member"}</td>
                <td><StatusBadge status={f.validated ? "Verified" : "Pending"} /></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setDetailRow(f)}><i className="fa-solid fa-eye"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailRow && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailRow(null); }}>
          <div className="modal">
            <div className="modal-head"><h3><i className="fa-solid fa-id-card"></i> {detailRow.full_name}</h3><button className="modal-close" onClick={() => setDetailRow(null)}>&times;</button></div>
            <div className="modal-body">
              <ul className="detail-list">
                <li><span>Barangay</span><b>{detailRow.barangay || detailRow.location || "—"}</b></li>
                <li><span>Farm Size</span><b>{detailRow.farm_size ? `${detailRow.farm_size} ha` : "—"}</b></li>
                <li><span>Crops Grown</span><b>{(detailRow.crops || []).join(", ") || "—"}</b></li>
                <li><span>Association</span><b>{detailRow.association_name || "Not a member"}</b></li>
                <li><span>Total Verified Yield</span><b>{Number(detailRow.total_verified_yield).toLocaleString()} kg</b></li>
                <li><span>Validation Status</span><b>{detailRow.validated ? "Validated" : "Pending"}</b></li>
              </ul>
              <div className="modal-actions"><button className="btn-primary" onClick={() => setDetailRow(null)}>Close</button></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
