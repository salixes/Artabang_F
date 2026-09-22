import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge, SourceBadge } from "../../components/Badges.jsx";
import { ASSISTANCE_TYPES, ASSISTANCE_REQUIREMENTS } from "../../lib/businessRules";

export default function FarmerAssistance() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(ASSISTANCE_TYPES[0]);
  const [saving, setSaving] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  async function load() {
    if (!farmer?.id) return;
    const { data } = await supabase.from("assistance_records").select("*").eq("farmer_id", farmer.id).order("requested_at", { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, [farmer?.id]);

  async function submit(e) {
    e.preventDefault();
    const alreadyPending = rows.some((r) => r.assistance_type === type && (r.status === "Pending" || r.status === "Under Review" || r.status === "Incoming"));
    if (alreadyPending) {
      showToast("A request of this type is already pending.", "fa-triangle-exclamation");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("assistance_records").insert({
      farmer_id: farmer.id, assistance_type: type, source: "MAO", status: "Pending",
    });
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Application submitted.", "fa-file-circle-plus");
    setOpen(false);
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-hand-holding-dollar"></i> My Assistance Records</h2><button className="btn-primary" onClick={() => setOpen(true)}><i className="fa-solid fa-file-circle-plus"></i> Apply for Assistance</button></div>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Type</th><th>Quantity</th><th>Source</th><th>Requested</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No assistance records yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setDetailRow(r)}>
                <td>{r.assistance_type}</td><td>{r.quantity ? `${r.quantity} ${r.unit || ""}` : "—"}</td><td><SourceBadge source={r.source} /></td>
                <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td><td><StatusBadge status={r.status} /></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={(e) => { e.stopPropagation(); setDetailRow(r); }}><i className="fa-solid fa-eye"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Apply for Assistance" icon="fa-file-circle-plus">
        <form className="modal-body" onSubmit={submit}>
          <label>Assistance Type <select value={type} onChange={(e) => setType(e.target.value)}>{ASSISTANCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <div className="qual-box"><p className="hint-text" style={{ margin: 0 }}>{ASSISTANCE_REQUIREMENTS[type]}</p></div>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}><i className="fa-solid fa-floppy-disk"></i> {saving ? "Submitting…" : "Submit Application"}</button></div>
        </form>
      </Modal>

      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title="Assistance Details" icon="fa-hand-holding-dollar">
        {detailRow && (
          <div className="modal-body">
            <ul className="detail-list">
              <li><span>Assistance Type</span><b>{detailRow.assistance_type}</b></li>
              <li><span>Source</span><b>{detailRow.source}</b></li>
              <li><span>Quantity</span><b>{detailRow.quantity ? `${detailRow.quantity} ${detailRow.unit || ""}` : "Not yet specified"}</b></li>
              <li><span>Requested</span><b>{new Date(detailRow.requested_at).toLocaleDateString("en-PH")}</b></li>
              <li><span>Expected Date</span><b>{detailRow.expected_date || "—"}</b></li>
              <li><span>Distribution Date</span><b>{detailRow.distribution_date || "—"}</b></li>
              <li><span>Value / Notes</span><b>{detailRow.value_description || "—"}</b></li>
              <li><span>Status</span><b>{detailRow.status}</b></li>
            </ul>
          </div>
        )}
      </Modal>
    </section>
  );
}
