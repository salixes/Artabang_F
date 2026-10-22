import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import Avatar from "../../components/Avatar.jsx";
import RsbsaForm from "./RsbsaForm.jsx";
import RsbsaEnroll from "./RsbsaEnroll.jsx";

function fullNameOf(f) {
  return [f.surname, f.first_name, f.middle_name, f.extension_name].filter(Boolean).join(", ") || f.full_name;
}

export default function AdminFarmers() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [searchParams] = useSearchParams();
  // opened from the top search bar: /admin/farmers?q=<name>
  const [search, setSearch] = useState(searchParams.get("q") || "");
  useEffect(() => { const q = searchParams.get("q"); if (q !== null) setSearch(q); }, [searchParams]);
  // null = list | { farmer: null } = new enrollment | { farmer: row } = edit
  const [enroll, setEnroll] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [rsbsaRow, setRsbsaRow] = useState(null);
  // the crops this farmer registered (live from Crop Registration, so approved changes always show)
  const [detailCrops, setDetailCrops] = useState([]);
  useEffect(() => {
    if (!detailRow) { setDetailCrops([]); return undefined; }
    let off = false;
    supabase.from("crop_registrations").select("id, crop_name, area, planting_date, variety, land_category, tenurial_status, status").eq("farmer_id", detailRow.id).order("registered_at", { ascending: false })
      .then(({ data }) => { if (!off) setDetailCrops(data || []); });
    return () => { off = true; };
  }, [detailRow]);
  // "Create account only": no form now, the farmer fills out the RSBSA form in their own account
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState({ full_name: "", email: "", password: "", contact_number: "" });
  const [quickBusy, setQuickBusy] = useState(false);

  async function createQuick(e) {
    e.preventDefault();
    if (quick.password.length < 6) return showToast("Temporary password must be at least 6 characters.", "fa-triangle-exclamation");
    setQuickBusy(true);
    let data, error;
    try {
      ({ data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { full_name: quick.full_name.trim(), email: quick.email.trim(), password: quick.password, role: "farmer", contact_number: quick.contact_number.trim() || null },
      }));
    } catch (err) { error = err; }
    setQuickBusy(false);
    if (error || data?.error) return showToast(data?.error || error?.message || "Could not create the account.", "fa-triangle-exclamation");
    logActivity(`Created farmer account for ${quick.full_name.trim()} (RSBSA form to be filled by the farmer)`, "farmer");
    showToast("Account created. Give the farmer the e-mail and temporary password.", "fa-user-plus");
    setQuickOpen(false);
    setQuick({ full_name: "", email: "", password: "", contact_number: "" });
    load();
  }

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

  async function remove(row) {
    if (!confirm(`Permanently delete ${fullNameOf(row)}'s account? This cannot be undone.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: row.id } });
    if (error || data?.error) return showToast(data?.error || error.message, "fa-triangle-exclamation");
    logActivity(`Deleted farmer account of ${fullNameOf(row)}`, "farmer");
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
          <button className="btn-ghost" onClick={() => setQuickOpen(true)}><i className="fa-solid fa-user-plus"></i> Create Account Only</button>
          <button className="btn-primary" onClick={() => setEnroll({ farmer: null })}><i className="fa-solid fa-file-pen"></i> Add Farmer (fill RSBSA form)</button>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> <span>Two ways to enroll a new farmer: <b>Add Farmer</b> opens the official RSBSA Enrollment Form for you to fill out (for farmers who did not bring a phone). <b>Create Account Only</b> makes just the login. The farmer then fills out and signs the form in their own account, and you validate it in RSBSA Validation.</span></p>

      <div className="farmer-grid">
        {filtered.length === 0 && <p className="hint-text">No farmers found.</p>}
        {filtered.map((f) => (
          <div className="farmer-card" key={f.id}>
            <Avatar src={f.photo_url} name={fullNameOf(f)} size={66} border="2px solid var(--sage-pale)" style={{ margin: "0 auto 10px" }} />
            <h4>{fullNameOf(f)}</h4>
            <p className="f-loc">{f.barangay || f.location || "—"}</p>
            <p style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>{f.rsbsa_number ? `RSBSA# ${f.rsbsa_number}` : "No RSBSA number yet"}</p>
            <p style={{ fontSize: ".72rem", margin: "6px 0" }}><b>{Number(f.total_verified_yield).toLocaleString()} kg</b> verified yield</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setDetailRow(f)}><i className="fa-solid fa-eye"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setEnroll({ farmer: f })}><i className="fa-solid fa-pen"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setRsbsaRow(f)}><i className="fa-solid fa-file-lines"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => remove(f)}><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE ACCOUNT ONLY */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Create farmer account" icon="fa-user-plus">
        <form className="modal-body" onSubmit={createQuick}>
          <p className="hint-text" style={{ margin: 0 }}><i className="fa-solid fa-circle-info"></i> <span>This only creates the login. The farmer signs in, fills out and signs the RSBSA Enrollment Form, and you validate it in <b>RSBSA Validation</b>.</span></p>
          <label>Full name <input value={quick.full_name} onChange={(e) => setQuick({ ...quick, full_name: e.target.value })} required /></label>
          <label>Login e-mail <input type="email" value={quick.email} onChange={(e) => setQuick({ ...quick, email: e.target.value })} required autoComplete="off" /></label>
          <label>Temporary password <input type="text" minLength={6} value={quick.password} onChange={(e) => setQuick({ ...quick, password: e.target.value })} required autoComplete="off" /></label>
          <label>Contact number (optional) <input value={quick.contact_number} onChange={(e) => setQuick({ ...quick, contact_number: e.target.value })} placeholder="09XX-XXX-XXXX" /></label>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setQuickOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={quickBusy}>{quickBusy ? "Creating…" : "Create account"}</button>
          </div>
        </form>
      </Modal>

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
              <li><span>Consent on File</span><b>{detailRow.consent_given ? `Yes (${detailRow.consent_date})` : "Not yet recorded"}</b></li>
            </ul>
            <div className="rsbsa-subhead"><span>Registered crops</span></div>
            <div className="table-panel" style={{ boxShadow: "none" }}>
              <table className="data-table">
                <thead><tr><th>Crop</th><th>Area (ha)</th><th>Planting date</th><th>Variety</th><th>Land / Tenure</th><th>Status</th></tr></thead>
                <tbody>
                  {detailCrops.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No registered crops yet.</td></tr>}
                  {detailCrops.map((c) => (
                    <tr key={c.id}><td>{c.crop_name}</td><td>{c.area}</td><td>{c.planting_date || "—"}</td><td>{c.variety || "—"}</td><td>{[c.land_category, c.tenurial_status].filter(Boolean).join(" · ") || "—"}</td><td>{c.status}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions"><button className="btn-primary" onClick={() => { setDetailRow(null); setRsbsaRow(detailRow); }}><i className="fa-solid fa-file-lines"></i> View / Print RSBSA Form</button></div>
          </div>
        )}
      </Modal>
    </section>
  );
}
