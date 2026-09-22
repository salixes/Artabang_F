import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export default function StaffProfile({ roleLabel }) {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ full_name: profile?.full_name || "", contact_number: profile?.contact_number || "" });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: form.full_name, contact_number: form.contact_number, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setSaving(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Profile updated.", "fa-floppy-disk");
    refreshProfile();
  }

  if (!profile) return null;

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-id-badge"></i> {roleLabel} Profile</h2></div>
      <div className="profile-center-wrap">
        <div className="panel">
          <div className="profile-center-header">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.avatar_seed || profile.full_name)}&backgroundColor=b6e3b6`} alt="avatar" />
            <div><p style={{ fontWeight: 600, fontSize: "1.1rem" }}>{profile.full_name}</p><p className="hint-text">{profile.email}</p></div>
          </div>
          <form className="modal-body" onSubmit={submit}>
            <label>Full Name <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
            <label>Contact Number <input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="09XX-XXX-XXXX" /></label>
            <div className="profile-center-actions">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : <><i className="fa-solid fa-floppy-disk"></i> Save</>}</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
