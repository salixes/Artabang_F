import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import RsbsaForm from "./RsbsaForm.jsx";
import RsbsaEnroll from "./RsbsaEnroll.jsx";

function fullNameOf(f) {
  return [f.surname, f.first_name, f.middle_name, f.extension_name].filter(Boolean).join(", ") || f.full_name;
}

export default function AdminFarmers() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [search, setSearch] = useState("");
  // null = list | { farmer: null } = new enrollment | { farmer: row } = edit
  const [enroll, setEnroll] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [rsbsaRow, setRsbsaRow] = useState(null);

  async function load() {
    const [{ data: dir }, { data: assoc }] = await Promise.all([
      supabase.from("farmer_directory").select("*").order("full_name"),
      supabase.from("associations").select("*").order("name"),
    ]);
    setRows(dir || []);
    setAssociations(assoc || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => fullNameOf(r).toLowerCase().includes(q) || (r.location || "").toLowerCase().includes(q) || (r.rsbsa_number || "").toLowerCase().includes(q));
  }, [rows, search]);

  async function toggleValidate(row) {
    const { error } = await supabase.from("farmers").update({ validated: !row.validated }).eq("id", row.id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(row.validated ? "Validation revoked." : "Farmer validated.", "fa-user-check");
    load();
  }

  async function remove(row) {
    if (!confirm(`Permanently delete ${fullNameOf(row)}'s account? This cannot be undone.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: row.id } });
    if (error || data?.error) return showToast(data?.error || error.message, "fa-triangle-exclamation");
    showToast("Farmer account deleted.", "fa-trash");
    load();
  }

  if (rsbsaRow) return <RsbsaForm farmer={rsbsaRow} onBack={() => setRsbsaRow(null)} />;
  if (enroll) {
    return (
      <RsbsaEnroll
        farmer={enroll.farmer}
        associations={associations}
        onCancel={() => setEnroll(null)}
        onSaved={() => { setEnroll(null); load(); }}
      />
    );
  }

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-people-group"></i> Farmer Profiling (RSBSA)</h2>
        <div className="head-actions">
          <div className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, location, or RSBSA number…" /></div>
          <button className="btn-primary" onClick={() => setEnroll({ farmer: null })}><i className="fa-solid fa-user-plus"></i> Add Farmer</button>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Add Farmer opens the official RSBSA Enrollment Form (2 long bond sheets: Parts 1–2, then Parts 3–4).</p>

      <div className="farmer-grid">
        {filtered.length === 0 && <p className="hint-text">No farmers found.</p>}
        {filtered.map((f) => (
          <div className="farmer-card" key={f.id}>
            <img src={f.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(f.avatar_seed || f.full_name)}&backgroundColor=b6e3b6`} alt={fullNameOf(f)} />
            <h4>{fullNameOf(f)}</h4>
            <p className="f-loc">{f.barangay || f.location || "—"}</p>
            <p style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>{f.rsbsa_number ? `RSBSA# ${f.rsbsa_number}` : "No RSBSA number yet"}</p>
            <p style={{ fontSize: ".72rem", margin: "6px 0" }}><b>{Number(f.total_verified_yield).toLocaleString()} kg</b> verified yield</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setDetailRow(f)}><i className="fa-solid fa-eye"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setEnroll({ farmer: f })}><i className="fa-solid fa-pen"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setRsbsaRow(f)}><i className="fa-solid fa-file-lines"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => toggleValidate(f)}><i className={`fa-solid ${f.validated ? "fa-user-xmark" : "fa-user-check"}`}></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => remove(f)}><i className="fa-solid fa-trash"></i></button>
            </div>
            <span className={`status-badge ${f.validated ? "status-resolved" : "status-pending"}`} style={{ marginTop: 8, display: "inline-block" }}>{f.validated ? "Validated" : "Pending"}</span>
          </div>
        ))}
      </div>

      {/* VIEW DETAILS MODAL */}
      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title={detailRow ? fullNameOf(detailRow) : ""} icon="fa-id-card" wide>
        {detailRow && (
          <div className="modal-body">
            <ul className="detail-list">
              <li><span>Email</span><b>{detailRow.email}</b></li>
              <li><span>Mobile</span><b>{detailRow.mobile_number || "—"}</b></li>
              <li><span>Sex / Civil Status</span><b>{detailRow.sex || "—"} / {detailRow.civil_status || "—"}</b></li>
              <li><span>Date of Birth</span><b>{detailRow.date_of_birth || "—"}</b></li>
              <li><span>Address</span><b>{[detailRow.house_no_purok, detailRow.street_sitio_subdivision, detailRow.barangay, detailRow.city_municipality, detailRow.province].filter(Boolean).join(", ") || "—"}</b></li>
              <li><span>RSBSA Number</span><b>{detailRow.rsbsa_number || "Not yet issued"}</b></li>
              <li><span>Crops</span><b>{(detailRow.crops || []).join(", ") || "—"}</b></li>
              <li><span>Total Parcel Area</span><b>{detailRow.farm_size ? `${detailRow.farm_size} ha` : "—"}</b></li>
              <li><span>Association</span><b>{detailRow.association_name || "Not a member"}</b></li>
              <li><span>Total Verified Yield</span><b>{Number(detailRow.total_verified_yield).toLocaleString()} kg</b></li>
              <li><span>Validation</span><b>{detailRow.validated ? "Validated" : "Pending"}</b></li>
              <li><span>Consent on File</span><b>{detailRow.consent_given ? `Yes (${detailRow.consent_date})` : "Not yet recorded"}</b></li>
            </ul>
            <div className="modal-actions"><button className="btn-primary" onClick={() => { setDetailRow(null); setRsbsaRow(detailRow); }}><i className="fa-solid fa-file-lines"></i> View / Print RSBSA Form</button></div>
          </div>
        )}
      </Modal>
    </section>
  );
}
