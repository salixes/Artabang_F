import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { InsuredBadge, StatusBadge } from "../../components/Badges.jsx";
import PcicApplication, { PcicView } from "./PcicApplication.jsx";

export default function FarmerCrops() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [insuredCrops, setInsuredCrops] = useState(new Set());
  // null = list | "new" = PCIC application form | { saved } = view a saved application
  const [screen, setScreen] = useState(null);

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

  async function remove(id) {
    if (!confirm("Remove this crop registration?")) return;
    const { error } = await supabase.from("crop_registrations").delete().eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Registration removed.", "fa-trash");
    load();
  }

  if (screen === "new") return <PcicApplication onCancel={() => setScreen(null)} onSaved={() => { setScreen(null); load(); }} />;
  if (screen?.saved) return <PcicView saved={screen.saved} onBack={() => setScreen(null)} />;

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-tractor"></i> Crop Registration</h2><button className="btn-primary" onClick={() => setScreen("new")}><i className="fa-solid fa-plus"></i> Register Crop</button></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Register Crop opens the PCIC Application for Crop Insurance (one long bond sheet). Saving it registers the crop and files the insurance application in one step. A newly registered crop is Pending until the MAO verifies it — only verified crops count toward assistance eligibility.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Crop / Plant Name</th><th>Area (ha)</th><th>Planting Date</th><th>Variety</th><th>Land Category</th><th>Tenurial Status</th><th>Verification</th><th>Insurance</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No crops registered yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.crop_name}</td><td>{r.area}</td><td>{r.planting_date}</td><td>{r.variety || "—"}</td><td>{r.land_category || "—"}</td><td>{r.tenurial_status || "—"}</td>
                <td><StatusBadge status={r.status || "Pending"} />{r.status === "Rejected" && r.remarks && <div style={{ fontSize: ".68rem", color: "var(--ink-soft)", marginTop: 2 }}>{r.remarks}</div>}</td>
                <td><InsuredBadge insured={insuredCrops.has(r.crop_name)} /></td>
                <td style={{ whiteSpace: "nowrap" }}>{r.pcic_application && <button className="btn-ghost" title="View / Print PCIC form" onClick={() => setScreen({ saved: r.pcic_application })}><i className="fa-solid fa-file-lines"></i></button>} {r.status !== "Verified" && <button className="btn-ghost" onClick={() => remove(r.id)}><i className="fa-solid fa-trash"></i></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </section>
  );
}
