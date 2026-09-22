import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import { runQualificationCheck, ASSISTANCE_UNITS } from "../../lib/businessRules";

export default function AssistanceDistribution() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [directory, setDirectory] = useState({});
  const [contextByFarmer, setContextByFarmer] = useState({});
  const [filter, setFilter] = useState("Pending");
  const [reviewRow, setReviewRow] = useState(null);
  const [form, setForm] = useState({ note: "", quantity: "", unit: ASSISTANCE_UNITS[0] });

  async function load() {
    const [{ data }, { data: dir }, { data: crops }, { data: yields }, { data: insurance }] = await Promise.all([
      supabase.from("assistance_records").select("*").order("requested_at", { ascending: false }),
      supabase.from("farmer_directory").select("*"),
      supabase.from("crop_registrations").select("farmer_id"),
      supabase.from("yield_records").select("farmer_id").eq("status", "Verified"),
      supabase.from("insurance_registrations").select("farmer_id"),
    ]);
    setRows(data || []);
    setDirectory(Object.fromEntries((dir || []).map((d) => [d.id, d])));
    const cropSet = new Set((crops || []).map((c) => c.farmer_id));
    const yieldSet = new Set((yields || []).map((y) => y.farmer_id));
    const insSet = new Set((insurance || []).map((i) => i.farmer_id));
    const equipReleased = new Set((data || []).filter((a) => a.assistance_type === "Farming Equipment" && a.status === "Released").map((a) => a.farmer_id));
    const ctx = {};
    (dir || []).forEach((d) => { ctx[d.id] = { hasCropRegistered: cropSet.has(d.id), hasVerifiedYield: yieldSet.has(d.id), hasInsuranceRegistered: insSet.has(d.id), hasEquipmentAlready: equipReleased.has(d.id) }; });
    setContextByFarmer(ctx);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (filter === "All" ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);
  const qual = reviewRow && directory[reviewRow.farmer_id] ? runQualificationCheck(reviewRow.assistance_type, directory[reviewRow.farmer_id], contextByFarmer[reviewRow.farmer_id] || {}) : null;

  function openReview(row) {
    setReviewRow(row);
    setForm({ note: row.value_description || "", quantity: row.quantity ?? "", unit: row.unit || ASSISTANCE_UNITS[0] });
  }

  async function recommend() {
    if (Number(form.quantity) < 0) return showToast("Quantity cannot be negative.", "fa-triangle-exclamation");
    const { error } = await supabase.from("assistance_records").update({
      status: "Under Review", value_description: form.note || reviewRow.value_description,
      quantity: form.quantity === "" ? null : Number(form.quantity), unit: form.quantity === "" ? null : form.unit,
    }).eq("id", reviewRow.id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Recommended to ADMIN for final release.", "fa-thumbs-up");
    setReviewRow(null);
    load();
  }

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-hand-holding-dollar"></i> Assistance Distribution</h2>
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>Pending</option><option>Under Review</option><option>Incoming</option><option>Released</option><option>Denied</option><option>All</option>
        </select>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Review pending applications and recommend them to the ADMIN for final release. Final approval remains with the Municipal Agriculture Office.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Type</th><th>Quantity</th><th>Source</th><th>Requested</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} style={{ cursor: r.status === "Pending" ? "pointer" : "default" }} onClick={() => r.status === "Pending" && openReview(r)}>
                <td>{directory[r.farmer_id]?.full_name || "—"}</td><td>{r.assistance_type}</td>
                <td>{r.quantity ? `${r.quantity} ${r.unit || ""}` : "—"}</td><td><SourceBadge source={r.source} /></td>
                <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td><td><StatusBadge status={r.status} /></td>
                <td>{r.status === "Pending" && <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={(e) => { e.stopPropagation(); openReview(r); }}><i className="fa-solid fa-eye"></i> Review</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!reviewRow} onClose={() => setReviewRow(null)} title={`Review — ${reviewRow?.assistance_type || ""}`} icon="fa-hand-holding-dollar">
        {reviewRow && (
          <div className="modal-body">
            <p><b>Farmer:</b> {directory[reviewRow.farmer_id]?.full_name}</p>
            {qual && (
              <div className="qual-box">
                <b>{qual.qualified ? "Meets automatic qualification criteria" : "Does not fully meet qualification criteria"}</b>
                <ul className="detail-list">
                  {qual.checks.map((c, i) => (
                    <li key={i}><span><i className={`fa-solid ${c.pass ? "fa-circle-check" : "fa-circle-xmark"}`} style={{ color: c.pass ? "var(--resolved)" : "var(--danger)", marginRight: 6 }}></i>{c.label}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>Recommended Quantity <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
              <label style={{ flex: 1 }}>Unit <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{ASSISTANCE_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
            </div>
            <label>Recommendation Notes <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Recommend ₱5,000 cash aid" /></label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setReviewRow(null)}>Cancel</button>
              <button className="btn-primary" onClick={recommend}><i className="fa-solid fa-thumbs-up"></i> Recommend to ADMIN</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
