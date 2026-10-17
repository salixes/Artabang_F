import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { ASSISTANCE_TYPES, runQualificationCheck } from "../../lib/businessRules";
import { recordTypeFor, isApplicationOpen, fmtDate } from "../../lib/assistancePrograms";

export default function FarmerEligibility() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [directoryRow, setDirectoryRow] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [posted, setPosted] = useState([]);   // assistance announcements addressed to this farmer
  const [applied, setApplied] = useState([]); // this farmer's applications to those announcements
  const [applying, setApplying] = useState(null);

  async function load() {
    if (!farmer?.id) return;
    const [{ data: dir }, { data: crops }, { data: yields }, { data: insurance }, { data: assistance }, { data: ann }] = await Promise.all([
      supabase.from("farmer_directory").select("*").eq("id", farmer.id).single(),
      supabase.from("crop_registrations").select("id").eq("farmer_id", farmer.id).eq("status", "Verified"),
      supabase.from("yield_records").select("id").eq("farmer_id", farmer.id).eq("status", "Verified"),
      supabase.from("insurance_registrations").select("id").eq("farmer_id", farmer.id),
      supabase.from("assistance_records").select("id, assistance_type, status, announcement_id, requested_at").eq("farmer_id", farmer.id),
      // row level security returns ONLY the announcements that were sent to this farmer
      supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false }),
    ]);
    setDirectoryRow(dir);
    setPosted(ann || []);
    setApplied((assistance || []).filter((a) => a.announcement_id));
    setCtx({
      hasCropRegistered: (crops || []).length > 0,
      hasVerifiedYield: (yields || []).length > 0,
      hasInsuranceRegistered: (insurance || []).length > 0,
      hasEquipmentAlready: (assistance || []).some((a) => a.assistance_type === "Farming Equipment" && a.status === "Released"),
    });
  }
  useEffect(() => { load(); }, [farmer?.id]);

  async function apply(a) {
    if (!confirm(`Apply for "${a.title}"?`)) return;
    setApplying(a.id);
    const { error } = await supabase.from("assistance_records").insert({
      farmer_id: farmer.id, assistance_type: recordTypeFor(a.assistance_type), source: "MAO", status: "Pending", announcement_id: a.id,
    });
    setApplying(null);
    if (error) {
      const msg = error.code === "23505" || /duplicate key/.test(error.message) ? "You already applied for this assistance." : error.message;
      return showToast(msg, "fa-triangle-exclamation");
    }
    showToast("Application submitted. The MAO has been notified.", "fa-file-circle-plus");
    load();
  }

  if (!directoryRow || !ctx) return <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> Checking eligibility…</p>;

  const results = ASSISTANCE_TYPES.map((t) => ({ type: t, ...runQualificationCheck(t, directoryRow, ctx) }));
  const anyQualified = results.some((r) => r.qualified);

  // eligibility for each posted assistance: the program's usual requirements + the deadline
  const programs = posted.map((a) => {
    const base = runQualificationCheck(recordTypeFor(a.assistance_type), directoryRow, ctx);
    const checks = [...base.checks];
    if (a.audience === "crops") checks.unshift({ label: `Plants ${a.target_crops.join(" / ")} (covered by this announcement)`, pass: true });
    const open = isApplicationOpen(a);
    if (a.deadline) checks.push({ label: `Application still open (deadline ${fmtDate(a.deadline)})`, pass: open });
    return { a, checks, eligible: checks.every((c) => c.pass), open, application: applied.find((x) => x.announcement_id === a.id) };
  });
  const eligibleCount = programs.filter((p) => p.eligible && !p.application).length;

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-clipboard-check"></i> My Eligibility</h2></div>

      {programs.length > 0 && (
        <>
          <p className="rsbsa-subhead"><i className="fa-solid fa-hand-holding-heart"></i> Posted assistance for you</p>
          <div className="qual-box">
            <b>{eligibleCount > 0 ? `You are eligible to apply for ${eligibleCount} posted assistance program${eligibleCount === 1 ? "" : "s"}.` : "Here is where you stand on the assistance the MAO has posted for you."}</b>
          </div>
          <div className="program-grid" style={{ marginBottom: 22 }}>
            {programs.map(({ a, checks, eligible, open, application }) => (
              <div className="panel" key={a.id}>
                <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-hand-holding-dollar"}`}></i> {a.title}</h3></div>
                <div className="aa-meta">
                  <span className="aa-badge">{a.assistance_type}</span>
                  {a.deadline && <span className="aa-badge soft"><i className="fa-solid fa-calendar-day"></i> Deadline {fmtDate(a.deadline)}</span>}
                </div>
                <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
                <ul className="detail-list">
                  {checks.map((c, i) => (
                    <li key={i}><span><i className={`fa-solid ${c.pass ? "fa-circle-check" : "fa-circle-xmark"}`} style={{ color: c.pass ? "var(--resolved)" : "var(--danger)", marginRight: 6 }}></i>{c.label}</span></li>
                  ))}
                </ul>
                <div style={{ padding: "10px 4px 2px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <b style={{ color: eligible ? "var(--resolved)" : "var(--danger)" }}>{eligible ? "You are eligible" : open ? "Not eligible yet" : "Applications closed"}</b>
                  {application
                    ? <span>Applied · <StatusBadge status={application.status} /></span>
                    : <button className="btn-primary" disabled={!eligible || applying === a.id} onClick={() => apply(a)}>
                        <i className="fa-solid fa-file-circle-plus"></i> {applying === a.id ? "Submitting…" : "Apply"}
                      </button>}
                </div>
              </div>
            ))}
          </div>
          <p className="rsbsa-subhead"><i className="fa-solid fa-list-check"></i> All assistance programs</p>
        </>
      )}

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
