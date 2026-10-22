import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import ProgramDetails, { DynamicFields } from "../../components/ProgramDetails.jsx";
import "../../components/filterDropdown.css";
import { runQualificationCheck, ASSISTANCE_SOURCES, ASSISTANCE_REQUIREMENTS, ASSISTANCE_TYPES } from "../../lib/businessRules";
import { RELEASE_FIELDS, releaseSummary, defaultsFromProgram, missingRequired, cleanDetails } from "../../lib/assistancePrograms";

const KINDS = [...ASSISTANCE_TYPES, "Other Support Program"];
const OPEN = new Set(["Pending", "Under Review"]);
// "Status ▾" / "Type of assistance ▾": a button that opens the whole list of choices (with counts)
function FilterDropdown({ label, value, options, onChange, showZero = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  const current = options.find((o) => o.key === value) || options[0];
  const badge = (o) => (o.count || showZero ? <span className="kt-count">{o.count || 0}</span> : null);
  return (
    <div className="fd" ref={ref}>
      <button type="button" className={`fd-btn ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="fd-label">{label}:</span> <b>{current.label}</b> {badge(current)} <i className="fa-solid fa-chevron-down fd-caret"></i>
      </button>
      {open && (
        <div className="fd-menu" role="listbox" aria-label={label}>
          {options.map((o) => (
            <button type="button" role="option" aria-selected={o.key === value} key={o.key} className={`fd-opt ${o.key === value ? "on" : ""}`} onClick={() => { onChange(o.key); setOpen(false); }}>
              <span>{o.label}</span>{badge(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EXTRA_REQUIREMENT = { "Other Support Program": "Requirements are set in the announcement for this program." };

// Assistance Management = processing the assistance only. Programs are posted from
// Announcements (kind: Assistance); here the admin reviews and releases them, and each
// kind of assistance records what is specific to it (cash amount, seed type, equipment terms ...).
export default function AdminAssistance() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [directory, setDirectory] = useState({});
  const [contextByFarmer, setContextByFarmer] = useState({});
  const [params, setParams] = useSearchParams();
  const programFilter = params.get("announcement") || "all"; // "all" | "direct" | <announcement id>
  const [programs, setPrograms] = useState([]);
  const [kind, setKind] = useState("All");
  // every application stays listed as a record (Released and Denied too) — "All" is the default
  const [filter, setFilter] = useState("All");
  const [reviewRow, setReviewRow] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data }, { data: dir }, { data: crops }, { data: yields }, { data: insurance }, { data: ann }] = await Promise.all([
      supabase.from("assistance_records").select("*").order("requested_at", { ascending: false }),
      supabase.from("farmer_directory").select("*"),
      supabase.from("crop_registrations").select("farmer_id").eq("status", "Verified"),
      supabase.from("yield_records").select("farmer_id").eq("status", "Verified"),
      supabase.from("insurance_registrations").select("farmer_id"),
      supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false }),
    ]);
    setPrograms(ann || []);
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

  const programById = useMemo(() => Object.fromEntries(programs.map((p) => [p.id, p])), [programs]);
  const inProgram = (r) => programFilter === "all" || (programFilter === "direct" ? !r.announcement_id && !r.program_title : r.announcement_id === programFilter);

  const filtered = useMemo(() => rows.filter((r) => (
    (kind === "All" || r.assistance_type === kind) && (filter === "All" || r.status === filter) && inProgram(r)
  )), [rows, kind, filter, programFilter]);

  // how many applications of each kind still need the admin's attention
  const waiting = useMemo(() => {
    const t = { All: 0 };
    rows.filter(inProgram).forEach((r) => { if (OPEN.has(r.status)) { t.All += 1; t[r.assistance_type] = (t[r.assistance_type] || 0) + 1; } });
    return t;
  }, [rows, programFilter]);

  // one line per posted assistance program (shows even before anyone applied)
  const programStats = useMemo(() => programs.map((p) => {
    const mine = rows.filter((r) => r.announcement_id === p.id);
    const n = (...st) => mine.filter((r) => st.includes(r.status)).length;
    return { p, total: mine.length, review: n("Pending", "Under Review"), incoming: n("Incoming"), released: n("Released"), denied: n("Denied") };
  }), [programs, rows]);
  const STATUS_CHIPS = [["All", ["Pending", "Under Review", "Incoming", "Released", "Denied"]], ["Pending", ["Pending"]], ["Under Review", ["Under Review"]], ["Incoming", ["Incoming"]], ["Released", ["Released"]], ["Denied", ["Denied"]]];
  const chipCount = (match) => rows.filter((r) => (kind === "All" || r.assistance_type === kind) && inProgram(r) && match.includes(r.status)).length;

  const setProgramFilter = (v) => { const n = new URLSearchParams(params); if (v === "all") n.delete("announcement"); else n.set("announcement", v); setParams(n, { replace: true }); };

  function openReview(row) {
    const prog = programById[row.announcement_id];
    const legacy = row.quantity != null ? (row.unit === "PHP" ? { amount: row.quantity } : { quantity: row.quantity, unit: row.unit }) : {};
    setReviewRow(row);
    setForm({
      value_description: row.value_description || "", source: (!row.resolved_at && prog?.details?.source) || row.source || "MAO", // a new application takes the source the program announced
      expected_date: row.expected_date || "", distribution_date: row.distribution_date || "",
      d: { ...defaultsFromProgram(row.assistance_type, prog?.details), ...legacy, ...(row.details || {}) },
    });
  }

  async function resolve(status) {
    const type = reviewRow.assistance_type;
    const fields = RELEASE_FIELDS[type] || [];
    if (status === "Released") {
      const miss = missingRequired(fields, form.d);
      if (miss.length) return showToast(`Please fill in: ${miss.join(", ")}.`, "fa-triangle-exclamation");
    }
    const d = cleanDetails(fields, form.d);
    const qty = type === "Cash Aid" ? d.amount : d.quantity;
    if (qty !== undefined && !(Number(qty) >= 0)) return showToast("Amount / quantity cannot be negative.", "fa-triangle-exclamation");
    const unit = qty === undefined ? null : type === "Cash Aid" ? "PHP" : type === "Farming Equipment" ? "Units" : (d.unit || null);

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      status, details: d, value_description: form.value_description || null, source: form.source,
      quantity: qty === undefined ? null : Number(qty), unit,
      expected_date: form.expected_date || null,
      distribution_date: status === "Released" ? (form.distribution_date || new Date().toISOString().slice(0, 10)) : (form.distribution_date || null),
      resolved_by: user?.id, resolved_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("assistance_records").update(payload).eq("id", reviewRow.id);
    setSaving(false);
    if (error) return showToast(/details/.test(error.message) && /column|schema cache/.test(error.message) ? `${error.message} — run supabase/migrations/announcement_kinds.sql in the Supabase SQL editor first.` : error.message, "fa-triangle-exclamation");
    const summary = releaseSummary({ ...reviewRow, ...payload });
    await supabase.from("notifications").insert({
      recipient_id: reviewRow.farmer_id, icon: status === "Released" ? "fa-circle-check" : status === "Denied" ? "fa-circle-xmark" : "fa-hourglass-half",
      message: `Your <b>${reviewRow.program_title || type}</b> application was marked <b>${status}</b>${summary !== "—" ? ` (${summary})` : ""}.`,
      category: "assistance_result",
    });
    logActivity(`Marked ${reviewRow.program_title || type} of ${directory[reviewRow.farmer_id]?.full_name || "a farmer"} as ${status}`, "assistance");
    showToast(`Application ${status.toLowerCase()}.`, "fa-hand-holding-dollar");
    setReviewRow(null);
    load();
  }

  const qual = reviewRow && directory[reviewRow.farmer_id] ? runQualificationCheck(reviewRow.assistance_type, directory[reviewRow.farmer_id], contextByFarmer[reviewRow.farmer_id] || {}) : null;
  const reviewFields = reviewRow ? RELEASE_FIELDS[reviewRow.assistance_type] || [] : [];
  const reviewProgram = reviewRow ? programById[reviewRow.announcement_id] : null;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-hand-holding-dollar"></i> Assistance Management</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="filter-select" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} aria-label="Program">
            <option value="all">All programs</option>
            <option value="direct">Direct requests (no announcement)</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.assistance_type})</option>)}
          </select>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Assistance is posted from <b>Announcements</b> (kind: Assistance) and shows directly in each farmer's Eligibility page. Here you review and release it — each kind of assistance records what is specific to it. <b>Every application stays here as a record</b>: open any of them again, even after it was released or denied, to view it or change its status and details.</p>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head"><h3><i className="fa-solid fa-bullhorn"></i> Posted assistance programs</h3><span className="hint-text" style={{ margin: 0 }}>{programs.length} posted</span></div>
        {programs.length === 0 ? (
          <p className="hint-text" style={{ margin: "0 4px 6px" }}>Nothing posted yet. Post one from Announcements (kind: Assistance) and it appears here right away.</p>
        ) : (
          <div className="table-panel no-shadow" style={{ maxHeight: 260, overflow: "auto" }}>
            <table className="data-table compact">
              <thead><tr><th>Program</th><th>Type</th><th>Deadline</th><th>Notified</th><th>Applications</th><th>To review</th><th>Incoming</th><th>Released</th><th>Denied</th></tr></thead>
              <tbody>
                {programStats.map(({ p, total, review, incoming, released, denied }) => (
                  <tr key={p.id} style={{ cursor: "pointer", background: programFilter === p.id ? "var(--sage-pale)" : undefined }} onClick={() => setProgramFilter(programFilter === p.id ? "all" : p.id)}>
                    <td><b>{p.title}</b></td><td>{p.assistance_type}</td><td>{p.deadline ? new Date(p.deadline).toLocaleDateString("en-PH") : "—"}</td>
                    <td>{p.recipient_count ?? 0}</td><td><b>{total}</b></td><td>{review}</td><td>{incoming}</td><td>{released}</td><td>{denied}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {programFilter !== "all" && <p className="hint-text" style={{ margin: "8px 4px 0" }}>Showing only this program's applications. <a href="#" onClick={(e) => { e.preventDefault(); setProgramFilter("all"); }}>Show all programs</a></p>}
      </div>

      <div className="fd-row">
        <FilterDropdown
          label="Status" value={filter} onChange={setFilter} showZero
          options={STATUS_CHIPS.map(([key, match]) => ({ key, label: key, count: chipCount(match) }))}
        />
        <FilterDropdown
          label="Type of assistance" value={kind} onChange={setKind}
          options={["All", ...KINDS].map((k) => ({ key: k, label: k === "All" ? "All kinds" : k, count: waiting[k] || 0 }))}
        />
      </div>

      {kind !== "All" && (
        <div className="qual-box kind-info">
          <b>{kind}</b>
          <p><i className="fa-solid fa-clipboard-check"></i> <b>Farmer requirements:</b> {ASSISTANCE_REQUIREMENTS[kind] || EXTRA_REQUIREMENT[kind]}</p>
          <p><i className="fa-solid fa-pen-to-square"></i> <b>Record when releasing:</b> {(RELEASE_FIELDS[kind] || []).filter((f) => f.key !== "unit").map((f) => f.label + (f.required ? " *" : "")).join(" · ")}</p>
        </div>
      )}

      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Program</th><th>Type</th><th>{kind === "All" ? "Released" : kind === "Cash Aid" ? "Amount" : kind === "Crop Insurance" ? "Policy" : "Item & quantity"}</th><th>Source</th><th>Requested</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => openReview(r)}>
                <td>{directory[r.farmer_id]?.full_name || "—"}</td><td>{r.program_title || <span style={{ color: "var(--ink-soft)" }}>Direct request</span>}</td><td>{r.assistance_type}</td>
                <td>{releaseSummary(r)}</td><td><SourceBadge source={r.source} /></td>
                <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td><td><StatusBadge status={r.status} /></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={(e) => { e.stopPropagation(); openReview(r); }}><i className="fa-solid fa-eye"></i> Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!reviewRow} onClose={() => setReviewRow(null)} title={`${reviewRow?.assistance_type || ""} — ${directory[reviewRow?.farmer_id]?.full_name || ""}`} icon="fa-hand-holding-dollar">
        {reviewRow && form && (
          <div className="modal-body">
            <p className="hint-text" style={{ margin: 0 }}>Current status: <StatusBadge status={reviewRow.status} />{reviewRow.resolved_at ? <> · last updated {new Date(reviewRow.resolved_at).toLocaleDateString("en-PH")}</> : null}</p>
            {reviewRow.program_title && <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-hand-holding-heart"></i> Application for the posted assistance: <b>{reviewRow.program_title}</b></p>}
            {reviewProgram && <ProgramDetails type={reviewProgram.assistance_type} details={reviewProgram.details} />}
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
            <p className="rsbsa-subhead" style={{ margin: "4px 0 0" }}>{reviewRow.assistance_type} — what to record</p>
            <DynamicFields fields={reviewFields} values={form.d} onChange={(k, v) => setForm((f) => ({ ...f, d: { ...f.d, [k]: v } }))} />
            <label>Source <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{ASSISTANCE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Expected/Distribution Date <input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></label>
            <label>Notes <input value={form.value_description} onChange={(e) => setForm({ ...form, value_description: e.target.value })} placeholder="Anything else the farmer should know" /></label>
            <div className="modal-actions">
              {reviewRow.status !== "Pending" && <button className="btn-ghost" onClick={() => resolve("Pending")} disabled={saving}>Back to Pending</button>}
              <button className="btn-ghost" onClick={() => resolve("Under Review")} disabled={saving}>Under Review</button>
              <button className="btn-ghost" onClick={() => resolve("Incoming")} disabled={saving}>Mark Incoming</button>
              <button className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => resolve("Denied")} disabled={saving}>Deny</button>
              <button className="btn-primary" onClick={() => resolve("Released")} disabled={saving}><i className="fa-solid fa-check"></i> Release</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
