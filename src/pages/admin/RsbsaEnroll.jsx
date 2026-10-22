import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useToast } from "../../context/ToastContext.jsx";
import RsbsaPaper from "../../components/RsbsaPaper.jsx";
import { useRsbsaValues } from "../../lib/useRsbsaValues";
import {
  emptyValues, validate, withGeneratedNumbers, toFarmerColumns, fullNameFromValues, transactionCode,
} from "../../lib/rsbsaForm";

async function functionError(error, data) {
  if (data?.error) return data.error;
  if (!error) return "Unknown error.";
  try {
    if (error.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (_) { /* not JSON */ }
  if (/failed to fetch|networkerror|load failed/i.test(error.message || "")) {
    return "Could not reach the admin-create-user Edge Function. Has it been deployed (Supabase Dashboard → Edge Functions)?";
  }
  return error.message || "Something went wrong.";
}

/**
 * Add Farmer / Edit Farmer — the screen IS the official RSBSA Enrollment Form
 * (2 long bond sheets). Nothing else is asked, except the farmer's login
 * e-mail + temporary password when adding (needed to create the account).
 */
export default function RsbsaEnroll({ farmer, associations, onCancel, onSaved }) {
  const edit = !!farmer;
  const loaded = useRsbsaValues(farmer || { id: null });
  if (edit && loaded.loading) return <p className="hint-text" style={{ padding: 20 }}>Loading RSBSA form…</p>;
  return <Editor farmer={farmer} edit={edit} initial={edit ? loaded.values : emptyValues()} associations={associations} onCancel={onCancel} onSaved={onSaved} />;
}

function Editor({ farmer, edit, initial, associations, onCancel, onSaved }) {
  const { showToast } = useToast();
  const [values, setValues] = useState(initial);
  const [errList, setErrList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // after the first try, a field stays red only until it is filled in
  const liveErrors = () => {
    const list = validate(values);
    if (!edit) {
      if (!email.trim()) list.unshift({ key: "_email" });
      if (password.length < 6) list.unshift({ key: "_password" });
    }
    return list;
  };
  const errors = Object.fromEntries((errList.length ? liveErrors() : []).map((e) => [e.key, true]));
  const showErrors = (list) => {
    setErrList(list);
    // no message list: the fields that still need filling in turn red; jump to the first one
    setTimeout(() => {
      const el = document.querySelector(".rp .bad, .rp-account .bad");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const f = el.matches("input,select,textarea") ? el : el.querySelector("input,select,textarea");
      f?.focus?.({ preventScroll: true });
    }, 80);
  };

  function cancel() { if (confirm("Close the form without saving?")) onCancel(); }
  function clearForm() { if (confirm("Clear all entries in this form?")) { setValues(emptyValues()); setErrList([]); } }

  async function save() {
    const list = validate(values);
    if (!edit) {
      if (!email.trim()) list.unshift({ key: "_email", msg: "Farmer login e-mail is required" });
      if (password.length < 6) list.unshift({ key: "_password", msg: "Temporary password must be at least 6 characters" });
    }
    if (list.length) return showErrors(list);

    const v = withGeneratedNumbers(values);      // system-generated transaction code / RSBSA numbers
    setValues(v);
    const { columns, crops } = toFarmerColumns(v, associations);
    const full_name = fullNameFromValues(v);
    setSaving(true);

    if (!edit) {
      let data, error;
      try {
        ({ data, error } = await supabase.functions.invoke("admin-create-user", {
          body: {
            ...columns, crops, email: email.trim(), password, full_name, role: "farmer",
            location: columns.farm_location || columns.house_no_purok, contact_number: columns.mobile_number,
          },
        }));
      } catch (err) { error = err; }
      setSaving(false);
      if (error || data?.error) {
        const msg = await functionError(error, data);
        console.error("admin-create-user failed:", { error, data });
        showErrors([{ key: "_save", msg }]);
        return showToast(msg, "fa-triangle-exclamation");
      }
      logActivity(`Enrolled farmer ${full_name}`, "farmer");
      showToast(`Farmer enrolled. Transaction code: ${transactionCode(v)}`, "fa-user-plus");
      return onSaved();
    }

    const { error } = await supabase.from("farmers").update({ ...columns, updated_at: new Date().toISOString() }).eq("id", farmer.id);
    if (!error) {
      await supabase.from("farmer_crops").delete().eq("farmer_id", farmer.id);
      if (crops.length) await supabase.from("farmer_crops").insert(crops.map((c) => ({ farmer_id: farmer.id, crop_name: c })));
    }
    setSaving(false);
    if (error) {
      const msg = /rsbsa_form/.test(error.message) ? `${error.message} — run supabase/migrations/rsbsa_form.sql in the Supabase SQL editor first.` : error.message;
      showErrors([{ key: "_save", msg }]);
      return showToast(error.message, "fa-triangle-exclamation");
    }
    logActivity(`Updated farmer record of ${full_name}`, "farmer");
    showToast("Farmer record updated.", "fa-floppy-disk");
    onSaved();
  }

  return (
    <section className="rp">
      <div className="rp-bar">
        <button className="rp-btn" onClick={cancel}>← Back to Farmer Profiling</button>
        <b>{edit ? "Edit RSBSA Enrollment Form" : "RSBSA Enrollment Form — New Farmer"}</b>
        <div className="rp-btns"><button className="rp-btn" onClick={() => window.print()}>Print</button></div>
      </div>

      {!edit && (
        <div className="rp-account">
          <label htmlFor="rp-email"><b>Farmer login e-mail</b></label>
          <input id="rp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={errors._email ? "bad" : ""} autoComplete="off" />
          <label htmlFor="rp-pass"><b>Temporary password</b></label>
          <input id="rp-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={errors._password ? "bad" : ""} autoComplete="off" />
          <small>Not part of the paper form — only used to create the farmer's AgriTabang login.</small>
        </div>
      )}


      <RsbsaPaper values={values} setValues={setValues} errors={errors} photoUrl={farmer?.photo_url} />

      <div className="rp-bar" style={{ position: "sticky", bottom: 0, background: "#f1f1f1", border: "1px solid #999", borderRadius: 4, padding: "8px 12px", justifyContent: "flex-end", zIndex: 5 }}>
        <div className="rp-btns">
          <button className="rp-btn" type="button" onClick={cancel}>Cancel</button>
          <button className="rp-btn" type="button" onClick={clearForm}>Clear Form</button>
          <button className="rp-btn pri" type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : edit ? "Save Changes" : "Save Farmer"}</button>
        </div>
      </div>
    </section>
  );
}
