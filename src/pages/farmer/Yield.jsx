import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { CROP_LIST, YIELD_UNITS, YIELD_UNIT_LABELS, yieldUnitText } from "../../lib/businessRules";

const OTHER = "Other";
const titleCase = (t) => t.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const empty = { crop_name: CROP_LIST[0], crop_other: "", season: "", quantity: "", unit: "kg", unit_other: "", kg_per_unit: "", harvest_date: "" };

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
    if (form.crop_name === OTHER && !form.crop_other.trim()) return showToast("Please specify which crop / plant it is.", "fa-triangle-exclamation");
    if (form.unit === OTHER && !form.unit_other.trim()) return showToast("Please specify exactly what unit you used.", "fa-triangle-exclamation");
    setSaving(true);
    const payload = {
      farmer_id: farmer.id,
      crop_name: form.crop_name === OTHER ? titleCase(form.crop_other) : form.crop_name,
      season: form.season, quantity: form.quantity, unit: form.unit, harvest_date: form.harvest_date,
      unit_other: form.unit === OTHER ? form.unit_other.trim() : null,
      kg_per_unit: form.unit === OTHER && form.kg_per_unit ? Number(form.kg_per_unit) : null,
    };
    const { error } = await supabase.from("yield_records").insert(payload);
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    logActivity(`Reported yield: ${payload.crop_name} — ${form.quantity} ${form.unit === "Other" ? form.unit_other.trim() : form.unit}`, "yield");
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
                <td>{r.crop_name}</td><td>{r.season}</td><td>{Number(r.quantity).toLocaleString()}</td><td>{yieldUnitText(r)}</td><td>{r.harvest_date}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.status === "Pending" && <button className="btn-ghost" onClick={() => remove(r.id)}><i className="fa-solid fa-trash"></i></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Report Yield" icon="fa-wheat-awn">
        <form className="modal-body" onSubmit={submit}>
          <label>Crop / Plant Name <select value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })}>{CROP_LIST.map((c) => <option key={c}>{c}</option>)}<option value={OTHER}>Other (specify)</option></select></label>
          {form.crop_name === OTHER && <label>What crop / plant is it? <input type="text" value={form.crop_other} onChange={(e) => setForm({ ...form, crop_other: e.target.value })} placeholder="e.g. Squash, Peanut, Taro" required /></label>}
          <label>Season <input type="text" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="e.g. Wet Season 2026" required /></label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1 }}>Yield Quantity <input type="number" step="0.1" min="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
            <label style={{ flex: 1 }}>Unit <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{YIELD_UNITS.map((u) => <option key={u} value={u}>{u === OTHER ? "Other (specify)" : YIELD_UNIT_LABELS[u]}</option>)}</select></label>
          </div>
          {form.unit === OTHER && (
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>What unit is it exactly? <input type="text" value={form.unit_other} onChange={(e) => setForm({ ...form, unit_other: e.target.value })} placeholder="e.g. Bundles, Crates, Tons, Pieces" required /></label>
              <label style={{ flex: 1 }}>About how many kg is 1 {form.unit_other.trim() || "unit"}? (optional) <input type="number" step="0.1" min="0.1" value={form.kg_per_unit} onChange={(e) => setForm({ ...form, kg_per_unit: e.target.value })} placeholder="e.g. 25" /></label>
            </div>
          )}
          {form.unit !== "kg" && <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-circle-info"></i> For reports and insurance estimates this is converted to a kg-equivalent ({form.unit === OTHER ? (form.kg_per_unit ? `${form.kg_per_unit} kg per ${form.unit_other.trim() || "unit"}` : "assumed 1:1 — add the kg per unit above for a more accurate figure") : "50 kg each"}).</p>}
          <label>Harvest Date <input type="date" value={form.harvest_date} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : "Save"}</button></div>
        </form>
      </Modal>
    </section>
  );
}
