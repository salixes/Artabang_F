import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import {
  CROP_LIST, SEX_OPTIONS, CIVIL_STATUS_OPTIONS, EDUCATION_OPTIONS,
  PROOF_OF_IDENTITY_OPTIONS, FARM_TYPE_OPTIONS, OWNERSHIP_TENURE_OPTIONS,
  DEFAULT_REGION, DEFAULT_PROVINCE, DEFAULT_CITY_MUNICIPALITY, DEFAULT_BARANGAY,
} from "../../lib/businessRules";
import RsbsaForm from "./RsbsaForm.jsx";

const emptyAdd = {
  // account
  email: "", password: "",
  // Part 1: Personal Information
  surname: "", first_name: "", middle_name: "", extension_name: "",
  sex: "Male", date_of_birth: "", place_of_birth: "", mobile_number: "",
  mothers_maiden_name: "", civil_status: "Single", spouse_name: "", religion: "",
  house_no_purok: "", street_sitio_subdivision: "", barangay: DEFAULT_BARANGAY,
  city_municipality: DEFAULT_CITY_MUNICIPALITY, province: DEFAULT_PROVINCE, region: DEFAULT_REGION,
  highest_formal_education: EDUCATION_OPTIONS[0], proof_of_identity: PROOF_OF_IDENTITY_OPTIONS[0],
  id_document_number: "", rsbsa_number: "",
  is_icc_ip: false, is_pwd: false, is_4ps_beneficiary: false,
  is_association_member: false, association_id: "",
  // Part 2: Livelihood Profile
  is_farmer: true, is_farmworker: false, is_fisherfolk: false, is_agri_youth: false,
  // Part 3: Farm Parcel Information
  farm_location: "", farm_size: "", farm_type: FARM_TYPE_OPTIONS[0],
  within_ancestral_domain: false, agrarian_reform_beneficiary: false, organic_agriculture_practitioner: false,
  ownership_tenure_type: OWNERSHIP_TENURE_OPTIONS[0], land_owner_name: "",
  cropping_schedule: "", commodity: "", commodity_size: "", no_of_heads_trees: "",
  crops: [],
  // Part 4: Consent
  consent_given: false, consent_date: "",
};

function fullNameOf(f) {
  return [f.surname, f.first_name, f.middle_name, f.extension_name].filter(Boolean).join(", ") || f.full_name;
}

