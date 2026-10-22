import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { CROP_LIST } from "../../lib/businessRules";
import ProgramDetails, { DynamicFields } from "../../components/ProgramDetails.jsx";
import {
  ANNOUNCEMENT_KINDS, KIND_FILTERS, ASSISTANCE_KINDS, PROGRAM_FIELDS, audienceLabel,
  kindIcon, kindOfAnnouncement, missingRequired, cleanDetails, fmtDate,
} from "../../lib/assistancePrograms";

const emptyForm = { kind: "General", title: "", body: "", assistance_type: ASSISTANCE_KINDS[0].label, deadline: "", audience: "all", target_crops: [], details: {}, association_id: "" };
const migrationHint = (msg) => (/\bkind\b|details|association_id/.test(msg) && /column|schema cache/.test(msg) ? `${msg} — run supabase/migrations/announcement_kinds.sql in the Supabase SQL editor first.` : msg);

// One page for EVERY kind of announcement. The admin picks the kind when posting;
// "Assistance" announcements also appear in each matching farmer's Eligibility page.
// (The president uses this page too, but only the admin can post assistance.)
export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";
  const kinds = ANNOUNCEMENT_KINDS.filter((k) => isAdmin || k.key !== "Assistance");

  const [general, setGeneral] = useState([]);
  const [associations, setAssociations] = useState([]); // LIFA, Lindasan
  const [assist, setAssist] = useState([]);
  const [apps, setApps] = useState({}); // assistance announcement id -> { total, pending }
  const [filter, setFilter] = useState("All");
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [count, setCount] = useState(null); // farmers matching the chosen audience
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [{ data: g }, { data: a }, { data: recs }, { data: assoc }] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("assistance_records").select("announcement_id, status").not("announcement_id", "is", null),
      supabase.from("associations").select("id, name").order("name"),
    ]);
    setAssociations(assoc || []);
    setGeneral(g || []);
    setAssist(a || []);
    const tally = {};
    (recs || []).forEach((r) => {
      const t = (tally[r.announcement_id] ||= { total: 0, pending: 0 });
      t.total += 1;
      if (r.status === "Pending" || r.status === "Under Review") t.pending += 1;
    });
    setApps(tally);
  }
  useEffect(() => { load(); }, []);

  const isAssistance = form.kind === "Assistance";

  // live "N farmers will be notified" preview, asked of the database so it matches exactly who gets it
  useEffect(() => {
    if (!composing || !isAssistance) return undefined;
    if (form.audience === "crops" && form.target_crops.length === 0) { setCount(null); return undefined; }
    let off = false;
    setCount(undefined);
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc("assistance_recipient_count", { p_audience: form.audience, p_crops: form.target_crops });
      if (off) return;
      setCount(err ? null : data);
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [composing, isAssistance, form.audience, form.target_crops]);

  const toggleCrop = (c) => setForm((f) => ({ ...f, target_crops: f.target_crops.includes(c) ? f.target_crops.filter((x) => x !== c) : [...f.target_crops, c] }));
  const setDetail = (k, v) => setForm((f) => ({ ...f, details: { ...f.details, [k]: v } }));
  const closeForm = () => { setComposing(false); setForm(emptyForm); setError(""); };

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!isAssistance) return postGeneral();
    const fields = PROGRAM_FIELDS[form.assistance_type] || [];
    const miss = missingRequired(fields, form.details);
    if (miss.length) return setError(`Please fill in: ${miss.join(", ")}.`);
    if (form.audience === "crops" && form.target_crops.length === 0) return setError("Select at least one crop, or choose \"All farmers\".");
    if (count === 0) return setError("No farmers match this selection yet, so nobody would be notified. Choose a different crop or send it to all farmers.");
    const who = form.audience === "all" ? "ALL farmers" : `${form.target_crops.join(", ")} farmers`;
    if (!confirm(`Post this assistance and show it in the Eligibility page of ${typeof count === "number" ? count : "the matching"} farmer(s) — ${who}?`)) return;

    setSaving(true);
    const icon = ASSISTANCE_KINDS.find((k) => k.label === form.assistance_type)?.icon;
    const { data: created, error: err } = await supabase.from("assistance_announcements").insert({
      assistance_type: form.assistance_type, icon, title: form.title.trim(), body: form.body.trim(),
      deadline: form.deadline || null, audience: form.audience,
      target_crops: form.audience === "crops" ? form.target_crops : [], details: cleanDetails(fields, form.details), posted_by: profile.id,
    }).select("id").single();
    if (err) {
      setSaving(false);
      const msg = migrationHint(err.message);
      setError(msg);
      return showToast(msg, "fa-triangle-exclamation");
    }
    const { data: saved } = await supabase.from("assistance_announcements").select("recipient_count").eq("id", created.id).single();
    setSaving(false);
    logActivity(`Posted assistance announcement "${form.title.trim()}" — ${saved?.recipient_count ?? 0} farmer(s) notified`, "announcement");
    showToast(`Posted. ${saved?.recipient_count ?? 0} farmer(s) notified.`, "fa-bullhorn");
    closeForm(); load();
  }

  async function postGeneral() {
    setSaving(true);
    const { error: err } = await supabase.from("announcements").insert({
      title: form.title.trim(), body: form.body.trim(), kind: form.kind, icon: kindIcon(form.kind),
      association_id: form.association_id || null,
      posted_by: profile.id, posted_by_role: profile.role,
    });
    setSaving(false);
    if (err) { const msg = migrationHint(err.message); setError(msg); return showToast(msg, "fa-triangle-exclamation"); }
    logActivity(`Posted a ${form.kind.toLowerCase()} announcement`, "announcement");
    showToast("Announcement posted.", "fa-bullhorn");
    closeForm(); load();
  }

  async function removeGeneral(id) {
    if (!confirm("Delete this announcement?")) return;
    const { error: err } = await supabase.from("announcements").delete().eq("id", id);
    if (err) return showToast(err.message, "fa-triangle-exclamation");
    load();
  }
  async function removeAssist(id) {
    if (!confirm("Delete this assistance announcement? Farmers will no longer see it (notifications already sent stay in their list).")) return;
    const { error: err } = await supabase.from("assistance_announcements").delete().eq("id", id);
    if (err) return showToast(err.message, "fa-triangle-exclamation");
    showToast("Announcement deleted.", "fa-trash");
    load();
  }

  const feed = [
    ...general.map((a) => ({ ...a, _kind: kindOfAnnouncement(a), _assist: false })),
    ...assist.map((a) => ({ ...a, _kind: "Assistance", _assist: true })),
  ].filter((a) => filter === "All" || a._kind === filter).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const fields = PROGRAM_FIELDS[form.assistance_type] || [];
  const countText = form.audience === "crops" && form.target_crops.length === 0 ? "Select at least one crop."
    : count === undefined ? "Checking recipients…" : count === null ? ""
      : count === 0 ? "No farmers match this selection yet."
        : `${count} farmer${count === 1 ? "" : "s"} will be notified and will see it in their Eligibility page.`;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-bullhorn"></i> Announcements</h2>
        {!composing && <button className="btn-primary" onClick={() => { setComposing(true); setError(""); }}><i className="fa-solid fa-plus"></i> Post Announcement</button>}
      </div>

      {composing && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 18 }}>
          <div className="panel-head"><h3><i className="fa-solid fa-pen-to-square"></i> New announcement</h3></div>
          {error && <div className="hint-text" style={{ color: "var(--danger)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px", margin: "0 4px 12px" }}><i className="fa-solid fa-triangle-exclamation"></i> {error}</div>}

          <fieldset className="rsbsa-fieldset">
            <legend>Kind of announcement</legend>
            <div className="kind-tabs" role="group" aria-label="Kind of announcement" style={{ marginBottom: 0 }}>
              {kinds.map((k) => (
                <button type="button" key={k.key} className={`aa-chip ${form.kind === k.key ? "on" : ""}`} onClick={() => setForm({ ...emptyForm, kind: k.key, title: form.title, body: form.body, association_id: form.association_id })}>
                  <i className={`fa-solid ${k.icon}`}></i> {k.key}
                </button>
              ))}
            </div>
            <p className="hint-text" style={{ margin: "10px 0 0" }}><i className="fa-solid fa-circle-info"></i> {ANNOUNCEMENT_KINDS.find((k) => k.key === form.kind)?.hint}</p>
          </fieldset>

          <fieldset className="rsbsa-fieldset">
            <legend>Announcement</legend>
            {isAssistance && (
              <div className="rsbsa-grid">
                <label>Type of assistance
                  <select value={form.assistance_type} onChange={(e) => setForm({ ...form, assistance_type: e.target.value, details: {} })}>
                    {ASSISTANCE_KINDS.map((k) => <option key={k.label}>{k.label}</option>)}
                  </select></label>
                <label>Application / distribution deadline (optional)
                  <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
              </div>
            )}
            <label className="aa-field">Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={140}
                placeholder={isAssistance ? "e.g. Cash assistance for corn farmers affected by the dry spell" : "Title"} /></label>
            <label className="aa-field">{isAssistance ? "Details" : "Message"}
              <textarea rows={isAssistance ? 4 : 5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required
                placeholder={isAssistance ? "Who qualifies and how to claim it." : ""} /></label>
          </fieldset>

          {!isAssistance && (
            <fieldset className="rsbsa-fieldset">
              <legend>Send to</legend>
              <label className="aa-field" style={{ marginBottom: 0 }}>Which association?
                <select value={form.association_id} onChange={(e) => setForm({ ...form, association_id: e.target.value })}>
                  <option value="">All associations ({associations.map((a) => a.name).join(" and ") || "everyone"})</option>
                  {associations.map((a) => <option key={a.id} value={a.id}>{a.name} members only</option>)}
                </select>
              </label>
            </fieldset>
          )}

          {isAssistance && (
            <fieldset className="rsbsa-fieldset">
              <legend>{form.assistance_type} — program details</legend>
              <DynamicFields fields={fields} values={form.details} onChange={setDetail} requiredAttr />
            </fieldset>
          )}

          {isAssistance && (
            <fieldset className="rsbsa-fieldset">
              <legend>Send to</legend>
              <div className="aa-audience">
                <label className="rsbsa-check"><input type="radio" name="aud" checked={form.audience === "all"} onChange={() => setForm({ ...form, audience: "all" })} /> All farmers</label>
                <label className="rsbsa-check"><input type="radio" name="aud" checked={form.audience === "crops"} onChange={() => setForm({ ...form, audience: "crops" })} /> Only farmers who plant specific crop(s)</label>
              </div>
              {form.audience === "crops" && (
                <div className="aa-chips" role="group" aria-label="Crops">
                  {CROP_LIST.map((c) => (
                    <label key={c} className={`aa-chip ${form.target_crops.includes(c) ? "on" : ""}`}>
                      <input type="checkbox" checked={form.target_crops.includes(c)} onChange={() => toggleCrop(c)} /> {c}
                    </label>
                  ))}
                </div>
              )}
              <p className={`aa-count ${count === 0 ? "warn" : ""}`}><i className="fa-solid fa-users"></i> {countText}</p>
            </fieldset>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || (isAssistance && (count === 0 || (form.audience === "crops" && form.target_crops.length === 0)))}>
              <i className="fa-solid fa-paper-plane"></i> {saving ? "Posting…" : isAssistance ? "Post & Notify" : "Post"}
            </button>
          </div>
        </form>
      )}

      <div className="kind-tabs" role="group" aria-label="Filter announcements">
        {KIND_FILTERS.filter((k) => isAdmin || k !== "Assistance" || assist.length > 0).map((k) => (
          <button type="button" key={k} className={`aa-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{k}</button>
        ))}
      </div>

      <div className="announce-grid">
        {feed.length === 0 && <p className="hint-text">No announcements yet.</p>}
        {feed.map((a) => a._assist ? (
          <div className="panel" key={`a-${a.id}`}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-hand-holding-dollar"}`}></i> {a.title}</h3>{isAdmin && <button className="btn-ghost" onClick={() => removeAssist(a.id)} aria-label="Delete"><i className="fa-solid fa-trash"></i></button>}</div>
            <div className="aa-meta">
              <span className="aa-badge">Assistance</span>
              <span className="aa-badge soft">{a.assistance_type}</span>
              <span className="aa-badge soft"><i className="fa-solid fa-bullseye"></i> {audienceLabel(a)}</span>
            </div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            <ProgramDetails type={a.assistance_type} details={a.details} />
            <div className="aa-apps">
              <span><i className="fa-solid fa-file-circle-plus"></i> <b>{apps[a.id]?.total || 0}</b> application{(apps[a.id]?.total || 0) === 1 ? "" : "s"}{apps[a.id]?.pending ? <> · <b>{apps[a.id].pending}</b> to review</> : null}</span>
              {isAdmin && <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: ".72rem" }} onClick={() => navigate(`/admin/assistance?announcement=${a.id}`)}>Manage in Assistance</button>}
            </div>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>
              {a.deadline && <>Deadline: <b>{fmtDate(a.deadline)}</b> · </>}
              Sent to <b>{a.recipient_count}</b> farmer{a.recipient_count === 1 ? "" : "s"} · {new Date(a.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
            </small>
          </div>
        ) : (
          <div className="panel" key={`g-${a.id}`}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || kindIcon(a._kind)}`}></i> {a.title}</h3><button className="btn-ghost" onClick={() => removeGeneral(a.id)} aria-label="Delete"><i className="fa-solid fa-trash"></i></button></div>
            <div className="aa-meta"><span className="aa-badge soft">{a._kind}</span><span className="aa-badge soft"><i className="fa-solid fa-bullseye"></i> {a.association_id ? `${associations.find((x) => x.id === a.association_id)?.name || "One association"} members` : "All associations"}</span></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>{new Date(a.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
