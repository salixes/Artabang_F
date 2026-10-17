import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { CROP_LIST } from "../../lib/businessRules";

export const ASSISTANCE_KINDS = [
  { label: "Cash Assistance", icon: "fa-hand-holding-dollar" },
  { label: "Seeds", icon: "fa-seedling" },
  { label: "Fertilizer", icon: "fa-leaf" },
  { label: "Farming Equipment", icon: "fa-tractor" },
  { label: "Crop Insurance", icon: "fa-shield-heart" },
  { label: "Other Support Program", icon: "fa-hand-holding-heart" },
];

const emptyForm = { assistance_type: ASSISTANCE_KINDS[0].label, title: "", body: "", deadline: "", audience: "all", target_crops: [] };

export const audienceLabel = (a) => (a.audience === "all" ? "All farmers" : `${a.target_crops.join(", ")} farmers`);

export default function AssistanceAnnouncement() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [apps, setApps] = useState({}); // announcement id -> { total, pending }
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [count, setCount] = useState(null); // how many farmers match the chosen audience
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    // applications farmers have submitted for each announcement
    const { data: recs } = await supabase.from("assistance_records").select("announcement_id, status").not("announcement_id", "is", null);
    const tally = {};
    (recs || []).forEach((r) => {
      const t = (tally[r.announcement_id] ||= { total: 0, pending: 0 });
      t.total += 1;
      if (r.status === "Pending" || r.status === "Under Review") t.pending += 1;
    });
    setApps(tally);
  }
  useEffect(() => { load(); }, []);

  // live "N farmers will be notified" preview — asked of the database, so it matches exactly who gets it
  useEffect(() => {
    if (!composing) return undefined;
    if (form.audience === "crops" && form.target_crops.length === 0) { setCount(null); return undefined; }
    let off = false;
    setCount(undefined);
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc("assistance_recipient_count", { p_audience: form.audience, p_crops: form.target_crops });
      if (off) return;
      setCount(err ? null : data);
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [composing, form.audience, form.target_crops]);

  const toggleCrop = (c) => setForm((f) => ({
    ...f, target_crops: f.target_crops.includes(c) ? f.target_crops.filter((x) => x !== c) : [...f.target_crops, c],
  }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.audience === "crops" && form.target_crops.length === 0) return setError("Select at least one crop, or choose \"All farmers\".");
    if (count === 0) return setError("No farmers match this selection yet, so nobody would be notified. Choose a different crop or send it to all farmers.");
    const who = form.audience === "all" ? "ALL farmers" : `${form.target_crops.join(", ")} farmers`;
    if (!confirm(`Post this announcement and notify ${typeof count === "number" ? count : "the matching"} farmer(s) — ${who}?`)) return;

    setSaving(true);
    const icon = ASSISTANCE_KINDS.find((k) => k.label === form.assistance_type)?.icon;
    const { data: created, error: err } = await supabase.from("assistance_announcements").insert({
      assistance_type: form.assistance_type, icon, title: form.title.trim(), body: form.body.trim(),
      deadline: form.deadline || null, audience: form.audience,
      target_crops: form.audience === "crops" ? form.target_crops : [], posted_by: profile.id,
    }).select("id").single();
    if (err) {
      setSaving(false);
      const msg = /assistance_announcements/.test(err.message) && /does not exist|schema cache/.test(err.message)
        ? `${err.message} — run supabase/migrations/assistance_announcement.sql in the Supabase SQL editor first.` : err.message;
      setError(msg);
      return showToast(msg, "fa-triangle-exclamation");
    }
    // the database already notified the matching farmers; read back how many
    const { data: saved } = await supabase.from("assistance_announcements").select("recipient_count").eq("id", created.id).single();
    setSaving(false);
    showToast(`Posted. ${saved?.recipient_count ?? 0} farmer(s) notified.`, "fa-bullhorn");
    setForm(emptyForm); setComposing(false); load();
  }

  async function remove(id) {
    if (!confirm("Delete this assistance announcement? Farmers will no longer see it (notifications already sent stay in their list).")) return;
    const { error: err } = await supabase.from("assistance_announcements").delete().eq("id", id);
    if (err) return showToast(err.message, "fa-triangle-exclamation");
    showToast("Announcement deleted.", "fa-trash");
    load();
  }

  const countText = form.audience === "crops" && form.target_crops.length === 0
    ? "Select at least one crop."
    : count === undefined ? "Checking recipients…"
      : count === null ? ""
        : count === 0 ? "No farmers match this selection yet."
          : `${count} farmer${count === 1 ? "" : "s"} will be notified.`;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-hand-holding-heart"></i> Assistance Announcement</h2>
        {!composing && <button className="btn-primary" onClick={() => { setComposing(true); setError(""); }}><i className="fa-solid fa-plus"></i> New Assistance Announcement</button>}
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Announce cash assistance or other support programs. Choose all farmers, or only farmers who plant specific crops — only the matching farmers are notified and can see it.</p>

      {composing && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 18 }}>
          <div className="panel-head"><h3><i className="fa-solid fa-pen-to-square"></i> New Assistance Announcement</h3></div>
          {error && <div className="hint-text" style={{ color: "var(--danger)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px", margin: "0 4px 12px" }}><i className="fa-solid fa-triangle-exclamation"></i> {error}</div>}

          <fieldset className="rsbsa-fieldset">
            <legend>Announcement</legend>
            <div className="rsbsa-grid">
              <label>Type of assistance
                <select value={form.assistance_type} onChange={(e) => setForm({ ...form, assistance_type: e.target.value })}>
                  {ASSISTANCE_KINDS.map((k) => <option key={k.label}>{k.label}</option>)}
                </select></label>
              <label>Application / distribution deadline (optional)
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
            </div>
            <label className="aa-field">Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Cash assistance for corn farmers affected by the dry spell" required maxLength={140} /></label>
            <label className="aa-field">Details
              <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What is being given, who qualifies, and how/where to claim it." required /></label>
          </fieldset>

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

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => { setComposing(false); setForm(emptyForm); setError(""); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || count === 0 || (form.audience === "crops" && form.target_crops.length === 0)}><i className="fa-solid fa-paper-plane"></i> {saving ? "Posting…" : "Post & Notify"}</button>
          </div>
        </form>
      )}

      <div className="announce-grid">
        {rows.length === 0 && <p className="hint-text">No assistance announcements posted yet.</p>}
        {rows.map((a) => (
          <div className="panel" key={a.id}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-hand-holding-dollar"}`}></i> {a.title}</h3><button className="btn-ghost" onClick={() => remove(a.id)} aria-label="Delete"><i className="fa-solid fa-trash"></i></button></div>
            <div className="aa-meta">
              <span className="aa-badge">{a.assistance_type}</span>
              <span className="aa-badge soft"><i className="fa-solid fa-bullseye"></i> {audienceLabel(a)}</span>
            </div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            <div className="aa-apps">
              <span><i className="fa-solid fa-file-circle-plus"></i> <b>{apps[a.id]?.total || 0}</b> application{(apps[a.id]?.total || 0) === 1 ? "" : "s"}{apps[a.id]?.pending ? <> · <b>{apps[a.id].pending}</b> to review</> : null}</span>
              <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: ".72rem" }} onClick={() => navigate(`/admin/assistance?announcement=${a.id}`)}>View applications</button>
            </div>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>
              {a.deadline && <>Deadline: <b>{new Date(a.deadline).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</b> · </>}
              Sent to <b>{a.recipient_count}</b> farmer{a.recipient_count === 1 ? "" : "s"} · {new Date(a.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
