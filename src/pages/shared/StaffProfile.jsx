import React, { useRef, useState } from "react";
import { supabase, supabaseAuthOnly } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Avatar from "../../components/Avatar.jsx";

const MAX_PHOTO = 3 * 1024 * 1024;
const migrationHint = (msg) => (/avatar_url|position|address|birth_date/.test(msg) ? `${msg} — run supabase/migrations/profile_details.sql in the Supabase SQL editor first.` : msg);

// Admin & President profile: photo, personal details, account info and password.
export default function StaffProfile({ roleLabel }) {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "", contact_number: profile?.contact_number || "",
    position: profile?.position || "", birth_date: profile?.birth_date || "", address: profile?.address || "",
  });
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  if (!profile) return null;

  async function saveDetails(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim(), contact_number: form.contact_number.trim() || null,
      position: form.position.trim() || null, birth_date: form.birth_date || null, address: form.address.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id);
    setSaving(false);
    if (error) return showToast(migrationHint(error.message), "fa-triangle-exclamation");
    logActivity("Updated profile information", "profile");
    showToast("Profile updated.", "fa-floppy-disk");
    refreshProfile();
  }

  async function uploadPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Please choose an image file.", "fa-triangle-exclamation");
    if (file.size > MAX_PHOTO) return showToast("The photo must be 3 MB or smaller.", "fa-triangle-exclamation");
    setPhotoBusy(true);
    const path = `${profile.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setPhotoBusy(false); return showToast(upErr.message, "fa-triangle-exclamation"); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setPhotoBusy(false);
    if (error) return showToast(migrationHint(error.message), "fa-triangle-exclamation");
    logActivity("Changed profile photo", "profile");
    showToast("Profile photo updated.", "fa-camera");
    refreshProfile();
  }

  async function removePhoto() {
    if (!confirm("Remove your profile photo?")) return;
    setPhotoBusy(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setPhotoBusy(false);
    if (error) return showToast(migrationHint(error.message), "fa-triangle-exclamation");
    logActivity("Removed profile photo", "profile");
    showToast("Profile photo removed.", "fa-trash");
    refreshProfile();
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pw.next.length < 6) return showToast("The new password must be at least 6 characters.", "fa-triangle-exclamation");
    if (pw.next !== pw.confirm) return showToast("The new passwords do not match.", "fa-triangle-exclamation");
    if (pw.next === pw.current) return showToast("The new password must be different from the current one.", "fa-triangle-exclamation");
    setPwBusy(true);
    // verify the current password on an isolated client so this session is left untouched
    const { error: verifyErr } = await supabaseAuthOnly.auth.signInWithPassword({ email: profile.email, password: pw.current });
    if (verifyErr) { setPwBusy(false); return showToast("The current password is incorrect.", "fa-triangle-exclamation"); }
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwBusy(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    setPw({ current: "", next: "", confirm: "" });
    logActivity("Changed password", "security");
    showToast("Password changed.", "fa-key");
  }

  const memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "—";

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-id-badge"></i> {roleLabel} Profile</h2></div>
      <div className="profile-center-wrap">
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="profile-center-header">
            <Avatar src={profile.avatar_url} name={profile.full_name} size={130} onClick={() => fileRef.current?.click()} />
            <div><p style={{ fontWeight: 600, fontSize: "1.1rem" }}>{profile.full_name}</p>
              {profile.position && <p style={{ fontSize: ".85rem", color: "var(--forest-deep)", fontWeight: 600 }}>{profile.position}</p>}
              <p className="hint-text">{profile.email}</p></div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="profile-center-actions">
              <button type="button" className="btn-primary" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                <i className="fa-solid fa-camera"></i> {photoBusy ? "Uploading…" : profile.avatar_url ? "Change profile" : "Add profile"}
              </button>
              {profile.avatar_url && <button type="button" className="btn-ghost" disabled={photoBusy} onClick={removePhoto}><i className="fa-solid fa-trash"></i> Remove</button>}
            </div>
          </div>
        </div>

        <form className="panel" onSubmit={saveDetails} style={{ marginBottom: 18 }}>
          <div className="panel-head"><h3><i className="fa-solid fa-user-pen"></i> Personal information</h3></div>
          <div className="modal-body">
            <label>Full Name <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
            <label>Position / Designation <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder={roleLabel === "ADMIN" ? "e.g. Municipal Agriculturist" : "e.g. Association President"} /></label>
            <label>Contact Number <input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="09XX-XXX-XXXX" /></label>
            <label>Birth Date <input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></label>
            <label>Address <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Barangay, Municipality, Province" /></label>
            <div className="profile-center-actions">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : <><i className="fa-solid fa-floppy-disk"></i> Save</>}</button>
            </div>
          </div>
        </form>

        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head"><h3><i className="fa-solid fa-shield-halved"></i> Account</h3></div>
          <ul className="detail-list">
            <li><span>Email (login)</span><b>{profile.email}</b></li>
            <li><span>Role</span><b>{roleLabel}</b></li>
            <li><span>Member since</span><b>{memberSince}</b></li>
            <li><span>Last updated</span><b>{profile.updated_at ? new Date(profile.updated_at).toLocaleString("en-PH") : "—"}</b></li>
          </ul>
        </div>

        <form className="panel" onSubmit={changePassword}>
          <div className="panel-head"><h3><i className="fa-solid fa-key"></i> Change password</h3></div>
          <div className="modal-body">
            <label>Current password <input type={showPw ? "text" : "password"} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required /></label>
            <label>New password <input type={showPw ? "text" : "password"} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={6} required /></label>
            <label>Confirm new password <input type={showPw ? "text" : "password"} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" minLength={6} required /></label>
            <label className="rsbsa-check" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} style={{ width: "auto" }} /> Show passwords</label>
            <div className="profile-center-actions">
              <button type="submit" className="btn-primary" disabled={pwBusy}>{pwBusy ? "Changing…" : <><i className="fa-solid fa-key"></i> Change password</>}</button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
