import React, { useEffect, useState } from "react";
import Avatar from "../../components/Avatar.jsx";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import PhoneInput, { phoneError, phoneDigits } from "../../components/PhoneInput.jsx";
import { tr } from "../../lib/i18n";

export default function FarmerProfile() {
  const { farmer, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [directoryRow, setDirectoryRow] = useState(null);
  const [associations, setAssociations] = useState([]);   // LIFA, Lindasan

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [passOpen, setPassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [passSaving, setPassSaving] = useState(false);

  async function load() {
    if (!farmer?.id) return;
    const { data } = await supabase.from("farmer_directory").select("*").eq("id", farmer.id).single();
    setDirectoryRow(data);
    const { data: assoc } = await supabase.from("associations").select("id, name").order("name");
    setAssociations(assoc || []);
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
      association_id: directoryRow.association_id || "",
    });
    setPhotoFile(null);
    setEditOpen(true);
  }

  async function submitEdit(e) {
    e.preventDefault();
    const phoneMsg = phoneError(editForm.contact_number, { required: true });
    if (phoneMsg) return showToast(phoneMsg, "fa-triangle-exclamation");
    if (editForm.is_association_member && !editForm.association_id) return showToast("Please choose which association you belong to.", "fa-triangle-exclamation");
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
        contact_number: phoneDigits(editForm.contact_number), updated_at: new Date().toISOString(),
      }).eq("id", farmer.id);
      if (profErr) throw profErr;

      const { error: farmErr } = await supabase.from("farmers").update({
        location: editForm.location, farm_size: editForm.farm_size ? Number(editForm.farm_size) : null,
        is_association_member: editForm.is_association_member, association_id: editForm.is_association_member ? editForm.association_id : null, photo_url, updated_at: new Date().toISOString(),
      }).eq("id", farmer.id);
      if (farmErr) throw farmErr;

      logActivity("Updated profile information", "profile");
      showToast(tr("Profile updated."), "fa-circle-check");
      setEditOpen(false);
      await load();
      await refreshProfile();
    } catch (err) {
      showToast(err.message || "Unable to update profile.", "fa-triangle-exclamation");
    } finally {
      setSaving(false);
    }
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
    logActivity("Changed password", "security");
    showToast(tr("Password changed."), "fa-key");
    setPassOpen(false);
    setNewPassword(""); setConfirmPassword("");
  }

  if (!directoryRow) return <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> {tr("Loading profile…")}</p>;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-id-card"></i> {tr("My Profile")}</h2>
        <div className="head-actions">
          <button className="btn-ghost" onClick={() => setPassOpen(true)}><i className="fa-solid fa-key"></i> {tr("Change Password")}</button>
          <button className="btn-primary" onClick={openEdit}><i className="fa-solid fa-pen"></i> {tr("Edit Profile")}</button>
        </div>
      </div>

      {!directoryRow.photo_url && (
        <div className="profile-photo-note warn"><i className="fa-solid fa-triangle-exclamation"></i> {tr("No profile photo uploaded — required to qualify for any assistance. Please update it.")}</div>
      )}

      <div className="profile-center-wrap">
        <div className="panel">
          <div className="profile-center-header">
            <Avatar src={directoryRow.photo_url} name={directoryRow.full_name} size={110} onClick={openEdit} />
            <div><p style={{ fontWeight: 600, fontSize: "1.1rem" }}>{directoryRow.full_name}</p><p className="hint-text">{directoryRow.email}</p></div>
          </div>
          <ul className="detail-list">
            <li><span>{tr("Contact Number")}</span><b>{profile.contact_number || "—"}</b></li>
            <li><span>{tr("Location")}</span><b>{directoryRow.location || "—"}</b></li>
            <li><span>{tr("Farm Size")}</span><b>{directoryRow.farm_size ? `${directoryRow.farm_size} ha` : "—"}</b></li>
            <li><span>{tr("Association")}</span><b>{directoryRow.is_association_member ? (directoryRow.association_name || "Member") : "Not a member"}</b></li>
            <li><span>{tr("Last Updated")}</span><b>{new Date(directoryRow.updated_at).toLocaleString("en-PH")}</b></li>
          </ul>

          <div className="rsbsa-subhead"><span>{tr("Plants Grown")}</span></div>
          <p style={{ padding: "0 4px", fontSize: ".85rem" }}>{(directoryRow.crops || []).join(", ") || "—"}</p>
          <p className="hint-text" style={{ padding: "0 4px" }}><i className="fa-solid fa-circle-info"></i> <span>{tr("To add a crop or correct one, go to")} <b>{tr("Crop Registration")}</b>.</span></p>
        </div>
      </div>

      {/* EDIT PROFILE (direct, no approval) */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={tr("Edit My Profile")} icon="fa-id-card">
        {editForm && (
          <form className="modal-body" onSubmit={submitEdit}>
            <label>{tr("Profile Photo")} <span className="req-note">{tr("(required for assistance qualification)")}</span>
              <div className="photo-upload-row">
                <img src={photoFile ? URL.createObjectURL(photoFile) : (directoryRow.photo_url || "")} alt={tr("preview")} className="photo-preview" />
                <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </div>
            </label>
            <label>{tr("Contact Number")} <PhoneInput value={editForm.contact_number} onChange={(v) => setEditForm({ ...editForm, contact_number: v })} placeholder={tr("09XXXXXXXXX")} required /></label>
            <label>{tr("Location (Purok)")} <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} required /></label>
            <label>{tr("Farm Size (hectares)")} <input type="number" min="0.1" step="0.1" value={editForm.farm_size} onChange={(e) => setEditForm({ ...editForm, farm_size: e.target.value })} required /></label>
            <label>{tr("Farmers Association Member?")} <select value={editForm.is_association_member ? "yes" : "no"} onChange={(e) => setEditForm({ ...editForm, is_association_member: e.target.value === "yes", association_id: e.target.value === "yes" ? editForm.association_id : "" })}><option value="no">{tr("No")}</option><option value="yes">{tr("Yes")}</option></select></label>
            {editForm.is_association_member && (
              <label>{tr("Which association?")}
                <select value={editForm.association_id} onChange={(e) => setEditForm({ ...editForm, association_id: e.target.value })} required>
                  <option value="">{tr("Choose your association…")}</option>
                  {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>{tr("Cancel")}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : <><i className="fa-solid fa-floppy-disk"></i> {tr("Save")}</>}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* CHANGE PASSWORD (direct, no approval) */}
      <Modal open={passOpen} onClose={() => setPassOpen(false)} title={tr("Change Password")} icon="fa-key">
        <form className="modal-body" onSubmit={submitPassword}>
          {passError && <div className="hint-text" style={{ color: "var(--danger)", background: "var(--cream)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px" }}><i className="fa-solid fa-triangle-exclamation"></i> {passError}</div>}
          <label>{tr("New Password")} <input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
          <label>{tr("Confirm New Password")} <input type="password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setPassOpen(false)}>{tr("Cancel")}</button>
              <button type="submit" className="btn-primary" disabled={passSaving}>
                {passSaving ? "Saving…" : (<><i className="fa-solid fa-key"></i> {tr("Update Password")}</>)}
              </button>
            </div>
        </form>
      </Modal>
    </section>
  );
}
