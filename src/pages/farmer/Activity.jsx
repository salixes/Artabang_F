import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { tr } from "../../lib/i18n";

function Panel({ title, icon, items, render }) {
  return (
    <div className="panel">
      <div className="panel-head"><h3><i className={`fa-solid ${icon}`}></i> {title}</h3></div>
      <div className="activity-list">
        {items.length === 0 && <p className="hint-text">{tr("Nothing recorded yet.")}</p>}
        {items.map(render)}
      </div>
    </div>
  );
}

export default function FarmerActivity() {
  const { farmer } = useAuth();
  const [data, setData] = useState({ yields: [], assistance: [], insurance: [], crops: [], requests: [] });

  useEffect(() => {
    if (!farmer?.id) return;
    (async () => {
      const [{ data: yields }, { data: assistance }, { data: insurance }, { data: crops }, { data: requests }] = await Promise.all([
        supabase.from("yield_records").select("*").eq("farmer_id", farmer.id).order("created_at", { ascending: false }),
        supabase.from("assistance_records").select("*").eq("farmer_id", farmer.id).order("requested_at", { ascending: false }),
        supabase.from("insurance_registrations").select("*").eq("farmer_id", farmer.id).order("registered_at", { ascending: false }),
        supabase.from("crop_registrations").select("*").eq("farmer_id", farmer.id).order("registered_at", { ascending: false }),
        supabase.from("profile_update_requests").select("*").eq("farmer_id", farmer.id).order("submitted_at", { ascending: false }),
      ]);
      setData({ yields: yields || [], assistance: assistance || [], insurance: insurance || [], crops: crops || [], requests: requests || [] });
    })();
  }, [farmer?.id]);

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-timeline"></i> {tr("Activity & History")}</h2></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> {tr("Everything recorded under your account, most recent first.")}</p>
      <div className="dash-grid">
        <Panel title={tr("Yield Reports")} icon="fa-wheat-awn" items={data.yields} render={(y) => (
          <div key={y.id}><b>{y.crop_name}</b> — {y.quantity} {y.unit}, {y.season} <small style={{ display: "block", color: "var(--ink-soft)" }}>{y.status} · {new Date(y.created_at).toLocaleDateString("en-PH")}</small></div>
        )} />
        <Panel title={tr("Assistance Applications")} icon="fa-hand-holding-dollar" items={data.assistance} render={(a) => (
          <div key={a.id}><b>{tr(a.assistance_type)}</b> — {tr(a.status)} <small style={{ display: "block", color: "var(--ink-soft)" }}>{new Date(a.requested_at).toLocaleDateString("en-PH")}</small></div>
        )} />
        <Panel title={tr("Crop Insurance")} icon="fa-shield-heart" items={data.insurance} render={(i) => (
          <div key={i.id}><b>{i.crop_name}</b> — {i.area} {tr("ha,")} {i.status} <small style={{ display: "block", color: "var(--ink-soft)" }}>{new Date(i.registered_at).toLocaleDateString("en-PH")}</small></div>
        )} />
        <Panel title={tr("Crop Registrations")} icon="fa-tractor" items={data.crops} render={(c) => (
          <div key={c.id}><b>{c.crop_name}</b> — {c.area} {tr("ha")} <small style={{ display: "block", color: "var(--ink-soft)" }}>{new Date(c.registered_at).toLocaleDateString("en-PH")}</small></div>
        )} />
        <Panel title={tr("Profile Update Requests")} icon="fa-id-card" items={data.requests} render={(r) => (
          <div key={r.id}>{tr("Update request —")} {r.overall_status} <small style={{ display: "block", color: "var(--ink-soft)" }}>{new Date(r.submitted_at).toLocaleDateString("en-PH")}</small></div>
        )} />
      </div>
    </section>
  );
}
