import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { computeInsuranceStatus, computeInsuranceBasis, formatPeso } from "../../lib/businessRules";

export default function AdminInsurance() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [cropPrices, setCropPrices] = useState({});
  const [yieldsByFarmer, setYieldsByFarmer] = useState({});
  const [filter, setFilter] = useState("All");
  const [detailRow, setDetailRow] = useState(null);
  const [claimForm, setClaimForm] = useState(null); // { estimated_damage_percentage, claim_date, status }
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data }, { data: dir }, { data: prices }, { data: yields }] = await Promise.all([
      supabase.from("insurance_registrations").select("*").order("registered_at", { ascending: false }),
      supabase.from("farmer_directory").select("id, full_name"),
      supabase.from("crop_prices").select("*"),
      supabase.from("yield_records").select("farmer_id, crop_name, quantity_kg").eq("status", "Verified"),
    ]);
    setRows(data || []);
    setNames(Object.fromEntries((dir || []).map((d) => [d.id, d.full_name])));
    setCropPrices(Object.fromEntries((prices || []).map((p) => [p.crop_name, Number(p.price_per_kg)])));
    const grouped = {};
    (yields || []).forEach((y) => { (grouped[y.farmer_id] ||= []).push(y); });
    setYieldsByFarmer(grouped);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "All") return rows;
    return rows.filter((r) => computeInsuranceStatus(r) === filter);
  }, [rows, filter]);

  function history(row) {
    // Full renewal chain for this farmer+crop, oldest first.
    const chain = rows.filter((r) => r.farmer_id === row.farmer_id && r.crop_name === row.crop_name);
    return chain.sort((a, b) => new Date(a.registered_at) - new Date(b.registered_at));
  }

  function openClaim(row) {
    setClaimForm({
      id: row.id,
      estimated_damage_percentage: row.estimated_damage_percentage ?? "",
      claim_date: row.claim_date || new Date().toISOString().slice(0, 10),
      status: "Claimed",
    });
  }

  async function submitClaim(e) {
    e.preventDefault();
    setSaving(true);
    const row = rows.find((r) => r.id === claimForm.id);
    const basis = computeInsuranceBasis({ ...row, estimated_damage_percentage: claimForm.estimated_damage_percentage }, yieldsByFarmer[row.farmer_id] || [], cropPrices);
    const { error } = await supabase.from("insurance_registrations").update({
      estimated_damage_percentage: claimForm.estimated_damage_percentage || null,
      estimated_damage_amount: basis.damageValue,
      estimated_insurance_amount: basis.insuranceAmount,
      claim_date: claimForm.claim_date,
      status: claimForm.status,
    }).eq("id", claimForm.id);
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Claim recorded.", "fa-file-invoice-dollar");
    setClaimForm(null);
    setDetailRow(null);
    load();
  }

  async function setStatus(id, status) {
    const { error } = await supabase.from("insurance_registrations").update({ status }).eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(`Marked ${status}.`, "fa-shield-heart");
    load();
  }

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-shield-heart"></i> Crop Insurance Records</h2>
        <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option><option>Active</option><option>Expired</option><option>Pending</option><option>Claimed</option><option>Cancelled</option>
        </select>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Every crop insurance record, municipality-wide — including expired policies, kept visible for history and reporting.</p>
      <div className="qual-box">
        <b>New Registration vs. Renewal</b>
        <p style={{ margin: 0 }}>A record is a <b>Renewal</b> whenever the farmer already has any prior record for that same crop (regardless of that prior record's outcome) — this applies to every farmer with history for that crop, not a special member category. A brand-new crop/farmer pairing is a <b>New Registration</b>. The system blocks creating a duplicate while an existing policy for that crop is still Active.</p>
      </div>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Crop / Plant Name</th><th>Area</th><th>Type</th><th>Coverage End</th><th>Source</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{names[r.farmer_id] || "—"}</td><td>{r.crop_name}</td><td>{r.area} ha</td>
                <td><StatusBadge status={r.registration_type || "New Registration"} /></td>
                <td>{r.coverage_end_date || "—"}</td><td>{r.insurance_source}</td>
                <td><StatusBadge status={computeInsuranceStatus(r)} /></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setDetailRow(r)}><i className="fa-solid fa-eye"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title={`${detailRow?.crop_name || ""} — ${names[detailRow?.farmer_id] || ""}`} icon="fa-shield-heart" wide>
        {detailRow && (() => {
          const basis = computeInsuranceBasis(detailRow, yieldsByFarmer[detailRow.farmer_id] || [], cropPrices);
          const effectiveStatus = computeInsuranceStatus(detailRow);
          return (
            <div className="modal-body">
              <ul className="detail-list">
                <li><span>Farmer</span><b>{names[detailRow.farmer_id]}</b></li>
                <li><span>Crop / Plant Name</span><b>{detailRow.crop_name}</b></li>
                <li><span>Farm Area</span><b>{detailRow.area} ha</b></li>
                <li><span>Registration Type</span><b>{detailRow.registration_type || "New Registration"}</b></li>
                <li><span>Previous Insurance Record</span><b>{detailRow.previous_insurance_id ? detailRow.previous_insurance_id.slice(0, 8) + "…" : "None"}</b></li>
                <li><span>Registration Date</span><b>{new Date(detailRow.registered_at).toLocaleDateString("en-PH")}</b></li>
                <li><span>Coverage Period</span><b>{detailRow.coverage_start_date || "—"} to {detailRow.coverage_end_date || "—"}</b></li>
                <li><span>Insurance Source</span><b>{detailRow.insurance_source}</b></li>
                <li><span>Status</span><b>{effectiveStatus}</b></li>
              </ul>

              <p className="rsbsa-subhead">Insurance Calculation Basis</p>
              <div className="qual-box">
                <p style={{ margin: 0 }}>Crop: {detailRow.crop_name}<br />Farm Area: {detailRow.area} ha<br />Yield used: {basis.yieldBasisNote}<br />Crop Price: ₱{basis.price}/kg<br />Estimated Crop Value: {formatPeso(basis.cropValue)}<br />Coverage Rate: {(basis.coverageRate * 100).toFixed(0)}%</p>
              </div>

              {basis.damagePct != null ? (
                <div className="qual-box">
                  <b>Claim Recorded</b>
                  <p style={{ margin: 0 }}>Estimated Damage: {basis.damagePct}% ({formatPeso(basis.damageValue)})<br /><b>Estimated Insurance Assistance: {formatPeso(basis.insuranceAmount)}</b><br />Date of Claim: {detailRow.claim_date}</p>
                </div>
              ) : (
                <p className="hint-text">No damage claim filed. Undamaged estimate: {formatPeso(basis.undamagedEstimate)}.</p>
              )}

              <p className="rsbsa-subhead">Insurance History (this crop)</p>
              <ul className="detail-list">
                {history(detailRow).map((h) => (
                  <li key={h.id}><span>{new Date(h.registered_at).getFullYear()} — {h.registration_type}</span><b>{computeInsuranceStatus(h)}</b></li>
                ))}
              </ul>

              <div className="modal-actions">
                {effectiveStatus === "Active" && <button className="btn-ghost" onClick={() => setStatus(detailRow.id, "Cancelled")}>Cancel Policy</button>}
                <button className="btn-primary" onClick={() => openClaim(detailRow)}><i className="fa-solid fa-file-invoice-dollar"></i> Record Claim</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!claimForm} onClose={() => setClaimForm(null)} title="Record Insurance Claim" icon="fa-file-invoice-dollar">
        {claimForm && (
          <form className="modal-body" onSubmit={submitClaim}>
            <label>Estimated Damage (%) <input type="number" min="0" max="100" step="1" value={claimForm.estimated_damage_percentage} onChange={(e) => setClaimForm({ ...claimForm, estimated_damage_percentage: e.target.value })} required /></label>
            <label>Date of Claim <input type="date" value={claimForm.claim_date} onChange={(e) => setClaimForm({ ...claimForm, claim_date: e.target.value })} required /></label>
            <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setClaimForm(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : "Save Claim"}</button></div>
          </form>
        )}
      </Modal>
    </section>
  );
}
