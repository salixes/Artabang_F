import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { YIELD_UNITS, YIELD_UNIT_LABELS, yieldUnitText } from "../../lib/businessRules";
import { tr } from "../../lib/i18n";

const OTHER = "Other";
const blank = { crop_name: "", season: "", quantity: "", unit: "kg", unit_other: "", kg_per_unit: "", harvest_date: "" };
const friendly = (msg) => (/unit_other|kg_per_unit/.test(msg) && /column|schema cache/.test(msg)
  ? `${msg} — run supabase/migrations/crop_verification_qualified_notify_yield_other.sql in the Supabase SQL editor first.`
  : msg);

// A farmer reports yield only for a crop he/she has registered (Crop Registration), and can
// edit a report if something was typed wrong (an edited report goes back to Pending).
export default function FarmerYield() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [crops, setCrops] = useState(null);          // names of registered crops (null = loading)
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(false);
  const [needCrop, setNeedCrop] = useState(false);
  const [editing, setEditing] = useState(null);       // the record being edited, or null for a new report
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!farmer?.id) return;
    const [{ data }, { data: regs }] = await Promise.all([
      supabase.from("yield_records").select("*").eq("farmer_id", farmer.id).order("harvest_date", { ascending: false }),
      supabase.from("crop_registrations").select("crop_name, status").eq("farmer_id", farmer.id),
    ]);
    setRows(data || []);
    const seen = new Set(); const names = [];
    (regs || []).filter((r) => (r.status || "Pending") !== "Rejected").forEach((r) => {
      const k = (r.crop_name || "").trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); names.push(r.crop_name); }
    });
    setCrops(names);
  }
  useEffect(() => { load(); }, [farmer?.id]);

  // crops to choose from: the registered ones (plus the record's own crop while editing)
  const options = useMemo(() => {
    const list = [...(crops || [])];
    if (editing && !list.some((c) => c.toLowerCase() === editing.crop_name.toLowerCase())) list.unshift(editing.crop_name);
    return list;
  }, [crops, editing]);

  function openNew() {
    if (!crops || crops.length === 0) return setNeedCrop(true);
    setEditing(null);
    setForm({ ...blank, crop_name: crops[0] });
    setOpen(true);
  }
  function openEdit(r) {
    setEditing(r);
    setForm({
      crop_name: r.crop_name, season: r.season || "", quantity: r.quantity ?? "", unit: r.unit || "kg",
      unit_other: r.unit_other || "", kg_per_unit: r.kg_per_unit ?? "", harvest_date: r.harvest_date || "",
    });
    setOpen(true);
  }
  const close = () => { if (!saving) { setOpen(false); setEditing(null); } };

  async function submit(e) {
    e.preventDefault();
    if (!farmer?.id) return showToast("Your farmer profile could not be loaded. Please sign in again.", "fa-triangle-exclamation");
    if (!form.crop_name) return showToast("Please choose the crop.", "fa-triangle-exclamation");
    if (Number(form.quantity) <= 0) return showToast(tr("Yield quantity must be greater than zero."), "fa-triangle-exclamation");
    if (form.unit === OTHER && !form.unit_other.trim()) return showToast(tr("Please specify exactly what unit you used."), "fa-triangle-exclamation");

    // only send the "other unit" columns when they are needed, so a normal report never depends on them
    const body = { crop_name: form.crop_name, season: form.season.trim(), quantity: Number(form.quantity), unit: form.unit, harvest_date: form.harvest_date };
    if (form.unit === OTHER) { body.unit_other = form.unit_other.trim(); body.kg_per_unit = form.kg_per_unit ? Number(form.kg_per_unit) : null; }
    else if (editing?.unit === OTHER) { body.unit_other = null; body.kg_per_unit = null; }

    setSaving(true);
    let error;
    if (editing) {
      const res = await supabase.from("yield_records").update({ ...body, status: "Pending" }).eq("id", editing.id).select("id");
      error = res.error;
      if (!error && (!res.data || res.data.length === 0)) {
        setSaving(false);
        return showToast("The change could not be saved — run supabase/migrations/yield_rules.sql in the Supabase SQL editor first.", "fa-triangle-exclamation");
      }
    } else {
      ({ error } = await supabase.from("yield_records").insert({ farmer_id: farmer.id, ...body }));
    }
    setSaving(false);
    if (error) return showToast(friendly(error.message), "fa-triangle-exclamation");

    const unitText = form.unit === OTHER ? form.unit_other.trim() : form.unit;
    logActivity(`${editing ? "Edited yield report" : "Reported yield"}: ${body.crop_name} — ${form.quantity} ${unitText}`, "yield");
    showToast(editing ? "Yield report updated — it goes back to the admin for verification." : tr("Yield reported — pending verification."), "fa-wheat-awn");
    setOpen(false); setEditing(null);
    load();
  }

  const filteredRows = filter === "All" ? rows : rows.filter((r) => r.status === filter);
  const noCrops = crops !== null && crops.length === 0;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-wheat-awn"></i> {tr("My Yield Records")}</h2>
        <div className="head-actions">
          <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>{tr("All")}</option><option>{tr("Pending")}</option><option>{tr("Verified")}</option><option>{tr("Rejected")}</option>
          </select>
          <button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> {tr("Report Yield")}</button>
        </div>
      </div>
      {noCrops && (
        <p className="hint-text" style={{ border: "1px solid var(--gold-light)", background: "rgba(232,184,75,.12)", borderRadius: 10, padding: "10px 12px" }}>
          <i className="fa-solid fa-triangle-exclamation"></i> You need to register a crop first before you can report a yield.{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/farmer/crops"); }}>Go to Crop Registration</a>
        </p>
      )}
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> {tr("Track your progress:")} <b>{tr("Pending")}</b> {tr("means submitted and awaiting ADMIN review,")} <b>{tr("Verified")}</b> {tr("means confirmed,")} <b>{tr("Rejected")}</b> {tr("means it needs correction.")} Typed something wrong? Use Edit — the corrected report goes back to the admin for verification.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>{tr("Crop / Plant Name")}</th><th>{tr("Season")}</th><th>{tr("Quantity")}</th><th>{tr("Unit")}</th><th>{tr("Harvest Date")}</th><th>{tr("Status")}</th><th></th></tr></thead>
          <tbody>
            {filteredRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>{tr("No yield reports yet.")}</td></tr>}
            {filteredRows.map((r) => (
              <tr key={r.id}>
                <td>{r.crop_name}</td><td>{r.season}</td><td>{Number(r.quantity).toLocaleString()}</td><td>{tr(yieldUnitText(r))}</td><td>{r.harvest_date}</td>
                <td><StatusBadge status={r.status} /></td>
                <td><button className="btn-ghost" title="Edit this report" aria-label="Edit this report" onClick={() => openEdit(r)}><i className="fa-solid fa-pen-to-square"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* no registered crop yet */}
      <Modal open={needCrop} onClose={() => setNeedCrop(false)} title="Register a crop first" icon="fa-triangle-exclamation">
        <div className="modal-body">
          <p style={{ margin: 0 }}>You need to register a crop first. A yield can only be reported for a crop that is in your <b>Crop Registration</b>.</p>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setNeedCrop(false)}>Close</button>
            <button type="button" className="btn-primary" onClick={() => { setNeedCrop(false); navigate("/farmer/crops"); }}><i className="fa-solid fa-tractor"></i> Go to Crop Registration</button>
          </div>
        </div>
      </Modal>

      {/* report / edit */}
      <Modal open={open} onClose={close} title={editing ? "Edit Yield Report" : tr("Report Yield")} icon="fa-wheat-awn">
        <form className="modal-body" onSubmit={submit}>
          {editing && editing.status !== "Pending" && (
            <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-circle-info"></i> This report is <b>{editing.status}</b>. After you save, it goes back to <b>Pending</b> so the admin can verify the corrected numbers.</p>
          )}
          <label>{tr("Crop / Plant Name")} <select value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })} required>{options.map((c) => <option key={c}>{c}</option>)}</select></label>
          <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-circle-info"></i> Only crops you registered in Crop Registration are listed.</p>
          <label>{tr("Season")} <input type="text" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder={tr("e.g. Wet Season 2026")} required /></label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1 }}>{tr("Yield Quantity")} <input type="number" step="0.1" min="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
            <label style={{ flex: 1 }}>{tr("Unit")} <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{YIELD_UNITS.map((u) => <option key={u} value={u}>{u === OTHER ? tr("Other (specify)") : tr(YIELD_UNIT_LABELS[u])}</option>)}</select></label>
          </div>
          {form.unit === OTHER && (
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>{tr("What unit is it exactly?")} <input type="text" value={form.unit_other} onChange={(e) => setForm({ ...form, unit_other: e.target.value })} placeholder={tr("e.g. Bundles, Crates, Tons, Pieces")} required /></label>
              <label style={{ flex: 1 }}>{tr("About how many kg is 1")} {form.unit_other.trim() || "unit"}{tr("? (optional)")} <input type="number" step="0.1" min="0.1" value={form.kg_per_unit} onChange={(e) => setForm({ ...form, kg_per_unit: e.target.value })} placeholder="e.g. 25" /></label>
            </div>
          )}
          {form.unit !== "kg" && <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-circle-info"></i> {tr("For reports and insurance estimates this is converted to a kg-equivalent (")}{form.unit === OTHER ? (form.kg_per_unit ? `${form.kg_per_unit} kg per ${form.unit_other.trim() || "unit"}` : "assumed 1:1 — add the kg per unit above for a more accurate figure") : "50 kg each"}).</p>}
          <label>{tr("Harvest Date")} <input type="date" value={form.harvest_date} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={close}>{tr("Cancel")}</button><button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : editing ? "Save changes" : "Save"}</button></div>
        </form>
      </Modal>
    </section>
  );
}
