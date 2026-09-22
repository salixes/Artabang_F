import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { InsuredBadge } from "../../components/Badges.jsx";
import { CROP_LIST, INSURANCE_SOURCES } from "../../lib/businessRules";

const empty = {
  crop_name: CROP_LIST[0], area: "", planting_date: "", variety: "", land_category: "Irrigated", tenurial_status: "Owner",
  register_insurance: false, coverage_start_date: "", coverage_end_date: "", insurance_source: INSURANCE_SOURCES[0],
};

export default function FarmerCrops() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [insuredCrops, setInsuredCrops] = useState(new Set());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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

  function openNew() {
    setForm(empty);
    setFormError("");
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (form.register_insurance && form.coverage_end_date && form.coverage_start_date && form.coverage_end_date < form.coverage_start_date) {
      setFormError("Insurance coverage end date cannot be before the start date.");
      return;
    }
    setSaving(true);
    setFormError("");
    const { register_insurance, coverage_start_date, coverage_end_date, insurance_source, ...cropFields } = form;

    const { error: cropErr } = await supabase.from("crop_registrations").insert({ ...cropFields, farmer_id: farmer.id });
    if (cropErr) {
      setSaving(false);
      setFormError(cropErr.message);
      return;
    }

    if (register_insurance) {
      const { error: insErr } = await supabase.from("insurance_registrations").insert({
        farmer_id: farmer.id, crop_name: form.crop_name, area: form.area, planting_date: form.planting_date,
        coverage_start_date: coverage_start_date || form.planting_date, coverage_end_date: coverage_end_date || null,
        insurance_source, status: "Active",
      });
      setSaving(false);
      if (insErr) {
        showToast("Crop registered, but insurance registration failed: " + insErr.message.replace(/^.*insurance_registrations: /, ""), "fa-triangle-exclamation");
        setOpen(false);
        load();
        return;
      }
      showToast("Crop registered and insured.", "fa-shield-heart");
    } else {
      setSaving(false);
      showToast("Crop registered.", "fa-tractor");
    }
    setOpen(false);
    load();
  }

  async function remove(id) {
    if (!confirm("Remove this crop registration?")) return;
    const { error } = await supabase.from("crop_registrations").delete().eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Registration removed.", "fa-trash");
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-tractor"></i> Crop Registration</h2><button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> Register Crop</button></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Register a crop and, in the same step, sign it up for Crop Insurance — no need to fill out a separate form.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Crop / Plant Name</th><th>Area (ha)</th><th>Planting Date</th><th>Variety</th><th>Land Category</th><th>Tenurial Status</th><th>Insurance</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No crops registered yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.crop_name}</td><td>{r.area}</td><td>{r.planting_date}</td><td>{r.variety || "—"}</td><td>{r.land_category || "—"}</td><td>{r.tenurial_status || "—"}</td>
                <td><InsuredBadge insured={insuredCrops.has(r.crop_name)} /></td>
                <td><button className="btn-ghost" onClick={() => remove(r.id)}><i className="fa-solid fa-trash"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Register Crop" icon="fa-tractor">
        <form className="modal-body" onSubmit={submit}>
          {formError && <div className="hint-text" style={{ color: "var(--danger)", background: "var(--cream)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px" }}><i className="fa-solid fa-triangle-exclamation"></i> {formError}</div>}
          <label>Crop / Plant Name <select value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })}>{CROP_LIST.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Area (hectares) <input type="number" step="0.1" min="0.1" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></label>
          <label>Planting Date <input type="date" value={form.planting_date} onChange={(e) => setForm({ ...form, planting_date: e.target.value })} required /></label>
          <label>Variety <input type="text" value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} placeholder="e.g. NK6 Hybrid" /></label>
          <label>Land Category <select value={form.land_category} onChange={(e) => setForm({ ...form, land_category: e.target.value })}><option>Irrigated</option><option>Rainfed</option><option>Upland</option></select></label>
          <label>Tenurial Status <select value={form.tenurial_status} onChange={(e) => setForm({ ...form, tenurial_status: e.target.value })}><option>Owner</option><option>Tenant</option><option>Lessee</option></select></label>

          <div className="rsbsa-checks">
            <label className="rsbsa-check"><input type="checkbox" checked={form.register_insurance} onChange={(e) => setForm({ ...form, register_insurance: e.target.checked })} /> Also register this crop for Crop Insurance</label>
          </div>

          {form.register_insurance && (
            <fieldset className="rsbsa-fieldset">
              <legend>Crop Insurance Details</legend>
              <div className="rsbsa-grid">
                <label>Coverage Start Date <input type="date" value={form.coverage_start_date} onChange={(e) => setForm({ ...form, coverage_start_date: e.target.value })} /></label>
                <label>Coverage End Date <input type="date" value={form.coverage_end_date} onChange={(e) => setForm({ ...form, coverage_end_date: e.target.value })} /></label>
                <label>Insurance Source <select value={form.insurance_source} onChange={(e) => setForm({ ...form, insurance_source: e.target.value })}>{INSURANCE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
              </div>
            </fieldset>
          )}

          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : "Save"}</button></div>
        </form>
      </Modal>
    </section>
  );
}
