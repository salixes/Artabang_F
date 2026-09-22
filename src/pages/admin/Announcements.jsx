import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";

const empty = { title: "", body: "", icon: "fa-bullhorn" };

export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({ ...form, posted_by: profile.id, posted_by_role: profile.role });
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Announcement posted.", "fa-bullhorn");
    setOpen(false);
    setForm(empty);
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-bullhorn"></i> Announcements</h2><button className="btn-primary" onClick={() => setOpen(true)}><i className="fa-solid fa-plus"></i> Post Announcement</button></div>
      <div className="announce-grid">
        {rows.length === 0 && <p className="hint-text">No announcements yet.</p>}
        {rows.map((a) => (
          <div className="panel" key={a.id}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon}`}></i> {a.title}</h3><button className="btn-ghost" onClick={() => remove(a.id)}><i className="fa-solid fa-trash"></i></button></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)" }}>{a.body}</p>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Post Announcement" icon="fa-bullhorn">
        <form className="modal-body" onSubmit={submit}>
          <label>Title <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Icon <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
            <option value="fa-bullhorn">Bullhorn</option><option value="fa-triangle-exclamation">Alert</option><option value="fa-calendar-days">Calendar</option><option value="fa-hand-holding-dollar">Assistance</option>
          </select></label>
          <label>Message <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Posting…" : <><i className="fa-solid fa-paper-plane"></i> Post</>}</button></div>
        </form>
      </Modal>
    </section>
  );
}
