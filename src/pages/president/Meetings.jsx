import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";

const empty = { title: "", meeting_type: "Meeting", meeting_date: "", location: "", association_id: "" };

export default function Meetings() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [attendanceRow, setAttendanceRow] = useState(null);
  const [attendance, setAttendance] = useState({});

  async function load() {
    const [{ data }, { data: assoc }, { data: dir }] = await Promise.all([
      supabase.from("meetings").select("*").order("meeting_date", { ascending: false }),
      supabase.from("associations").select("*").order("name"),
      supabase.from("farmer_directory").select("id, full_name, association_name"),
    ]);
    setRows(data || []);
    setAssociations(assoc || []);
    setMembers(dir || []);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...empty, association_id: associations[0]?.id || "" });
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    const { error } = await supabase.from("meetings").insert({ ...form, created_by: profile.id });
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Meeting scheduled.", "fa-people-roof");
    setOpen(false);
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this meeting?")) return;
    await supabase.from("meetings").delete().eq("id", id);
    load();
  }

  async function openAttendance(meeting) {
    setAttendanceRow(meeting);
    const { data } = await supabase.from("attendance").select("*").eq("meeting_id", meeting.id);
    setAttendance(Object.fromEntries((data || []).map((a) => [a.farmer_id, a.present])));
  }

  async function toggleAttend(farmerId) {
    const present = !attendance[farmerId];
    setAttendance((prev) => ({ ...prev, [farmerId]: present }));
    await supabase.from("attendance").upsert({ meeting_id: attendanceRow.id, farmer_id: farmerId, present });
  }

  const assocName = (id) => associations.find((a) => a.id === id)?.name;
  const membersForMeeting = attendanceRow ? members.filter((m) => m.association_name === assocName(attendanceRow.association_id)) : [];

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-people-roof"></i> Meetings &amp; Attendance</h2><button className="btn-primary" onClick={openNew}><i className="fa-solid fa-plus"></i> Schedule Meeting</button></div>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Location</th><th>Association</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No meetings scheduled yet.</td></tr>}
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td><td>{m.meeting_type}</td><td>{m.meeting_date}</td><td>{m.location}</td><td>{assocName(m.association_id) || "—"}</td>
                <td>
                  <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => openAttendance(m)}><i className="fa-solid fa-clipboard-user"></i></button>{" "}
                  <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => remove(m.id)}><i className="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Schedule Meeting" icon="fa-people-roof">
        <form className="modal-body" onSubmit={submit}>
          <label>Association <select value={form.association_id} onChange={(e) => setForm({ ...form, association_id: e.target.value })} required>{associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>Title <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Type <select value={form.meeting_type} onChange={(e) => setForm({ ...form, meeting_type: e.target.value })}><option>Meeting</option><option>Gathering</option></select></label>
          <label>Date <input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} required /></label>
          <label>Location <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary"><i className="fa-solid fa-floppy-disk"></i> Schedule</button></div>
        </form>
      </Modal>

      <Modal open={!!attendanceRow} onClose={() => setAttendanceRow(null)} title={`Attendance — ${attendanceRow?.title || ""}`} icon="fa-clipboard-user">
        <div className="modal-body">
          {membersForMeeting.length === 0 && <p className="hint-text">No members found for this association.</p>}
          {membersForMeeting.map((m) => (
            <label key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!attendance[m.id]} onChange={() => toggleAttend(m.id)} style={{ width: "auto" }} />
              {m.full_name}
            </label>
          ))}
          <div className="modal-actions"><button className="btn-primary" onClick={() => setAttendanceRow(null)}>Done</button></div>
        </div>
      </Modal>
    </section>
  );
}
