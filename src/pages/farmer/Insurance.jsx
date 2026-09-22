import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { CROP_LIST, INSURANCE_SOURCES, computeInsuranceStatus, computeInsuranceBasis, formatPeso } from "../../lib/businessRules";

const empty = { crop_name: CROP_LIST[0], area: "", planting_date: "", coverage_start_date: "", coverage_end_date: "", insurance_source: INSURANCE_SOURCES[0] };

export default function FarmerInsurance() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [verifiedYields, setVerifiedYields] = useState([]);
  const [cropPrices, setCropPrices] = useState({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailRow, setDetailRow] = useState(null);

  async function load() {
    if (!farmer?.id) return;
    const [{ data: regs }, { data: yields }, { data: prices }] = await Promise.all([
      supabase.from("insurance_registrations").select("*").eq("farmer_id", farmer.id).order("registered_at", { ascending: false }),
      supabase.from("yield_records").select("crop_name, kilograms").eq("farmer_id", farmer.id).eq("status", "Verified"),
      supabase.from("crop_prices").select("*"),
    ]);
    setRows(regs || []);
    setVerifiedYields(yields || []);
    setCropPrices(Object.fromEntries((prices || []).map((p) => [p.crop_name, Number(p.price_per_kg)])));
  }
  useEffect(() => { load(); }, [farmer?.id]);

  function openNew() {
    setForm(empty);
    setFormError("");
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (form.coverage_end_date && form.coverage_start_date && form.coverage_end_date < form.coverage_start_date) {
      setFormError("Coverage end date cannot be before the coverage start date.");
      return;
    }
    setSaving(true);
    setFormError("");
    const { error } = await supabase.from("insurance_registrations").insert({
      ...form,
      coverage_start_date: form.coverage_start_date || form.planting_date,
      coverage_end_date: form.coverage_end_date || null,
      farmer_id: farmer.id, status: "Active",
    });
    setSaving(false);
    if (error) {
      // The DB trigger raises a friendly message when an active policy already exists.
      setFormError(error.message.replace(/^.*insurance_registrations: /, ""));
      return;
    }
    showToast("Crop registered for insurance.", "fa-shield-heart");
    setOpen(false);
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-shield-heart"></i> Crop Insurance</h2><button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> Register Crop</button></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Register crops before any damage occurs to establish insurance eligibility. Expired and past policies stay visible below for your records.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Crop / Plant Name</th><th>Area</th><th>Type</th><th>Coverage</th><th>Source</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No crops registered for insurance yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.crop_name}</td><td>{r.area} ha</td>
                <td><StatusBadge status={r.registration_type || "New Registration"} /></td>
                <td>{r.coverage_start_date || "—"} &rarr; {r.coverage_end_date || "—"}</td>
                <td>{r.insurance_source}</td>
                <td><StatusBadge status={computeInsuranceStatus(r)} /></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setDetailRow(r)}><i className="fa-solid fa-eye"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Register Crop for Insurance" icon="fa-shield-heart">
        <form className="modal-body" onSubmit={submit}>
          {formError && <div className="hint-text" style={{ color: "var(--danger)", background: "var(--cream)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px" }}><i className="fa-solid fa-triangle-exclamation"></i> {formError}</div>}
          <label>Crop <select value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })}>{CROP_LIST.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Area (hectares) <input type="number" step="0.1" min="0.1" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></label>
          <label>Planting Date <input type="date" value={form.planting_date} onChange={(e) => setForm({ ...form, planting_date: e.target.value })} required /></label>
          <label>Coverage Start Date <input type="date" value={form.coverage_start_date} onChange={(e) => setForm({ ...form, coverage_start_date: e.target.value })} /></label>
          <label>Coverage End Date <input type="date" value={form.coverage_end_date} onChange={(e) => setForm({ ...form, coverage_end_date: e.target.value })} /></label>
          <label>Insurance Source <select value={form.insurance_source} onChange={(e) => setForm({ ...form, insurance_source: e.target.value })}>{INSURANCE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : "Save"}</button></div>
        </form>
      </Modal>

      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title={`${detailRow?.crop_name || ""} — Insurance Record`} icon="fa-shield-heart">
        {detailRow && (() => {
          const basis = computeInsuranceBasis(detailRow, verifiedYields, cropPrices);
          const effectiveStatus = computeInsuranceStatus(detailRow);
          return (
            <div className="modal-body">
              <ul className="detail-list">
                <li><span>Crop / Plant Name</span><b>{detailRow.crop_name}</b></li>
                <li><span>Farm Area</span><b>{detailRow.area} ha</b></li>
                <li><span>Registration Type</span><b>{detailRow.registration_type || "New Registration"}</b></li>
                <li><span>Registration Date</span><b>{new Date(detailRow.registered_at).toLocaleDateString("en-PH")}</b></li>
                <li><span>Coverage Period</span><b>{detailRow.coverage_start_date || "—"} to {detailRow.coverage_end_date || "—"}</b></li>
                <li><span>Status</span><b>{effectiveStatus}</b></li>
                <li><span>Insurance Source</span><b>{detailRow.insurance_source}</b></li>
              </ul>
              <p className="rsbsa-subhead">Insurance Calculation Basis</p>
              <div className="qual-box">
                <p style={{ margin: 0 }}>Crop: {detailRow.crop_name}<br />Farm Area: {detailRow.area} ha<br />Yield used: {basis.yieldBasisNote}<br />Crop Price: ₱{basis.price}/kg<br />Estimated Crop Value: {formatPeso(basis.cropValue)}<br />Coverage Rate: {(basis.coverageRate * 100).toFixed(0)}%</p>
              </div>
              {basis.damagePct != null ? (
                <>
                  <p className="rsbsa-subhead">Claim / Damage Assessment</p>
                  <div className="qual-box">
                    <p style={{ margin: 0 }}>
                      Estimated Damage: {basis.damagePct}%<br />
                      Estimated Damage Value: {formatPeso(basis.damageValue)}<br />
                      <b>Estimated Insurance Assistance: {formatPeso(basis.insuranceAmount)}</b><br />
                      {detailRow.claim_date && <>Date of Claim: {detailRow.claim_date}</>}
                    </p>
                  </div>
                </>
              ) : (
                <p className="hint-text">No damage claim on file. If undamaged at harvest, estimated coverage would be {formatPeso(basis.undamagedEstimate)}.</p>
              )}
            </div>
          );
        })()}
      </Modal>
    </section>
  );
}
