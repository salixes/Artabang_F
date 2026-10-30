import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import { runQualificationCheck, ASSISTANCE_UNITS } from "../../lib/businessRules";
import { useMemberScope, inScope } from "../../lib/memberScope";
import { releaseSummary } from "../../lib/assistancePrograms";

export default function AssistanceDistribution() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [programs, setPrograms] = useState([]); // assistance the admin posted
  const [programFilter, setProgramFilter] = useState("all");
  const [directory, setDirectory] = useState({});
  const [contextByFarmer, setContextByFarmer] = useState({});
  const scope = useMemberScope(); // only members of the association
  const [filter, setFilter] = useState("All");
  const [reviewRow, setReviewRow] = useState(null);
  const [form, setForm] = useState({ note: "", quantity: "", unit: ASSISTANCE_UNITS[0] });

  async function load() {
    const [{ data }, { data: dir }, { data: crops }, { data: yields }, { data: insurance }, { data: posted }] = await Promise.all([
      supabase.from("assistance_records").select("*").order("requested_at", { ascending: false }),
      supabase.from("farmer_directory").select("*"),
      supabase.from("crop_registrations").select("farmer_id").eq("status", "Verified"),
      supabase.from("yield_records").select("farmer_id").eq("status", "Verified"),
      supabase.from("insurance_registrations").select("farmer_id"),
      supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false }),
    ]);
    setPrograms(posted || []);
    setRows(data || []);
    setDirectory(Object.fromEntries((dir || []).map((d) => [d.id, d])));
    const cropSet = new Set((crops || []).map((c) => c.farmer_id));
    const yieldSet = new Set((yields || []).map((y) => y.farmer_id));
    const insSet = new Set((insurance || []).map((i) => i.farmer_id));
    const equipReleased = new Set((data || []).filter((a) => a.assistance_type === "Farming Equipment" && a.status === "Released").map((a) => a.farmer_id));
    const ctx = {};
    (dir || []).forEach((d) => { ctx[d.id] = { hasCropRegistered: cropSet.has(d.id), hasVerifiedYield: yieldSet.has(d.id), hasInsuranceRegistered: insSet.has(d.id), hasEquipmentAlready: equipReleased.has(d.id) }; });
    setContextByFarmer(ctx);
  }
  useEffect(() => { load(); }, []);

  // "directly": when the admin posts assistance or releases it, this page updates by itself
  useEffect(() => {
    const channel = supabase.channel("president-assistance")
      .on("postgres_changes", { event: "*", schema: "public", table: "assistance_records" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "assistance_announcements" }, load)
      .subscribe();
    const poll = setInterval(load, 15000); // fallback in case the live connection is off
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { supabase.removeChannel(channel); clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const members = useMemo(() => rows.filter((r) => inScope(scope, r.farmer_id)), [rows, scope]);
  const inProgram = (r) => programFilter === "all" || r.announcement_id === programFilter;
  const filtered = useMemo(() => members.filter((r) => inProgram(r) && (filter === "All" || r.status === filter)), [members, filter, programFilter]);
  // one line per posted program; the numbers are for association members only
  const programStats = useMemo(() => programs.map((p) => {
    const mine = members.filter((r) => r.announcement_id === p.id);
    const n = (...st) => mine.filter((r) => st.includes(r.status)).length;
    return { p, total: mine.length, review: n("Pending", "Under Review"), incoming: n("Incoming"), released: n("Released"), denied: n("Denied") };
  }), [programs, members]);
  const STATUS_TABS = [["All", ["Pending", "Under Review", "Incoming", "Released", "Denied"]], ["Released", ["Released"]], ["Incoming", ["Incoming"]], ["Pending", ["Pending", "Under Review"]], ["Denied", ["Denied"]]];
  const countIn = (match) => members.filter((r) => inProgram(r) && match.includes(r.status)).length;
  const qual = reviewRow && directory[reviewRow.farmer_id] ? runQualificationCheck(reviewRow.assistance_type, directory[reviewRow.farmer_id], contextByFarmer[reviewRow.farmer_id] || {}) : null;

  function openReview(row) {
    setReviewRow(row);
    setForm({ note: row.value_description || "", quantity: row.quantity ?? "", unit: row.unit || ASSISTANCE_UNITS[0] });
  }

  async function recommend() {
    if (Number(form.quantity) < 0) return showToast("Quantity cannot be negative.", "fa-triangle-exclamation");
    const { error } = await supabase.from("assistance_records").update({
      status: "Under Review", value_description: form.note || reviewRow.value_description,
      quantity: form.quantity === "" ? null : Number(form.quantity), unit: form.quantity === "" ? null : form.unit,
    }).eq("id", reviewRow.id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    logActivity("Recommended an assistance request to the admin for release", "assistance");
    showToast("Recommended to ADMIN for final release.", "fa-thumbs-up");
    setReviewRow(null);
    load();
  }

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-hand-holding-dollar"></i> Assistance Distribution</h2>
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head"><h3><i className="fa-solid fa-bullhorn"></i> Assistance posted by the admin</h3><span className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-rotate"></i> updates automatically</span></div>
        {programs.length === 0 ? (
          <p className="hint-text" style={{ margin: "0 4px 6px" }}>Nothing posted yet. When the admin posts an assistance it appears here right away.</p>
        ) : (
          <div className="table-panel no-shadow" style={{ maxHeight: 260, overflow: "auto" }}>
            <table className="data-table compact">
              <thead><tr><th>Program</th><th>Type</th><th>Source</th><th>Deadline</th><th>Members applied</th><th>To review</th><th>Incoming</th><th>Released</th><th>Denied</th></tr></thead>
              <tbody>
                {programStats.map(({ p, total, review, incoming, released, denied }) => (
                  <tr key={p.id} style={{ cursor: "pointer", background: programFilter === p.id ? "var(--sage-pale)" : undefined }} onClick={() => setProgramFilter(programFilter === p.id ? "all" : p.id)}>
                    <td><b>{p.title}</b></td><td>{p.assistance_type}</td><td>{p.details?.source || "—"}</td>
                    <td>{p.deadline ? new Date(p.deadline).toLocaleDateString("en-PH") : "—"}</td>
                    <td><b>{total}</b></td><td>{review}</td><td>{incoming}</td><td>{released}</td><td>{denied}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint-text" style={{ margin: "8px 4px 0" }}>The numbers count <b>association members</b> only.{programFilter !== "all" && <> Showing only this program below. <a href="#" onClick={(e) => { e.preventDefault(); setProgramFilter("all"); }}>Show all programs</a></>}</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 12px" }}>
        {STATUS_TABS.map(([key, match]) => (
          <button type="button" key={key} className={filter === key ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: ".78rem" }} onClick={() => setFilter(key)}>
            {key === "Pending" ? "Pending / Under Review" : key} ({countIn(match)})
          </button>
        ))}
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Only members of the association are listed. Review pending applications and recommend them to the ADMIN for final release. Final approval remains with the Municipal Agriculture Office.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Program / Type</th><th>Quantity / Details</th><th>Source</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} style={{ cursor: r.status === "Pending" ? "pointer" : "default" }} onClick={() => r.status === "Pending" && openReview(r)}>
                <td>{directory[r.farmer_id]?.full_name || "—"}</td><td>{r.program_title || r.assistance_type}{r.program_title && <small style={{ display: "block", color: "var(--ink-soft)" }}>{r.assistance_type}</small>}</td>
                <td>{releaseSummary(r)}</td><td><SourceBadge source={r.source} /></td>
                <td>{new Date(r.status === "Released" ? (r.distribution_date || r.resolved_at || r.requested_at) : r.requested_at).toLocaleDateString("en-PH")}{r.status === "Released" && <small style={{ display: "block", color: "var(--ink-soft)" }}>released</small>}</td><td><StatusBadge status={r.status} /></td>
                <td>{r.status === "Pending" && <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={(e) => { e.stopPropagation(); openReview(r); }}><i className="fa-solid fa-eye"></i> Review</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!reviewRow} onClose={() => setReviewRow(null)} title={`Review — ${reviewRow?.assistance_type || ""}`} icon="fa-hand-holding-dollar">
        {reviewRow && (
          <div className="modal-body">
            <p><b>Farmer:</b> {directory[reviewRow.farmer_id]?.full_name}</p>
            {qual && (
              <div className="qual-box">
                <b>{qual.qualified ? "Meets automatic qualification criteria" : "Does not fully meet qualification criteria"}</b>
                <ul className="detail-list">
                  {qual.checks.map((c, i) => (
                    <li key={i}><span><i className={`fa-solid ${c.pass ? "fa-circle-check" : "fa-circle-xmark"}`} style={{ color: c.pass ? "var(--resolved)" : "var(--danger)", marginRight: 6 }}></i>{c.label}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>Recommended Quantity <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
              <label style={{ flex: 1 }}>Unit <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{ASSISTANCE_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
            </div>
            <label>Recommendation Notes <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Recommend ₱5,000 cash aid" /></label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setReviewRow(null)}>Cancel</button>
              <button className="btn-primary" onClick={recommend}><i className="fa-solid fa-thumbs-up"></i> Recommend to ADMIN</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
