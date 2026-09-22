import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { CROP_LIST, YIELD_UNITS, YIELD_UNIT_LABELS } from "../../lib/businessRules";

const empty = { crop_name: CROP_LIST[0], season: "", quantity: "", unit: "kg", harvest_date: "" };

export default function FarmerYield() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!farmer?.id) return;
    const { data } = await supabase.from("yield_records").select("*").eq("farmer_id", farmer.id).order("harvest_date", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, [farmer?.id]);

  async function submit(e) {
    e.preventDefault();
    if (Number(form.quantity) <= 0) {
      showToast("Yield quantity must be greater than zero.", "fa-triangle-exclamation");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("yield_records").insert({ ...form, farmer_id: farmer.id });
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Yield reported — pending verification.", "fa-wheat-awn");
    setOpen(false);
    setForm(empty);
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this record? Only pending records can be removed.")) return;
    const { error } = await supabase.from("yield_records").delete().eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    load();
  }

  const filteredRows = filter === "All" ? rows : rows.filter((r) => r.status === filter);

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-wheat-awn"></i> My Yield Records</h2>
        <div className="head-actions">
          <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All</option><option>Pending</option><option>Verified</option><option>Rejected</option>
          </select>
          <button className="btn-primary" onClick={() => setOpen(true)}><i className="fa-solid fa-plus"></i> Report Yield</button>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Track your progress: <b>Pending</b> means submitted and awaiting ADMIN review, <b>Verified</b> means confirmed, <b>Rejected</b> means it needs correction.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Crop / Plant Name</th><th>Season</th><th>Quantity</th><th>Unit</th><th>Harvest Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filteredRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No yield reports yet.</td></tr>}
            {filteredRows.map((r) => (
              <tr key={r.id}>
                <td>{r.crop_name}</td><td>{r.season}</td><td>{Number(r.quantity).toLocaleString()}</td><td>{YIELD_UNIT_LABELS[r.unit] || r.unit}</td><td>{r.harvest_date}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.status === "Pending" && <button className="btn-ghost" onClick={() => remove(r.id)}><i className="fa-solid fa-trash"></i></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Report Yield" icon="fa-wheat-awn">
        <form className="modal-body" onSubmit={submit}>
          <label>Crop / Plant Name <select value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })}>{CROP_LIST.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Season <input type="text" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="e.g. Wet Season 2026" required /></label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1 }}>Yield Quantity <input type="number" step="0.1" min="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
            <label style={{ flex: 1 }}>Unit <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{YIELD_UNITS.map((u) => <option key={u} value={u}>{YIELD_UNIT_LABELS[u]}</option>)}</select></label>
          </div>
          {form.unit !== "kg" && <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-circle-info"></i> For reports and insurance estimates, {YIELD_UNIT_LABELS[form.unit]} are converted to a standard kg-equivalent ({form.unit === "Other" ? "assumed 1:1" : "50 kg each"}).</p>}
          <label>Harvest Date <input type="date" value={form.harvest_date} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : "Save"}</button></div>
        </form>
      </Modal>
    </section>
  );
}
