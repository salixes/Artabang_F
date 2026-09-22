import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";

const FIELD_LABELS = { contact_number: "Contact Number", location: "Location", crops: "Plants Grown", farm_size: "Farm Size (ha)", is_association_member: "Association Member", photo_url: "Profile Photo" };

function formatVal(field, val) {
  if (field === "crops") return Array.isArray(val) && val.length ? val.join(", ") : "—";
  if (field === "is_association_member") return val ? "Yes" : "No";
  if (field === "photo_url") return val ? "Updated photo" : "No photo";
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}
function diff(oldV, newV) {
  return Object.keys(FIELD_LABELS)
    .filter((f) => JSON.stringify(oldV?.[f]) !== JSON.stringify(newV?.[f]))
    .map((f) => ({ label: FIELD_LABELS[f], oldText: formatVal(f, oldV?.[f]), newText: formatVal(f, newV?.[f]) }));
}

export default function PresidentRequests() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});

  async function load() {
    const [{ data }, { data: dir }] = await Promise.all([
      supabase.from("profile_update_requests").select("*").order("submitted_at", { ascending: false }),
      supabase.from("farmer_directory").select("id, full_name"),
    ]);
    setRows(data || []);
    setNames(Object.fromEntries((dir || []).map((d) => [d.id, d.full_name])));
  }
  useEffect(() => { load(); }, []);

  async function decide(id, decision) {
    const { error } = await supabase.from("profile_update_requests").update({ president_status: decision, president_at: new Date().toISOString() }).eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(`Request ${decision.toLowerCase()} by President.`, "fa-user-tie");
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-file-circle-check"></i> Profile Update Requests</h2></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> As Association President, endorse profile edits based on your firsthand knowledge of the farmer before ADMIN gives final approval.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Requested Changes</th><th>Submitted</th><th>President</th><th>ADMIN</th><th>Overall</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No requests yet.</td></tr>}
            {rows.map((r) => {
              const diffs = diff(r.old_values, r.new_values);
              return (
                <tr key={r.id}>
                  <td>{names[r.farmer_id] || "—"}</td>
                  <td style={{ maxWidth: 260 }}>{diffs.length === 0 ? <em>No field changes</em> : <ul className="diff-list">{diffs.map((d, i) => <li key={i}><b>{d.label}:</b> {d.oldText} → {d.newText}</li>)}</ul>}</td>
                  <td>{new Date(r.submitted_at).toLocaleDateString("en-PH")}</td>
                  <td>
                    <span className={`status-badge ${r.president_status === "Approved" ? "status-resolved" : r.president_status === "Rejected" ? "status-progress" : "status-pending"}`}>{r.president_status}</span>
                    {r.president_status === "Pending" && (
                      <div style={{ marginTop: 4 }}>
                        <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => decide(r.id, "Approved")}><i className="fa-solid fa-check"></i></button>{" "}
                        <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => decide(r.id, "Rejected")}><i className="fa-solid fa-xmark"></i></button>
                      </div>
                    )}
                  </td>
                  <td><span className={`status-badge ${r.admin_status === "Approved" ? "status-resolved" : r.admin_status === "Rejected" ? "status-progress" : "status-pending"}`}>{r.admin_status}</span></td>
                  <td><span className={`status-badge ${r.overall_status === "Approved" ? "status-resolved" : r.overall_status === "Rejected" ? "status-progress" : "status-pending"}`}>{r.overall_status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
