import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";

const empty = { title: "", body: "", icon: "fa-scroll", association_id: "" };
const ICONS = [
  ["fa-scroll", "Scroll"], ["fa-gavel", "Gavel"], ["fa-users", "Members"], ["fa-coins", "Funds"], ["fa-calendar-check", "Meetings"],
  ["fa-handshake", "Agreement"], ["fa-user-tie", "Officers"], ["fa-file-lines", "Document"], ["fa-bullseye", "Goal"], ["fa-triangle-exclamation", "Warning"],
];
const day = (d) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

// The president manages the association's policies: add, edit and delete. Farmers can only read them.
export default function Policies() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState(null);
  const [associations, setAssociations] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    let [{ data, error }, { data: assoc }] = await Promise.all([
      supabase.from("policies").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("associations").select("*").order("name"),
    ]);
    if (error) { // the SQL file has not been run yet (no sort_order column): still show the policies
      ({ data, error } = await supabase.from("policies").select("*").order("created_at", { ascending: true }));
      if (error) showToast(error.message, "fa-triangle-exclamation");
    }
    setRows(data || []);
    setAssociations(assoc || []);
  }
  useEffect(() => { load(); }, []);

  const assocName = (id) => (id ? associations.find((a) => a.id === id)?.name || "—" : "All associations");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((p) => !s || `${p.title} ${p.body}`.toLowerCase().includes(s));
  }, [rows, q]);

  function openNew() { setEditId(null); setForm(empty); setOpen(true); }
  function openEdit(p) {
    setEditId(p.id);
    setForm({ title: p.title, body: p.body, icon: p.icon || "fa-scroll", association_id: p.association_id || "" });
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    const payload = { title: form.title.trim(), body: form.body.trim(), icon: form.icon || "fa-scroll", association_id: form.association_id || null };
    if (!payload.title || !payload.body) return showToast("Please fill in the title and the details.", "fa-triangle-exclamation");
    setSaving(true);
    const next = (rows || []).reduce((m, r) => Math.max(m, r.sort_order || 0), 0) + 1;
    const save = (extra) => (editId
      ? supabase.from("policies").update({ ...payload, ...(extra ? { updated_at: new Date().toISOString() } : {}) }).eq("id", editId)
      : supabase.from("policies").insert({ ...payload, created_by: profile.id, ...(extra ? { sort_order: next } : {}) }));
    let { error } = await save(true);
    if (error && /sort_order|updated_at/.test(error.message)) ({ error } = await save(false)); // SQL file not run yet
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(editId ? "Policy updated." : "Policy added.", "fa-scroll");
    setOpen(false);
    load();
  }

  async function remove(p) {
    if (!confirm(`Delete the policy "${p.title}"? Farmers will no longer see it.`)) return;
    const { error } = await supabase.from("policies").delete().eq("id", p.id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Policy deleted.", "fa-trash");
    load();
  }

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-scroll"></i> Policy Management</h2>
        <div className="head-actions">
          <label className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input placeholder="Search policies…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> New Policy</button>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> <span>These are the by-laws and policies of the association. <b>Only you</b> can add, edit or delete them. Farmers can only read them in their <b>Association Policies</b> page.</span></p>

      {rows === null && <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> Loading…</p>}
      {rows && rows.length === 0 && <p className="hint-text">No policies yet. Press New Policy to add the first one (or run supabase/migrations/association_policies_lindaban.sql to add the by-laws).</p>}
      {rows && rows.length > 0 && filtered.length === 0 && <p className="hint-text">No policies match your search.</p>}

      <div className="policy-list">
        {filtered.map((p) => (
          <article className="panel policy-card" key={p.id}>
            <div className="panel-head">
              <h3><i className={`fa-solid ${p.icon || "fa-scroll"}`}></i> {p.title}</h3>
              <div className="policy-actions">
                <button className="btn-ghost" title="Edit this policy" aria-label="Edit" onClick={() => openEdit(p)}><i className="fa-solid fa-pen-to-square"></i> Edit</button>
                <button className="btn-ghost" title="Delete this policy" aria-label="Delete" style={{ color: "var(--danger)" }} onClick={() => remove(p)}><i className="fa-solid fa-trash"></i></button>
              </div>
            </div>
            <p className="policy-body">{p.body}</p>
            <p className="policy-meta"><span className="policy-scope"><i className="fa-solid fa-people-group"></i> {assocName(p.association_id)}</span>{p.updated_at ? ` · Edited ${day(p.updated_at)}` : ` · Added ${day(p.created_at)}`}</p>
          </article>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit Policy" : "New Policy"} icon="fa-scroll">
        <form className="modal-body" onSubmit={submit}>
          <label>Who is it for?
            <select value={form.association_id} onChange={(e) => setForm({ ...form, association_id: e.target.value })}>
              <option value="">All associations</option>
              {associations.map((a) => <option key={a.id} value={a.id}>{a.name} members only</option>)}
            </select>
          </label>
          <label>Title <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Funds (Art. X)" required /></label>
          <label>Icon
            <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>{ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label>Details <textarea rows={10} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={"One rule per line, for example:\n5. The name is “Lindaban Farmers Association.”"} required /></label>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Saving…" : editId ? "Save changes" : "Add policy"}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
