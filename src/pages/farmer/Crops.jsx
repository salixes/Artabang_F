import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { InsuredBadge, StatusBadge } from "../../components/Badges.jsx";
import Modal from "../../components/Modal.jsx";
import { CROP_LIST } from "../../lib/businessRules";
import PcicApplication, { PcicView } from "./PcicApplication.jsx";

const OTHER = "__other";
const REASONS = [
  "Wrong plant / crop",
  "Wrong area (hectares)",
  "Wrong planting date",
  "Wrong variety",
  "Wrong land category or tenurial status",
  "Typing mistake",
  "Other",
];
const LAND = ["Irrigated", "Non-Irrigated", "Rainfed", "Upland"];
const TENURE = ["Owner", "Lessee", "Tenant", "Others"];
const withCurrent = (list, v) => (v && !list.includes(v) ? [v, ...list] : list);
const titleCase = (t) => t.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function FarmerCrops() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [insuredCrops, setInsuredCrops] = useState(new Set());
  // null = list | "new" = PCIC application form | { saved } = view a saved application
  const [screen, setScreen] = useState(null);
  // crop being edited + the edit form
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!farmer?.id) return;
    const [{ data: crops }, { data: insurance }] = await Promise.all([
      supabase.from("crop_registrations").select("*").eq("farmer_id", farmer.id).order("registered_at", { ascending: false }),
      supabase.from("insurance_registrations").select("crop_name, status, coverage_end_date").eq("farmer_id", farmer.id),
    ]);
    setRows(crops || []);
    const activeNow = new Set(
      (insurance || [])
        .filter((i) => i.status === "Active" && (!i.coverage_end_date || new Date(i.coverage_end_date) >= new Date()))
        .map((i) => i.crop_name)
    );
    setInsuredCrops(activeNow);
  }
  useEffect(() => { load(); }, [farmer?.id]);

  function openEdit(r) {
    const known = CROP_LIST.includes(r.crop_name);
    setEditRow(r);
    setForm({
      crop: known ? r.crop_name : OTHER, crop_other: known ? "" : r.crop_name,
      area: String(r.area ?? ""), planting_date: r.planting_date || "", variety: r.variety || "",
      land_category: r.land_category || "", tenurial_status: r.tenurial_status || "",
      reason: "", details: "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    const cropName = form.crop === OTHER ? titleCase(form.crop_other) : form.crop;
    if (!cropName) return showToast("Please enter the crop / plant name.", "fa-triangle-exclamation");
    if (!(Number(form.area) > 0)) return showToast("Please enter a valid area in hectares.", "fa-triangle-exclamation");
    if (!form.reason) return showToast("Please choose the reason for this change.", "fa-triangle-exclamation");
    if (form.reason === "Other" && !form.details.trim()) return showToast("Please describe the reason.", "fa-triangle-exclamation");

    const next = {
      crop_name: cropName, area: Number(form.area), planting_date: form.planting_date,
      variety: form.variety.trim() || null, land_category: form.land_category || null, tenurial_status: form.tenurial_status || null,
    };
    const unchanged = next.crop_name === editRow.crop_name && next.area === Number(editRow.area) && next.planting_date === editRow.planting_date
      && (next.variety || null) === (editRow.variety || null) && (next.land_category || null) === (editRow.land_category || null)
      && (next.tenurial_status || null) === (editRow.tenurial_status || null);
    if (unchanged) return showToast("Nothing was changed.", "fa-circle-info");

    const reason = form.details.trim() ? (form.reason === "Other" ? form.details.trim() : `${form.reason}: ${form.details.trim()}`) : form.reason;
    setSaving(true);
    const { error } = await supabase.from("crop_registrations").update({ ...next, edit_reason: reason }).eq("id", editRow.id);
    setSaving(false);
    if (error) {
      const msg = /edit_reason|last_edit_reason/.test(error.message)
        ? `${error.message} — run supabase/migrations/crop_edit_reason.sql in the Supabase SQL editor first.` : error.message;
      return showToast(msg, "fa-triangle-exclamation");
    }
    logActivity(`Edited crop ${editRow.crop_name} — ${reason}`, "crop");
    showToast("Crop updated. The MAO will verify it again.", "fa-pen-to-square");
    setEditRow(null);
    load();
  }

  if (screen === "new") return <PcicApplication onCancel={() => setScreen(null)} onSaved={() => { setScreen(null); load(); }} />;
  if (screen?.saved) return <PcicView saved={screen.saved} onBack={() => setScreen(null)} />;

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-tractor"></i> Crop Registration</h2><button className="btn-primary" onClick={() => setScreen("new")}><i className="fa-solid fa-plus"></i> Register Crop</button></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> <span>Register Crop opens the PCIC Application for Crop Insurance (one long bond sheet). A newly registered crop is Pending until the MAO verifies it — only verified crops count toward assistance eligibility. Made a mistake (wrong plant, area, date…)? Use the <i className="fa-solid fa-pen-to-square"></i> edit button and give a reason; the crop goes back to Pending for re-verification. Registrations can't be deleted.</span></p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Crop / Plant Name</th><th>Area (ha)</th><th>Planting Date</th><th>Variety</th><th>Land Category</th><th>Tenurial Status</th><th>Verification</th><th>Insurance</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No crops registered yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.crop_name}</td><td>{r.area}</td><td>{r.planting_date}</td><td>{r.variety || "—"}</td><td>{r.land_category || "—"}</td><td>{r.tenurial_status || "—"}</td>
                <td>
                  <StatusBadge status={r.status || "Pending"} />
                  {r.status === "Rejected" && r.remarks && <div style={{ fontSize: ".68rem", color: "var(--ink-soft)", marginTop: 2 }}>MAO: {r.remarks}</div>}
                  {r.last_edit_reason && <div style={{ fontSize: ".68rem", color: "var(--ink-soft)", marginTop: 2 }}>Edited: {r.last_edit_reason}</div>}
                </td>
                <td><InsuredBadge insured={insuredCrops.has(r.crop_name)} /></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.pcic_application && <button className="btn-ghost" title="View / Print PCIC form" onClick={() => setScreen({ saved: r.pcic_application })}><i className="fa-solid fa-file-lines"></i></button>}{" "}
                  <button className="btn-ghost" title="Edit this crop (a reason is required)" aria-label="Edit crop" onClick={() => openEdit(r)}><i className="fa-solid fa-pen-to-square"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="Edit crop registration" icon="fa-pen-to-square">
        {editRow && form && (
          <form className="modal-body" onSubmit={saveEdit}>
            <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-circle-info"></i> <span>After saving, this crop goes back to <b>Pending</b> until the MAO verifies the corrected details.</span></p>
            <label>Crop / Plant Name
              <select value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })}>
                {CROP_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={OTHER}>Other (specify)</option>
              </select></label>
            {form.crop === OTHER && <label>What crop / plant is it? <input value={form.crop_other} onChange={(e) => setForm({ ...form, crop_other: e.target.value })} placeholder="e.g. Squash, Peanut, Taro" required /></label>}
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>Area (hectares) <input type="number" step="0.01" min="0.01" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></label>
              <label style={{ flex: 1 }}>Planting date <input type="date" value={form.planting_date} onChange={(e) => setForm({ ...form, planting_date: e.target.value })} required /></label>
            </div>
            <label>Variety <input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} /></label>
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>Land category
                <select value={form.land_category} onChange={(e) => setForm({ ...form, land_category: e.target.value })}>
                  <option value="">—</option>{withCurrent(LAND, editRow.land_category).map((o) => <option key={o}>{o}</option>)}
                </select></label>
              <label style={{ flex: 1 }}>Tenurial status
                <select value={form.tenurial_status} onChange={(e) => setForm({ ...form, tenurial_status: e.target.value })}>
                  <option value="">—</option>{withCurrent(TENURE, editRow.tenurial_status).map((o) => <option key={o}>{o}</option>)}
                </select></label>
            </div>
            <fieldset className="rsbsa-fieldset" style={{ marginTop: 6 }}>
              <legend>Reason for the change (required)</legend>
              <label>Why are you changing it?
                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required>
                  <option value="">Choose a reason…</option>{REASONS.map((o) => <option key={o}>{o}</option>)}
                </select></label>
              <label style={{ marginTop: 8 }}>{form.reason === "Other" ? "Describe the reason" : "More details (optional)"}
                <textarea rows={2} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="e.g. I planted Rice, not Corn" required={form.reason === "Other"} /></label>
            </fieldset>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditRow(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
