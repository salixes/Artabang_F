import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import { runQualificationCheck, ASSISTANCE_SOURCES, ASSISTANCE_UNITS } from "../../lib/businessRules";

export default function AdminAssistance() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [directory, setDirectory] = useState({});
  const [contextByFarmer, setContextByFarmer] = useState({});
  const [filter, setFilter] = useState("Pending");
  const [reviewRow, setReviewRow] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

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

  function openReview(row) {
    setReviewRow(row);
    setForm({
      value_description: row.value_description || "", source: row.source || "MAO",
      quantity: row.quantity ?? "", unit: row.unit || ASSISTANCE_UNITS[0],
      expected_date: row.expected_date || "", distribution_date: row.distribution_date || "",
    });
  }

  async function resolve(status) {
    if (Number(form.quantity) < 0) return showToast("Quantity cannot be negative.", "fa-triangle-exclamation");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      status, value_description: form.value_description || null, source: form.source,
      quantity: form.quantity === "" ? null : Number(form.quantity), unit: form.quantity === "" ? null : form.unit,
      expected_date: form.expected_date || null,
      distribution_date: status === "Released" ? (form.distribution_date || new Date().toISOString().slice(0, 10)) : (form.distribution_date || null),
      resolved_by: user?.id, resolved_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("assistance_records").update(payload).eq("id", reviewRow.id);
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    await supabase.from("notifications").insert({
      recipient_id: reviewRow.farmer_id, icon: status === "Released" ? "fa-circle-check" : status === "Denied" ? "fa-circle-xmark" : "fa-hourglass-half",
      message: `Your <b>${reviewRow.assistance_type}</b> application was marked <b>${status}</b>${payload.quantity ? ` (${payload.quantity} ${payload.unit})` : ""}.`,
    });
    showToast(`Application ${status.toLowerCase()}.`, "fa-hand-holding-dollar");
    setReviewRow(null);
    load();
  }

  const qual = reviewRow && directory[reviewRow.farmer_id] ? runQualificationCheck(reviewRow.assistance_type, directory[reviewRow.farmer_id], contextByFarmer[reviewRow.farmer_id] || {}) : null;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-hand-holding-dollar"></i> Assistance Management</h2>
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>Pending</option><option>Under Review</option><option>Incoming</option><option>Released</option><option>Denied</option><option>All</option>
        </select>
      </div>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Type</th><th>Quantity</th><th>Source</th><th>Requested</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => openReview(r)}>
                <td>{directory[r.farmer_id]?.full_name || "—"}</td><td>{r.assistance_type}</td>
                <td>{r.quantity ? `${r.quantity} ${r.unit || ""}` : "—"}</td><td><SourceBadge source={r.source} /></td>
                <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td><td><StatusBadge status={r.status} /></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={(e) => { e.stopPropagation(); openReview(r); }}><i className="fa-solid fa-eye"></i> Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!reviewRow} onClose={() => setReviewRow(null)} title={`${reviewRow?.assistance_type || ""} — ${directory[reviewRow?.farmer_id]?.full_name || ""}`} icon="fa-hand-holding-dollar">
        {reviewRow && form && (
          <div className="modal-body">
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
            <label>Source <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{ASSISTANCE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>Quantity <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="e.g. 20" /></label>
              <label style={{ flex: 1 }}>Unit <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{ASSISTANCE_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
            </div>
            <label>Expected/Distribution Date <input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></label>
            <label>Notes <input value={form.value_description} onChange={(e) => setForm({ ...form, value_description: e.target.value })} placeholder="e.g. Certified hybrid seeds" /></label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => resolve("Under Review")} disabled={saving}>Under Review</button>
              <button className="btn-ghost" onClick={() => resolve("Incoming")} disabled={saving}>Mark Incoming</button>
              <button className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => resolve("Denied")} disabled={saving}>Deny</button>
              <button className="btn-primary" onClick={() => resolve("Released")} disabled={saving}><i className="fa-solid fa-check"></i> Release</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
