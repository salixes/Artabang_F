import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { CROP_LIST } from "../../lib/businessRules";

export default function FarmerProfile() {
  const { farmer, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [directoryRow, setDirectoryRow] = useState(null);
  const [pendingCropRequest, setPendingCropRequest] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [cropsOpen, setCropsOpen] = useState(false);
  const [cropsForm, setCropsForm] = useState([]);
  const [cropsSaving, setCropsSaving] = useState(false);

  const [passOpen, setPassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [passSaving, setPassSaving] = useState(false);

  async function load() {
    if (!farmer?.id) return;
    const { data } = await supabase.from("farmer_directory").select("*").eq("id", farmer.id).single();
    setDirectoryRow(data);
    const { data: pending } = await supabase
      .from("crop_change_requests").select("*").eq("farmer_id", farmer.id).eq("status", "Pending")
      .order("requested_at", { ascending: false }).limit(1).maybeSingle();
    setPendingCropRequest(pending || null);
  }
  useEffect(() => { load(); }, [farmer?.id]);

  // ---- Direct profile edit (personal/farm info + photo — no approval needed) ----
  function openEdit() {
    if (!directoryRow) return;
    setEditForm({
      contact_number: profile.contact_number || "",
      location: directoryRow.location || "",
      farm_size: directoryRow.farm_size || "",
      is_association_member: directoryRow.is_association_member,
    });
    setPhotoFile(null);
    setEditOpen(true);
  }

  async function submitEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let photo_url = directoryRow.photo_url;
      if (photoFile) {
        const path = `${farmer.id}/${Date.now()}-${photoFile.name}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, photoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        photo_url = pub.publicUrl;
      }

      const { error: profErr } = await supabase.from("profiles").update({
        contact_number: editForm.contact_number, updated_at: new Date().toISOString(),
      }).eq("id", farmer.id);
      if (profErr) throw profErr;

      const { error: farmErr } = await supabase.from("farmers").update({
        location: editForm.location, farm_size: editForm.farm_size ? Number(editForm.farm_size) : null,
        is_association_member: editForm.is_association_member, photo_url, updated_at: new Date().toISOString(),
      }).eq("id", farmer.id);
      if (farmErr) throw farmErr;

      showToast("Profile updated.", "fa-circle-check");
      setEditOpen(false);
      await load();
      await refreshProfile();
    } catch (err) {
      showToast(err.message || "Unable to update profile.", "fa-triangle-exclamation");
    } finally {
      setSaving(false);
    }
  }

  // ---- Crop change request (needs ADMIN approval before it takes effect) ----
  function openCropsRequest() {
    setCropsForm(directoryRow.crops || []);
    setCropsOpen(true);
  }

  async function submitCropsRequest(e) {
    e.preventDefault();
    setCropsSaving(true);
    const { error } = await supabase.from("crop_change_requests").insert({
      farmer_id: farmer.id, old_crops: directoryRow.crops || [], new_crops: cropsForm,
    });
    setCropsSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Crop change request submitted — awaiting ADMIN review.", "fa-hourglass-half");
    setCropsOpen(false);
    load();
  }

  // ---- Password change (direct via Supabase Auth — never needs approval) ----
  async function submitPassword(e) {
    e.preventDefault();
    setPassError("");
    if (newPassword.length < 6) return setPassError("Password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setPassError("Passwords do not match.");
    setPassSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPassSaving(false);
    if (error) return setPassError(error.message);
    showToast("Password changed.", "fa-key");
    setPassOpen(false);
    setNewPassword(""); setConfirmPassword("");
  }

  if (!directoryRow) return <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> Loading profile…</p>;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-id-card"></i> My Profile</h2>
        <div className="head-actions">
          <button className="btn-ghost" onClick={() => setPassOpen(true)}><i className="fa-solid fa-key"></i> Change Password</button>
          <button className="btn-primary" onClick={openEdit}><i className="fa-solid fa-pen"></i> Edit Profile</button>
        </div>
      </div>

      {!directoryRow.photo_url && (
        <div className="profile-photo-note warn"><i className="fa-solid fa-triangle-exclamation"></i> No profile photo uploaded — required to qualify for any assistance. Please update it.</div>
      )}

      <div className="profile-center-wrap">
        <div className="panel">
          <div className="profile-center-header">
            <img src={directoryRow.photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(directoryRow.full_name)}&backgroundColor=b6e3b6`} alt="Profile" />
            <div><p style={{ fontWeight: 600, fontSize: "1.1rem" }}>{directoryRow.full_name}</p><p className="hint-text">{directoryRow.email}</p></div>
          </div>
          <ul className="detail-list">
            <li><span>Contact Number</span><b>{profile.contact_number || "—"}</b></li>
            <li><span>Location</span><b>{directoryRow.location || "—"}</b></li>
            <li><span>Farm Size</span><b>{directoryRow.farm_size ? `${directoryRow.farm_size} ha` : "—"}</b></li>
            <li><span>Association</span><b>{directoryRow.is_association_member ? (directoryRow.association_name || "Member") : "Not a member"}</b></li>
            <li><span>Validation Status</span><b>{directoryRow.validated ? "Validated" : "Pending Validation"}</b></li>
            <li><span>Last Updated</span><b>{new Date(directoryRow.updated_at).toLocaleString("en-PH")}</b></li>
          </ul>

          <div className="rsbsa-subhead" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Plants Grown</span>
            <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: ".72rem" }} onClick={openCropsRequest}><i className="fa-solid fa-file-circle-plus"></i> Request Change</button>
          </div>
          <p style={{ padding: "0 4px", fontSize: ".85rem" }}>{(directoryRow.crops || []).join(", ") || "—"}</p>
          {pendingCropRequest && (
            <div className="profile-photo-note warn">
              <i className="fa-solid fa-hourglass-half"></i> Crop change request pending ADMIN review: <StatusBadge status={pendingCropRequest.status} /> — proposed: {pendingCropRequest.new_crops.join(", ") || "none"}
            </div>
          )}
        </div>
      </div>

      {/* EDIT PROFILE (direct, no approval) */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit My Profile" icon="fa-id-card">
        {editForm && (
          <form className="modal-body" onSubmit={submitEdit}>
            <label>Profile Photo <span className="req-note">(required for assistance qualification)</span>
              <div className="photo-upload-row">
                <img src={photoFile ? URL.createObjectURL(photoFile) : (directoryRow.photo_url || "")} alt="preview" className="photo-preview" />
                <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </div>
            </label>
            <label>Contact Number <input type="text" value={editForm.contact_number} onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value })} placeholder="09XX-XXX-XXXX" required /></label>
            <label>Location (Purok) <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} required /></label>
            <label>Farm Size (hectares) <input type="number" min="0.1" step="0.1" value={editForm.farm_size} onChange={(e) => setEditForm({ ...editForm, farm_size: e.target.value })} required /></label>
            <label>Farmers Association Member? <select value={editForm.is_association_member ? "yes" : "no"} onChange={(e) => setEditForm({ ...editForm, is_association_member: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></select></label>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : <><i className="fa-solid fa-floppy-disk"></i> Save</>}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* CROP CHANGE REQUEST (gated — needs ADMIN approval) */}
      <Modal open={cropsOpen} onClose={() => setCropsOpen(false)} title="Request Crop Change" icon="fa-file-circle-plus">
        <form className="modal-body" onSubmit={submitCropsRequest}>
          <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Changes to plants grown are important farm information — this will be reviewed by ADMIN before it takes effect.</p>
          <label>Plants Grown (hold Ctrl/Cmd to select multiple)
            <select multiple size={6} value={cropsForm} onChange={(e) => setCropsForm(Array.from(e.target.selectedOptions, (o) => o.value))}>
              {CROP_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setCropsOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={cropsSaving}>{cropsSaving ? "Submitting…" : <><i className="fa-solid fa-paper-plane"></i> Submit for Review</>}</button></div>
        </form>
      </Modal>

      {/* CHANGE PASSWORD (direct, no approval) */}
      <Modal open={passOpen} onClose={() => setPassOpen(false)} title="Change Password" icon="fa-key">
        <form className="modal-body" onSubmit={submitPassword}>
          {passError && <div className="hint-text" style={{ color: "var(--danger)", background: "var(--cream)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px" }}><i className="fa-solid fa-triangle-exclamation"></i> {passError}</div>}
          <label>New Password <input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
          <label>Confirm New Password <input type="password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setPassOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={passSaving}>
                {passSaving ? "Saving…" : (<><i className="fa-solid fa-key"></i> Update Password</>)}
              </button>
            </div>
        </form>
      </Modal>
    </section>
  );
}
