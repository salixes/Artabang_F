import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ASSISTANCE_TYPES, runQualificationCheck } from "../../lib/businessRules";

export default function Qualification() {
  const [directory, setDirectory] = useState([]);
  const [selected, setSelected] = useState("");
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    supabase.from("farmer_directory").select("*").order("full_name").then(({ data }) => setDirectory(data || []));
  }, []);

  const farmer = useMemo(() => directory.find((d) => d.id === selected), [directory, selected]);

  useEffect(() => {
    if (!selected) { setCtx(null); return; }
    (async () => {
      const [{ data: crops }, { data: yields }, { data: insurance }, { data: assistance }] = await Promise.all([
        supabase.from("crop_registrations").select("id").eq("farmer_id", selected),
        supabase.from("yield_records").select("id").eq("farmer_id", selected).eq("status", "Verified"),
        supabase.from("insurance_registrations").select("id").eq("farmer_id", selected),
        supabase.from("assistance_records").select("assistance_type, status").eq("farmer_id", selected),
      ]);
      setCtx({
        hasCropRegistered: (crops || []).length > 0,
        hasVerifiedYield: (yields || []).length > 0,
        hasInsuranceRegistered: (insurance || []).length > 0,
        hasEquipmentAlready: (assistance || []).some((a) => a.assistance_type === "Farming Equipment" && a.status === "Released"),
      });
    })();
  }, [selected]);

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-clipboard-check"></i> Qualification Check</h2></div>
      <div className="panel" style={{ maxWidth: 420, marginBottom: 18 }}>
        <label style={{ padding: "0 4px", display: "block" }}>Select Farmer
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose a farmer…</option>
            {directory.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </label>
      </div>

      {farmer && ctx && (
        <div className="program-grid">
          {ASSISTANCE_TYPES.map((t) => {
            const r = runQualificationCheck(t, farmer, ctx);
            return (
              <div className="panel" key={t}>
                <div className="panel-head"><h3>{t}</h3></div>
                <ul className="detail-list">
                  {r.checks.map((c, i) => (
                    <li key={i}><span><i className={`fa-solid ${c.pass ? "fa-circle-check" : "fa-circle-xmark"}`} style={{ color: c.pass ? "var(--resolved)" : "var(--danger)", marginRight: 6 }}></i>{c.label}</span></li>
                  ))}
                </ul>
                <p style={{ padding: "8px 4px 0", fontWeight: 700, color: r.qualified ? "var(--resolved)" : "var(--danger)" }}>{r.qualified ? "Qualified" : "Not Qualified"}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
