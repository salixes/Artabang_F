import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import PcicPaper from "../../components/PcicPaper.jsx";
import { prefillFromFarmer, validate, toRecords, valuesFromSaved, emptyValues } from "../../lib/pcicForm";
import { tr } from "../../lib/i18n";

/**
 * Register Crop — the screen IS the PCIC "Application for Crop Insurance"
 * (one long bond sheet). Saving it registers the crop (one record per lot)
 * and files the insurance application for it.
 */
export default function PcicApplication({ onCancel, onSaved }) {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [values, setValues] = useState(() => prefillFromFarmer(farmer));
  const [errList, setErrList] = useState([]);
  const [saving, setSaving] = useState(false);
  // after the first try, a field stays red only until it is filled in
  const errors = Object.fromEntries((errList.length ? validate(values) : []).map((e) => [e.key, true]));

  const showErrors = (list) => {
    setErrList(list);
    // no message list: the fields that still need filling in turn red; jump to the first one
    setTimeout(() => {
      const el = document.querySelector(".pp .bad");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const f = el.matches("input,select,textarea") ? el : el.querySelector("input,select,textarea");
      f?.focus?.({ preventScroll: true });
    }, 80);
  };
  const cancel = () => { if (confirm(tr("Close the form without saving?"))) onCancel(); };
  const clearForm = () => { if (confirm(tr("Clear all entries in this form?"))) { setValues(emptyValues()); setErrList([]); } };

  async function save() {
    const list = validate(values);
    if (list.length) return showErrors(list);
    if (!farmer?.id) return showErrors([{ key: "_save", msg: "Your farmer profile could not be loaded. Please sign in again." }]);

    const { insurance, crops } = toRecords(values, farmer.id);
    setSaving(true);

    // Insurance first: the database refuses a second ACTIVE policy for the same crop,
    // so a rejected application never leaves duplicate crop records behind.
    const { error: insErr } = await supabase.from("insurance_registrations").insert(insurance);
    if (insErr) {
      setSaving(false);
      const msg = /pcic_application/.test(insErr.message)
        ? `${insErr.message} — run supabase/migrations/pcic_application.sql in the Supabase SQL editor first.`
        : insErr.message.replace(/^.*insurance_registrations: /, "");
      showErrors([{ key: "_save", msg }]);
      return showToast(msg, "fa-triangle-exclamation");
    }
    const { data: newCrops, error: cropErr } = await supabase.from("crop_registrations").insert(crops).select("id");
    setSaving(false);
    if (cropErr) {
      const msg = `Insurance application saved, but the crop registration failed: ${cropErr.message}`;
      showErrors([{ key: "_save", msg }]);
      return showToast(msg, "fa-triangle-exclamation");
    }
    // make sure every admin is told (bell icon + Notifications page)
    try { await Promise.all((newCrops || []).map((c) => supabase.rpc("notify_admin_crop", { p_crop: c.id, p_kind: "registered" }))); } catch (_) { /* the database trigger also notifies */ }
    logActivity(`Registered crop ${insurance.crop_name} (PCIC application)`, "crop");
    showToast(tr("Crop registered and sent to the admin for approval (Pending)."), "fa-shield-heart");
    onSaved();
  }

  return (
    <section className="pp">
      <div className="pp-bar">
        <button className="pp-btn" onClick={cancel}>{tr("← Back")}</button>
        <b>{tr("PCIC — Application for Crop Insurance")}</b>
        <div className="pp-btns"><button className="pp-btn" onClick={() => window.print()}>{tr("Print")}</button></div>
      </div>


      <PcicPaper values={values} setValues={setValues} errors={errors} />

      <div className="pp-bar" style={{ position: "sticky", bottom: 0, background: "#f1f1f1", border: "1px solid #999", borderRadius: 4, padding: "8px 12px", justifyContent: "flex-end", zIndex: 5 }}>
        <div className="pp-btns">
          <button className="pp-btn" type="button" onClick={cancel}>{tr("Cancel")}</button>
          <button className="pp-btn" type="button" onClick={clearForm}>{tr("Clear Form")}</button>
          <button className="pp-btn pri" type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Application"}</button>
        </div>
      </div>
    </section>
  );
}

// View / Print a saved application (the exact form the farmer filled in).
export function PcicView({ saved, onBack }) {
  return (
    <section className="pp">
      <div className="pp-bar">
        <button className="pp-btn" onClick={onBack}>{tr("← Back")}</button>
        <div className="pp-btns"><button className="pp-btn pri" onClick={() => window.print()}>{tr("Print (1 long bond sheet)")}</button></div>
      </div>
      <PcicPaper values={valuesFromSaved(saved)} readOnly />
    </section>
  );
}
