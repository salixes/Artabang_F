import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { logActivity } from "../../lib/activity";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import RsbsaPaper from "../../components/RsbsaPaper.jsx";
import { validate, valuesFromRecord, withGeneratedNumbers, toFarmerColumns, fullNameFromValues, transactionCode } from "../../lib/rsbsaForm";

const TONE = { Pending: "var(--progress)", Approved: "var(--forest)", Returned: "#C24444" };
const Pill = ({ s }) => <span style={{ fontSize: ".7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(0,0,0,.06)", color: TONE[s] }}>{s}</span>;
const stamp = (d) => (d ? new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

// Admin checks the RSBSA Enrollment Forms that farmers filled out and sent from their own account.
export default function RsbsaValidation() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [photos, setPhotos] = useState({});
  const [associations, setAssociations] = useState([]);
  const [filter, setFilter] = useState("Pending");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState(null);

  async function load() {
    const [{ data: subs, error }, { data: dir }, { data: assoc }] = await Promise.all([
      supabase.from("rsbsa_submissions").select("*").order("submitted_at", { ascending: false }),
      supabase.from("farmer_directory").select("id, full_name, photo_url"),
      supabase.from("associations").select("*").order("name"),
    ]);
    if (error && /rsbsa_submissions/.test(error.message)) showToast("Run supabase/migrations/rsbsa_submissions.sql in the Supabase SQL editor first.", "fa-triangle-exclamation");
    setRows(subs || []);
    setNames(Object.fromEntries((dir || []).map((d) => [d.id, d.full_name])));
    setPhotos(Object.fromEntries((dir || []).map((d) => [d.id, d.photo_url])));
    setAssociations(assoc || []);
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({ Pending: rows.filter((r) => r.status === "Pending").length, Approved: rows.filter((r) => r.status === "Approved").length, Returned: rows.filter((r) => r.status === "Returned").length }), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (filter === "All" || r.status === filter) && (!q || (names[r.farmer_id] || "").toLowerCase().includes(q)));
  }, [rows, names, filter, search]);

  if (review) {
    return <Review row={review} name={names[review.farmer_id]} photo={photos[review.farmer_id]} associations={associations} onBack={() => setReview(null)} onDone={() => { setReview(null); load(); }} />;
  }

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-file-circle-check"></i> RSBSA Validation</h2>
        <div className="head-actions">
          <label className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input placeholder="Search farmer" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="Pending">Pending ({counts.Pending})</option>
            <option value="Approved">Approved ({counts.Approved})</option>
            <option value="Returned">Returned ({counts.Returned})</option>
            <option value="All">All</option>
          </select>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> <span>These are RSBSA Enrollment Forms that farmers filled out and signed in their own account. Open one to check it. You can fix small mistakes, then <b>Approve</b> (it is saved to the farmer's record) or <b>Return</b> it with a note. For farmers without a phone, use Farmer Profiling → Add Farmer.</span></p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Submitted</th><th>Status</th><th>Reviewed</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-soft)" }}>{filter === "Pending" ? "No forms waiting for validation." : "No forms found."}</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{names[r.farmer_id] || fullNameFromValues(valuesFromRecord({ rsbsa_form: r.form })) || "—"}</td>
                <td>{stamp(r.submitted_at)}</td>
                <td><Pill s={r.status} />{r.status === "Returned" && r.remarks && <div style={{ fontSize: ".68rem", color: "var(--ink-soft)", marginTop: 2 }}>{r.remarks}</div>}</td>
                <td>{stamp(r.reviewed_at)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className={r.status === "Pending" ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 10px", fontSize: ".72rem" }} onClick={() => setReview(r)}>
                    <i className={`fa-solid ${r.status === "Pending" ? "fa-clipboard-check" : "fa-eye"}`}></i> {r.status === "Pending" ? "Review" : "View"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Review({ row, name, photo, associations, onBack, onDone }) {
  const { showToast } = useToast();
  const { session } = useAuth();
  const pending = row.status === "Pending";
  const [values, setValues] = useState(() => valuesFromRecord({ rsbsa_form: row.form }));
  const [errList, setErrList] = useState([]);
  const [busy, setBusy] = useState(false);
  const errors = Object.fromEntries(errList.map((e) => [e.key, true]));
  const showErrors = (list) => { setErrList(list); window.scrollTo?.({ top: 0, behavior: "smooth" }); document.querySelector(".content")?.scrollTo?.({ top: 0, behavior: "smooth" }); };

  async function approve() {
    const list = validate(values);
    if (list.length) return showErrors(list);
    if (!confirm(`Approve this form and save it to ${name || "the farmer"}'s record?`)) return;
    const v = withGeneratedNumbers(values);
    const { columns, crops } = toFarmerColumns(v, associations);
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("farmers").update({
      ...columns, validated: true, validated_by: session?.user?.id ?? null, validated_at: now, updated_at: now,
    }).eq("id", row.farmer_id);
    if (!error) {
      await supabase.from("farmer_crops").delete().eq("farmer_id", row.farmer_id);
      if (crops.length) await supabase.from("farmer_crops").insert(crops.map((c) => ({ farmer_id: row.farmer_id, crop_name: c })));
      const { error: e2 } = await supabase.from("rsbsa_submissions").update({ status: "Approved", form: v, remarks: null, reviewed_by: session?.user?.id ?? null, reviewed_at: now }).eq("id", row.id);
      if (e2) { setBusy(false); showErrors([{ key: "_save", msg: e2.message }]); return showToast(e2.message, "fa-triangle-exclamation"); }
    }
    setBusy(false);
    if (error) { showErrors([{ key: "_save", msg: error.message }]); return showToast(error.message, "fa-triangle-exclamation"); }
    logActivity(`Validated RSBSA form of ${name || fullNameFromValues(v)}`, "farmer");
    showToast(`Form approved. Transaction code: ${transactionCode(v)}`, "fa-circle-check");
    onDone();
  }

  async function sendBack() {
    const remarks = prompt(`What should ${name || "the farmer"} fix? (the farmer will see this note)`);
    if (remarks === null) return;
    if (!remarks.trim()) return showToast("Please write what needs to be fixed.", "fa-triangle-exclamation");
    setBusy(true);
    const { error } = await supabase.from("rsbsa_submissions").update({ status: "Returned", remarks: remarks.trim(), reviewed_by: session?.user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("id", row.id);
    setBusy(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    logActivity(`Returned RSBSA form of ${name || "a farmer"} for corrections`, "farmer");
    showToast("Form returned to the farmer.", "fa-rotate-left");
    onDone();
  }

  return (
    <section className="rp">
      <div className="rp-bar">
        <button className="rp-btn" onClick={onBack}>← Back to RSBSA Validation</button>
        <b>{name || "Farmer"} — {pending ? "Review RSBSA form" : `RSBSA form (${row.status})`}</b>
        <div className="rp-btns"><button className="rp-btn" onClick={() => window.print()}>Print</button></div>
      </div>
      {row.status === "Returned" && row.remarks && <div className="rp-errs" style={{ background: "#fff7e6" }}><b>Returned with note:</b> {row.remarks}</div>}
      {errList.length > 0 && (
        <div className="rp-errs"><b>This form is not complete yet:</b>
          <ul>{errList.map((e) => <li key={e.key}>{e.msg}</li>)}</ul>
        </div>
      )}
      {pending
        ? <RsbsaPaper values={values} setValues={setValues} errors={errors} photoUrl={photo} />
        : <RsbsaPaper values={values} readOnly photoUrl={photo} />}
      {pending && (
        <div className="rp-bar" style={{ position: "sticky", bottom: 0, background: "#f1f1f1", border: "1px solid #999", borderRadius: 4, padding: "8px 12px", justifyContent: "flex-end", zIndex: 5 }}>
          <div className="rp-btns">
            <button className="rp-btn" type="button" onClick={sendBack} disabled={busy}>Return to farmer</button>
            <button className="rp-btn pri" type="button" onClick={approve} disabled={busy}>{busy ? "Saving…" : "Approve and save"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