export default function AdminFarmers() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdd);
  const [saving, setSaving] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState(null);
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

  const [addError, setAddError] = useState("");

  // supabase-js returns { data: null, error } on any non-2xx response from
  // an Edge Function — the JSON body with our actual error message lives on
  // error.context (the raw Response), not on `data`. Reading only `data?.error`
  // (as the previous version did) silently loses that detail and shows a
  // generic "non-2xx status code" message instead of the real reason.
  async function extractFunctionError(error, data) {
    if (data?.error) return data.error;
    if (!error) return "Unknown error.";
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        if (body?.error) return body.error;
      }
    } catch (_) { /* body wasn't JSON — fall through to error.message */ }
    if (/failed to fetch|networkerror|load failed/i.test(error.message || "")) {
      return "Could not reach the admin-create-user Edge Function. Has it been deployed? Run: supabase functions deploy admin-create-user";
    }
    return error.message || "Something went wrong.";
  }

  async function submitAdd(e) {
    e.preventDefault();
    setSaving(true);
    setAddError("");
    const full_name = [addForm.first_name, addForm.middle_name, addForm.surname, addForm.extension_name].filter(Boolean).join(" ");
    let data, error;
    try {
      ({ data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { ...addForm, full_name, role: "farmer", location: addForm.farm_location || addForm.house_no_purok, contact_number: addForm.mobile_number },
      }));
    } catch (err) {
      error = err;
    }
    setSaving(false);
    if (error || data?.error) {
      const msg = await extractFunctionError(error, data);
      console.error("admin-create-user failed:", { error, data });
      setAddError(msg);
      showToast(msg, "fa-triangle-exclamation");
      return;
    }
    showToast("Farmer enrolled (RSBSA record created).", "fa-user-plus");
    setAddOpen(false);
    setAddForm(emptyAdd);
    load();
  }

  function openEdit(row) {
    setEditRow(row);
    const sanitized = {};
    Object.keys(row).forEach((k) => { sanitized[k] = row[k] === null ? "" : row[k]; });
    setEditForm({ ...emptyAdd, ...sanitized, crops: row.crops || [], association_id: associations.find((a) => a.name === row.association_name)?.id || "" });
  }

  async function submitEdit(e) {
    e.preventDefault();
    setSaving(true);
    const { crops, email, password, ...farmerFields } = editForm;
    delete farmerFields.id; delete farmerFields.full_name; delete farmerFields.association_name;
    delete farmerFields.total_verified_yield; delete farmerFields.avatar_seed; delete farmerFields.contact_number;
    // Blank strings must become null, not "" — several optional fields
    // (rsbsa_number in particular) are UNIQUE, and unlike NULL, two blank
    // "" values collide on that constraint.
    Object.keys(farmerFields).forEach((k) => {
      if (farmerFields[k] === "") farmerFields[k] = null;
    });
    farmerFields.association_id = farmerFields.association_id || null;
    const { error } = await supabase.from("farmers").update({ ...farmerFields, updated_at: new Date().toISOString() }).eq("id", editRow.id);
    if (!error) {
      await supabase.from("farmer_crops").delete().eq("farmer_id", editRow.id);
      if (crops.length) await supabase.from("farmer_crops").insert(crops.map((c) => ({ farmer_id: editRow.id, crop_name: c })));
    }
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Farmer record updated.", "fa-floppy-disk");
    setEditRow(null);
    load();
  }

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

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-people-group"></i> Farmer Profiling (RSBSA)</h2>
        <div className="head-actions">
          <div className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, location, or RSBSA number…" /></div>
          <button className="btn-primary" onClick={() => setAddOpen(true)}><i className="fa-solid fa-user-plus"></i> Add Farmer</button>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Enrolls a farmer using the official RSBSA (Registry System for Basic Sectors in Agriculture) form fields.</p>

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
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => openEdit(f)}><i className="fa-solid fa-pen"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setRsbsaRow(f)}><i className="fa-solid fa-file-lines"></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => toggleValidate(f)}><i className={`fa-solid ${f.validated ? "fa-user-xmark" : "fa-user-check"}`}></i></button>
              <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => remove(f)}><i className="fa-solid fa-trash"></i></button>
            </div>
            <span className={`status-badge ${f.validated ? "status-resolved" : "status-pending"}`} style={{ marginTop: 8, display: "inline-block" }}>{f.validated ? "Validated" : "Pending"}</span>
          </div>
        ))}
      </div>

      {/* ADD FARMER MODAL */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setAddError(""); }} title="Add Farmer — RSBSA Enrollment" icon="fa-user-plus" wide>
        <form className="modal-body rsbsa-form" onSubmit={submitAdd}>
          {addError && (
            <div className="hint-text" style={{ color: "var(--danger)", background: "var(--cream)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px" }}>
              <i className="fa-solid fa-triangle-exclamation"></i> {addError}
            </div>
          )}
          <fieldset className="rsbsa-fieldset">
            <legend>Account</legend>
            <div className="rsbsa-grid">
              <label>Email <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} required /></label>
              <label>Temporary Password <input type="text" minLength={6} value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} required /></label>
            </div>
          </fieldset>
          <PersonalInfoFields f={addForm} set={setAddForm} associations={associations} />
          <LivelihoodFields f={addForm} set={setAddForm} />
          <ParcelFields f={addForm} set={setAddForm} />
          <ConsentFields f={addForm} set={setAddForm} />
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Creating…" : <><i className="fa-solid fa-floppy-disk"></i> Enroll Farmer</>}</button></div>
        </form>
      </Modal>

      {/* EDIT FARMER MODAL */}
      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit — ${editRow ? fullNameOf(editRow) : ""}`} icon="fa-pen" wide>
        {editForm && (
          <form className="modal-body rsbsa-form" onSubmit={submitEdit}>
            <PersonalInfoFields f={editForm} set={setEditForm} associations={associations} />
            <LivelihoodFields f={editForm} set={setEditForm} />
            <ParcelFields f={editForm} set={setEditForm} />
            <ConsentFields f={editForm} set={setEditForm} />
            <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setEditRow(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : <><i className="fa-solid fa-floppy-disk"></i> Save Changes</>}</button></div>
          </form>
        )}
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

// Defined at module scope (not inside AdminFarmers) so React treats them as
// stable component types across renders — defining them inside the parent's
// render body recreated a new function identity on every keystroke, which
// made React unmount/remount the fields and drop input focus after every
// single character typed.
function PersonalInfoFields({ f, set, associations }) {
  return (
    <fieldset className="rsbsa-fieldset">
      <legend>Part 1: Personal Information</legend>
      <div className="rsbsa-grid">
        <label>Surname <input value={f.surname} onChange={(e) => set({ ...f, surname: e.target.value })} required /></label>
        <label>First Name <input value={f.first_name} onChange={(e) => set({ ...f, first_name: e.target.value })} required /></label>
        <label>Middle Name <input value={f.middle_name} onChange={(e) => set({ ...f, middle_name: e.target.value })} /></label>
        <label>Extension Name <input value={f.extension_name} onChange={(e) => set({ ...f, extension_name: e.target.value })} placeholder="Jr., Sr., III" /></label>
        <label>Sex <select value={f.sex} onChange={(e) => set({ ...f, sex: e.target.value })}>{SEX_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>Date of Birth <input type="date" value={f.date_of_birth || ""} onChange={(e) => set({ ...f, date_of_birth: e.target.value })} /></label>
        <label>Place of Birth <input value={f.place_of_birth} onChange={(e) => set({ ...f, place_of_birth: e.target.value })} /></label>
        <label>Mobile Number <input value={f.mobile_number} onChange={(e) => set({ ...f, mobile_number: e.target.value })} placeholder="09XX-XXX-XXXX" /></label>
        <label>Mother's Maiden Name <input value={f.mothers_maiden_name} onChange={(e) => set({ ...f, mothers_maiden_name: e.target.value })} /></label>
        <label>Civil Status <select value={f.civil_status} onChange={(e) => set({ ...f, civil_status: e.target.value })}>{CIVIL_STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>Name of Spouse <input value={f.spouse_name} onChange={(e) => set({ ...f, spouse_name: e.target.value })} /></label>
        <label>Religion <input value={f.religion} onChange={(e) => set({ ...f, religion: e.target.value })} /></label>
      </div>
      <p className="rsbsa-subhead">Permanent Address</p>
      <div className="rsbsa-grid">
        <label>House No./Purok <input value={f.house_no_purok} onChange={(e) => set({ ...f, house_no_purok: e.target.value })} /></label>
        <label>Street/Sitio/Subdivision <input value={f.street_sitio_subdivision} onChange={(e) => set({ ...f, street_sitio_subdivision: e.target.value })} /></label>
        <label>Barangay <input value={f.barangay} onChange={(e) => set({ ...f, barangay: e.target.value })} /></label>
        <label>City/Municipality <input value={f.city_municipality} onChange={(e) => set({ ...f, city_municipality: e.target.value })} /></label>
        <label>Province <input value={f.province} onChange={(e) => set({ ...f, province: e.target.value })} /></label>
        <label>Region <input value={f.region} onChange={(e) => set({ ...f, region: e.target.value })} /></label>
      </div>
      <div className="rsbsa-grid">
        <label>Highest Formal Education <select value={f.highest_formal_education} onChange={(e) => set({ ...f, highest_formal_education: e.target.value })}>{EDUCATION_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>Submitted Proof of Identity <select value={f.proof_of_identity} onChange={(e) => set({ ...f, proof_of_identity: e.target.value })}>{PROOF_OF_IDENTITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>ID/Document Number <input value={f.id_document_number} onChange={(e) => set({ ...f, id_document_number: e.target.value })} /></label>
        <label>RSBSA Number <input value={f.rsbsa_number} onChange={(e) => set({ ...f, rsbsa_number: e.target.value })} placeholder="Leave blank if not yet issued" /></label>
      </div>
      <div className="rsbsa-checks">
        <label className="rsbsa-check"><input type="checkbox" checked={f.is_icc_ip} onChange={(e) => set({ ...f, is_icc_ip: e.target.checked })} /> Part of ICC/IP?</label>
        <label className="rsbsa-check"><input type="checkbox" checked={f.is_pwd} onChange={(e) => set({ ...f, is_pwd: e.target.checked })} /> Person with Disability (PWD)?</label>
        <label className="rsbsa-check"><input type="checkbox" checked={f.is_4ps_beneficiary} onChange={(e) => set({ ...f, is_4ps_beneficiary: e.target.checked })} /> 4Ps Beneficiary?</label>
      </div>
      <div className="rsbsa-grid">
        <label>Membership in Farmers/Fisherfolk Association?
          <select value={f.is_association_member ? "yes" : "no"} onChange={(e) => set({ ...f, is_association_member: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></select>
        </label>
        {f.is_association_member && (
          <label>Association <select value={f.association_id} onChange={(e) => set({ ...f, association_id: e.target.value })}>
            <option value="">Select…</option>{associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>
        )}
      </div>
    </fieldset>
  );
}

function LivelihoodFields({ f, set }) {
  return (
    <fieldset className="rsbsa-fieldset">
      <legend>Part 2: Livelihood Profile</legend>
      <div className="rsbsa-checks">
        <label className="rsbsa-check"><input type="checkbox" checked={f.is_farmer} onChange={(e) => set({ ...f, is_farmer: e.target.checked })} /> Farmer</label>
        <label className="rsbsa-check"><input type="checkbox" checked={f.is_farmworker} onChange={(e) => set({ ...f, is_farmworker: e.target.checked })} /> Farm Worker</label>
        <label className="rsbsa-check"><input type="checkbox" checked={f.is_fisherfolk} onChange={(e) => set({ ...f, is_fisherfolk: e.target.checked })} /> Fisher</label>
        <label className="rsbsa-check"><input type="checkbox" checked={f.is_agri_youth} onChange={(e) => set({ ...f, is_agri_youth: e.target.checked })} /> Agri-Youth</label>
      </div>
    </fieldset>
  );
}

function ParcelFields({ f, set }) {
  return (
    <fieldset className="rsbsa-fieldset">
      <legend>Part 3: Farm Parcel Information</legend>
      <div className="rsbsa-grid">
        <label>Farm Location <input value={f.farm_location} onChange={(e) => set({ ...f, farm_location: e.target.value })} /></label>
        <label>Total Parcel Area (ha) <input type="number" step="0.1" value={f.farm_size} onChange={(e) => set({ ...f, farm_size: e.target.value })} /></label>
        <label>Farm Type <select value={f.farm_type} onChange={(e) => set({ ...f, farm_type: e.target.value })}>{FARM_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>Type of Ownership/Tenure <select value={f.ownership_tenure_type} onChange={(e) => set({ ...f, ownership_tenure_type: e.target.value })}>{OWNERSHIP_TENURE_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label>Name of Land Owner (if not registered owner) <input value={f.land_owner_name} onChange={(e) => set({ ...f, land_owner_name: e.target.value })} /></label>
        <label>Cropping Schedule <input value={f.cropping_schedule} onChange={(e) => set({ ...f, cropping_schedule: e.target.value })} placeholder="e.g. Year-round" /></label>
        <label>Commodity <input value={f.commodity} onChange={(e) => set({ ...f, commodity: e.target.value })} placeholder="e.g. Rice, Cassava" /></label>
        <label>Size (ha) <input type="number" step="0.1" value={f.commodity_size} onChange={(e) => set({ ...f, commodity_size: e.target.value })} /></label>
        <label>No. of Heads/Trees <input value={f.no_of_heads_trees} onChange={(e) => set({ ...f, no_of_heads_trees: e.target.value })} /></label>
      </div>
      <div className="rsbsa-checks">
        <label className="rsbsa-check"><input type="checkbox" checked={f.within_ancestral_domain} onChange={(e) => set({ ...f, within_ancestral_domain: e.target.checked })} /> Within Ancestral Domain?</label>
        <label className="rsbsa-check"><input type="checkbox" checked={f.agrarian_reform_beneficiary} onChange={(e) => set({ ...f, agrarian_reform_beneficiary: e.target.checked })} /> Agrarian Reform Beneficiary (ARB)?</label>
        <label className="rsbsa-check"><input type="checkbox" checked={f.organic_agriculture_practitioner} onChange={(e) => set({ ...f, organic_agriculture_practitioner: e.target.checked })} /> Organic Agriculture?</label>
      </div>
      <label>Plants Grown (for Crop Registration / Insurance modules)
        <select multiple size={5} value={f.crops} onChange={(e) => set({ ...f, crops: Array.from(e.target.selectedOptions, (o) => o.value) })}>
          {CROP_LIST.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
    </fieldset>
  );
}

function ConsentFields({ f, set }) {
  return (
    <fieldset className="rsbsa-fieldset">
      <legend>Part 4: Consent Form and Data Privacy Notice</legend>
      <p className="hint-text">I hereby declare that all information indicated in this form are true, correct, and complete, and that they may be used by the Department of Agriculture for the purposes of registration to the RSBSA and other legitimate purposes the Department may deem necessary.</p>
      <div className="rsbsa-checks">
        <label className="rsbsa-check"><input type="checkbox" checked={f.consent_given} onChange={(e) => set({ ...f, consent_given: e.target.checked, consent_date: e.target.checked ? (f.consent_date || new Date().toISOString().slice(0, 10)) : "" })} /> Consent recorded (signature/thumbmark obtained on printed form)</label>
      </div>
      {f.consent_given && <label style={{ maxWidth: 220 }}>Date Signed <input type="date" value={f.consent_date} onChange={(e) => set({ ...f, consent_date: e.target.value })} /></label>}
    </fieldset>
  );
}
