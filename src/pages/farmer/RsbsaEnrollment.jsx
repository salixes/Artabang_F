import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import RsbsaPaper from "../../components/RsbsaPaper.jsx";
import { useRsbsaValues } from "../../lib/useRsbsaValues";
import { validate, valuesFromRecord } from "../../lib/rsbsaForm";
import { tr } from "../../lib/i18n";

const STATUS = {
  Pending: { icon: "fa-hourglass-half", tone: "var(--progress)", title: "Waiting for admin validation", text: "You submitted your RSBSA Enrollment Form. The ADMIN will check it. You will get a notification when it is done." },
  Approved: { icon: "fa-circle-check", tone: "var(--forest)", title: "Validated by the admin", text: "Your RSBSA Enrollment Form is approved and saved in your farmer record." },
  Returned: { icon: "fa-rotate-left", tone: "#C24444", title: "Returned for corrections", text: "The admin sent your form back. Please fix it and submit again." },
};
const day = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "");

/**
 * Farmer side of the RSBSA Enrollment Form: fill it out yourself (you sign it),
 * submit it, and the ADMIN validates it. For farmers who have no phone, the ADMIN
 * can still fill out the same form for them (Admin → Farmer Profiling → Add Farmer).
 */
export default function FarmerRsbsaEnrollment() {
  const { farmer } = useAuth();
  const { showToast } = useToast();
  const [latest, setLatest] = useState(undefined); // undefined = loading, null = none yet
  // null = status page | "fill" = fill out / resubmit | "view" = view the submitted form
  const [screen, setScreen] = useState(null);

  async function load() {
    if (!farmer?.id) return;
    const { data, error } = await supabase.from("rsbsa_submissions").select("*").eq("farmer_id", farmer.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { setLatest(null); if (/rsbsa_submissions/.test(error.message)) showToast(tr("Run supabase/migrations/rsbsa_submissions.sql in the Supabase SQL editor first."), "fa-triangle-exclamation"); return; }
    setLatest(data || null);
  }
  useEffect(() => { load(); }, [farmer?.id]);

  if (latest === undefined) return <p className="hint-text" style={{ padding: 20 }}>{tr("Loading…")}</p>;
  if (screen === "fill") return <Fill farmer={farmer} latest={latest} onCancel={() => setScreen(null)} onSent={() => { setScreen(null); load(); }} />;
  if (screen === "view") {
    return (
      <section className="rp">
        <div className="rp-bar">
          <button className="rp-btn" onClick={() => setScreen(null)}>{tr("← Back")}</button>
          <b>{tr("My submitted RSBSA Enrollment Form")}</b>
          <div className="rp-btns"><button className="rp-btn pri" onClick={() => window.print()}>{tr("Print (2 long bond sheets)")}</button></div>
        </div>
        <RsbsaPaper values={valuesFromRecord({ rsbsa_form: latest.form })} readOnly photoUrl={farmer?.photo_url} />
      </section>
    );
  }

  const st = latest ? STATUS[latest.status] : null;
  const canFill = !latest || latest.status === "Returned";
  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-file-signature"></i> {tr("RSBSA Enrollment")}</h2></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> <span>{tr("Fill out the official RSBSA Enrollment Form here, sign it, and send it to the ADMIN. The admin checks it before it becomes your record. No phone? The admin can fill out the form for you at the office.")}</span></p>

      <div className="panel" style={{ padding: 18, maxWidth: 640 }}>
        {!latest ? (
          <>
            <p style={{ fontWeight: 600, marginBottom: 6 }}><i className="fa-solid fa-file-pen"></i> {tr("You have not submitted your form yet")}</p>
            <p className="hint-text" style={{ marginBottom: 12 }}>{tr("It has 2 long bond sheets. You will sign at the end (draw, type, or upload your signature).")}</p>
          </>
        ) : (
          <>
            <p style={{ fontWeight: 700, color: st.tone, marginBottom: 4 }}><i className={`fa-solid ${st.icon}`}></i> {st.title}</p>
            <p className="hint-text" style={{ marginBottom: 6 }}>{st.text}</p>
            <p style={{ fontSize: ".78rem", color: "var(--ink-soft)", marginBottom: 6 }}>{tr("Submitted")} {day(latest.submitted_at)}{latest.reviewed_at && latest.status !== "Pending" ? ` · Reviewed ${day(latest.reviewed_at)}` : ""}</p>
            {latest.status === "Returned" && latest.remarks && <p style={{ background: "#FBEAEA", color: "#8E2B2B", borderRadius: 10, padding: "8px 12px", fontSize: ".85rem", marginBottom: 12 }}><b>{tr("Admin's note:")}</b> {latest.remarks}</p>}
          </>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canFill && <button className="btn-primary" onClick={() => setScreen("fill")}><i className="fa-solid fa-pen-to-square"></i> {latest ? "Fix and submit again" : "Fill out the form"}</button>}
          {latest && <button className="btn-ghost" onClick={() => setScreen("view")}><i className="fa-solid fa-file-lines"></i> {tr("View my submitted form")}</button>}
        </div>
      </div>
    </section>
  );
}

function Fill({ farmer, latest, onCancel, onSent }) {
  const returned = latest?.status === "Returned" ? latest.form : null;
  const loaded = useRsbsaValues(farmer || { id: null });
  if (!returned && loaded.loading) return <p className="hint-text" style={{ padding: 20 }}>{tr("Loading form…")}</p>;
  const initial = returned ? valuesFromRecord({ rsbsa_form: returned }) : loaded.values;
  return <Editor farmer={farmer} initial={initial} onCancel={onCancel} onSent={onSent} />;
}

function Editor({ farmer, initial, onCancel, onSent }) {
  const { showToast } = useToast();
  const [values, setValues] = useState(initial);
  const [errList, setErrList] = useState([]);
  const [sending, setSending] = useState(false);
  // after the first try, a field stays red only until it is filled in
  const errors = Object.fromEntries((errList.length ? validate(values) : []).map((e) => [e.key, true]));
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

  const cancel = () => { if (confirm(tr("Close the form without submitting? What you typed will be lost."))) onCancel(); };
  const clearForm = () => { if (confirm(tr("Clear all entries in this form?"))) { setValues(initial); setErrList([]); } };

  async function submit() {
    const list = validate(values);
    if (list.length) return showErrors(list);
    if (!confirm(tr("Submit this form to the ADMIN for validation?"))) return;
    setSending(true);
    const { error } = await supabase.from("rsbsa_submissions").insert({ farmer_id: farmer.id, form: values });
    setSending(false);
    if (error) {
      const msg = /rsbsa_submissions/.test(error.message) && !/duplicate/.test(error.message)
        ? `${error.message} — run supabase/migrations/rsbsa_submissions.sql in the Supabase SQL editor first.`
        : /duplicate|one_pending/.test(error.message) ? "You already have a form waiting for the admin." : error.message;
      showErrors([{ key: "_save", msg }]);
      return showToast(msg, "fa-triangle-exclamation");
    }
    logActivity("Submitted RSBSA Enrollment Form for validation", "farmer");
    showToast(tr("Form submitted. The admin will validate it."), "fa-paper-plane");
    onSent();
  }

  return (
    <section className="rp">
      <div className="rp-bar">
        <button className="rp-btn" onClick={cancel}>{tr("← Back")}</button>
        <b>{tr("RSBSA Enrollment Form")}</b>
        <div className="rp-btns"><button className="rp-btn" onClick={() => window.print()}>{tr("Print")}</button></div>
      </div>
      <RsbsaPaper values={values} setValues={setValues} errors={errors} photoUrl={farmer?.photo_url} />
      <div className="rp-bar" style={{ position: "sticky", bottom: 0, background: "#f1f1f1", border: "1px solid #999", borderRadius: 4, padding: "8px 12px", justifyContent: "flex-end", zIndex: 5 }}>
        <div className="rp-btns">
          <button className="rp-btn" type="button" onClick={cancel}>{tr("Cancel")}</button>
          <button className="rp-btn" type="button" onClick={clearForm}>{tr("Reset")}</button>
          <button className="rp-btn pri" type="button" onClick={submit} disabled={sending}>{sending ? "Submitting…" : "Submit to Admin"}</button>
        </div>
      </div>
    </section>
  );
}
