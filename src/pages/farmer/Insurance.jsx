import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import PcicApplication, { PcicView } from "./PcicApplication.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { computeInsuranceStatus, computeInsuranceBasis, formatPeso, ASSISTANCE_REQUIREMENTS } from "../../lib/businessRules";
import { tr } from "../../lib/i18n";


export default function FarmerInsurance() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [verifiedYields, setVerifiedYields] = useState([]);
  const [cropPrices, setCropPrices] = useState({});
  // null = list | "new" = PCIC application form | { saved } = view a saved application
  const [screen, setScreen] = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  async function load() {
    if (!farmer?.id) return;
    const [{ data: regs }, { data: yields }, { data: prices }] = await Promise.all([
      supabase.from("insurance_registrations").select("*").eq("farmer_id", farmer.id).order("registered_at", { ascending: false }),
      supabase.from("yield_records").select("crop_name, quantity_kg").eq("farmer_id", farmer.id).eq("status", "Verified"),
      supabase.from("crop_prices").select("*"),
    ]);
    setRows(regs || []);
    setVerifiedYields(yields || []);
    setCropPrices(Object.fromEntries((prices || []).map((p) => [p.crop_name, Number(p.price_per_kg)])));
  }
  useEffect(() => { load(); }, [farmer?.id]);

  if (screen === "new") return <PcicApplication onCancel={() => setScreen(null)} onSaved={() => { setScreen(null); load(); }} />;
  if (screen?.saved) return <PcicView saved={screen.saved} onBack={() => setScreen(null)} />;

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-shield-heart"></i> {tr("Crop Insurance Records")}</h2><button className="btn-primary" onClick={() => setScreen("new")}><i className="fa-solid fa-plus"></i> {tr("Register Crop")}</button></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> {tr("Register Crop opens the PCIC Application for Crop Insurance (one long bond sheet). Register crops before any damage occurs to establish insurance eligibility. Expired and past policies stay visible below for your records.")}</p>
      <div className="qual-box">
        <b>{tr("How New Registration vs. Renewal is decided")}</b>
        <p style={{ margin: 0 }}>{tr("If this is the first time you're insuring a given crop, it's recorded as a")} <b>{tr("New Registration")}</b>{tr(". If you already have any previous record for that same crop (active, expired, claimed, or cancelled), registering it again is treated as a")} <b>{tr("Renewal")}</b> {tr("— this applies to every farmer with prior history, not only certain members. You cannot start a new registration for a crop while an active policy for it is still in effect; wait for it to expire, be claimed, or be cancelled first.")}</p>
      </div>
      <div className="qual-box">
        <b>{tr("Eligibility Requirements")}</b>
        <p style={{ margin: 0 }}>{tr(ASSISTANCE_REQUIREMENTS["Crop Insurance"])}</p>
      </div>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>{tr("Crop / Plant Name")}</th><th>{tr("Area")}</th><th>{tr("Type")}</th><th>{tr("Coverage")}</th><th>{tr("Source")}</th><th>{tr("Status")}</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>{tr("No crops registered for insurance yet.")}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.crop_name}</td><td>{r.area} {tr("ha")}</td>
                <td><StatusBadge status={r.registration_type || "New Registration"} /></td>
                <td>{r.coverage_start_date || "—"} &rarr; {r.coverage_end_date || "—"}</td>
                <td>{tr(r.insurance_source)}</td>
                <td><StatusBadge status={computeInsuranceStatus(r)} /></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setDetailRow(r)}><i className="fa-solid fa-eye"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title={`${detailRow?.crop_name || ""} — Insurance Record`} icon="fa-shield-heart">
        {detailRow && (() => {
          const basis = computeInsuranceBasis(detailRow, verifiedYields, cropPrices);
          const effectiveStatus = computeInsuranceStatus(detailRow);
          return (
            <div className="modal-body">
              <ul className="detail-list">
                <li><span>{tr("Crop / Plant Name")}</span><b>{detailRow.crop_name}</b></li>
                <li><span>{tr("Farm Area")}</span><b>{detailRow.area} {tr("ha")}</b></li>
                <li><span>{tr("Registration Type")}</span><b>{tr(detailRow.registration_type || "New Registration")}</b></li>
                <li><span>{tr("Registration Date")}</span><b>{new Date(detailRow.registered_at).toLocaleDateString("en-PH")}</b></li>
                <li><span>{tr("Coverage Period")}</span><b>{detailRow.coverage_start_date || "—"} {tr("to")} {detailRow.coverage_end_date || "—"}</b></li>
                <li><span>{tr("Status")}</span><b>{effectiveStatus}</b></li>
                <li><span>{tr("Insurance Source")}</span><b>{tr(detailRow.insurance_source)}</b></li>
              </ul>
              {detailRow.pcic_application && (
                <div className="modal-actions" style={{ justifyContent: "flex-start", padding: "4px 0 10px" }}>
                  <button className="btn-primary" onClick={() => { const saved = detailRow.pcic_application; setDetailRow(null); setScreen({ saved }); }}><i className="fa-solid fa-file-lines"></i> {tr("View / Print PCIC Application Form")}</button>
                </div>
              )}
              <p className="rsbsa-subhead">{tr("Insurance Calculation Basis")}</p>
              <div className="qual-box">
                <p style={{ margin: 0 }}>{tr("Crop:")} {detailRow.crop_name}<br />{tr("Farm Area:")} {detailRow.area} {tr("ha")}<br />{tr("Yield used:")} {basis.yieldBasisNote}<br />{tr("Crop Price: ₱")}{basis.price}{tr("/kg")}<br />{tr("Estimated Crop Value:")} {formatPeso(basis.cropValue)}<br />{tr("Coverage Rate:")} {(basis.coverageRate * 100).toFixed(0)}%</p>
              </div>
              {basis.damagePct != null ? (
                <>
                  <p className="rsbsa-subhead">{tr("Claim / Damage Assessment")}</p>
                  <div className="qual-box">
                    <p style={{ margin: 0 }}>
                      {tr("Estimated Damage:")} {basis.damagePct}%<br />
                      {tr("Estimated Damage Value:")} {formatPeso(basis.damageValue)}<br />
                      <b>{tr("Estimated Insurance Assistance:")} {formatPeso(basis.insuranceAmount)}</b><br />
                      {detailRow.claim_date && <>{tr("Date of Claim:")} {detailRow.claim_date}</>}
                    </p>
                  </div>
                </>
              ) : (
                <p className="hint-text">{tr("No damage claim on file. If undamaged at harvest, estimated coverage would be")} {formatPeso(basis.undamagedEstimate)}.</p>
              )}
            </div>
          );
        })()}
      </Modal>
    </section>
  );
}
