import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { ASSISTANCE_TYPES, runQualificationCheck } from "../../lib/businessRules";

export default function FarmerEligibility() {
  const { farmer } = useAuth();
  const [directoryRow, setDirectoryRow] = useState(null);
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    if (!farmer?.id) return;
    (async () => {
      const [{ data: dir }, { data: crops }, { data: yields }, { data: insurance }, { data: assistance }] = await Promise.all([
        supabase.from("farmer_directory").select("*").eq("id", farmer.id).single(),
        supabase.from("crop_registrations").select("id").eq("farmer_id", farmer.id),
        supabase.from("yield_records").select("id").eq("farmer_id", farmer.id).eq("status", "Verified"),
        supabase.from("insurance_registrations").select("id").eq("farmer_id", farmer.id),
        supabase.from("assistance_records").select("assistance_type, status").eq("farmer_id", farmer.id),
      ]);
      setDirectoryRow(dir);
      setCtx({
        hasCropRegistered: (crops || []).length > 0,
        hasVerifiedYield: (yields || []).length > 0,
        hasInsuranceRegistered: (insurance || []).length > 0,
        hasEquipmentAlready: (assistance || []).some((a) => a.assistance_type === "Farming Equipment" && a.status === "Released"),
      });
    })();
  }, [farmer?.id]);

  if (!directoryRow || !ctx) return <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> Checking eligibility…</p>;

  const results = ASSISTANCE_TYPES.map((t) => ({ type: t, ...runQualificationCheck(t, directoryRow, ctx) }));
  const anyQualified = results.some((r) => r.qualified);

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-clipboard-check"></i> My Eligibility</h2></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> A quick status check across every assistance program, using the same Automatic Qualification Check the Barangay and ADMIN see.</p>
      <div className={`qual-box`}>
        <b>{anyQualified ? "You qualify for at least one program." : "You currently don't qualify for any program yet."}</b>
      </div>
      <div className="program-grid">
        {results.map((r) => (
          <div className="panel" key={r.type}>
            <div className="panel-head"><h3>{r.type}</h3></div>
            <ul className="detail-list">
              {r.checks.map((c, i) => (
                <li key={i}><span><i className={`fa-solid ${c.pass ? "fa-circle-check" : "fa-circle-xmark"}`} style={{ color: c.pass ? "var(--resolved)" : "var(--danger)", marginRight: 6 }}></i>{c.label}</span></li>
              ))}
            </ul>
            <p style={{ padding: "8px 4px 0", fontWeight: 700, color: r.qualified ? "var(--resolved)" : "var(--danger)" }}>
              {r.qualified ? "Qualified" : "Not Qualified"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
