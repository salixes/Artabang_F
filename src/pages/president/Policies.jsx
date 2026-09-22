import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";

const empty = { title: "", body: "", icon: "fa-scroll", association_id: "" };

export default function Policies() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  async function load() {
    const [{ data }, { data: assoc }] = await Promise.all([
      supabase.from("policies").select("*").order("created_at", { ascending: false }),
      supabase.from("associations").select("*").order("name"),
    ]);
    setRows(data || []);
    setAssociations(assoc || []);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...empty, association_id: associations[0]?.id || "" });
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    const { error } = await supabase.from("policies").insert({ ...form, created_by: profile.id });
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Policy published.", "fa-scroll");
    setOpen(false);
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this policy?")) return;
    const { error } = await supabase.from("policies").delete().eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-scroll"></i> Policy Management</h2><button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> New Policy</button></div>
      <div className="program-grid">
        {rows.length === 0 && <p className="hint-text">No policies published yet.</p>}
        {rows.map((p) => (
          <div className="panel" key={p.id}>
            <div className="panel-head"><h3><i className={`fa-solid ${p.icon}`}></i> {p.title}</h3><button className="btn-ghost" onClick={() => remove(p.id)}><i className="fa-solid fa-trash"></i></button></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)" }}>{p.body}</p>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Policy" icon="fa-scroll">
        <form className="modal-body" onSubmit={submit}>
          <label>Association <select value={form.association_id} onChange={(e) => setForm({ ...form, association_id: e.target.value })} required>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>
          <label>Title <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Details <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary"><i className="fa-solid fa-floppy-disk"></i> Publish</button></div>
        </form>
      </Modal>
    </section>
  );
}
