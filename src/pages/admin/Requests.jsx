import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import { StatusBadge } from "../../components/Badges.jsx";

export default function AdminRequests() {
  const { showToast } = useToast();
  const [cropRequests, setCropRequests] = useState([]);
  const [legacyRequests, setLegacyRequests] = useState([]);
  const [names, setNames] = useState({});

  async function load() {
    const [{ data: crops }, { data: legacy }, { data: dir }] = await Promise.all([
      supabase.from("crop_change_requests").select("*").order("requested_at", { ascending: false }),
      supabase.from("profile_update_requests").select("*").in("overall_status", ["Pending Review"]).order("submitted_at", { ascending: false }),
      supabase.from("farmer_directory").select("id, full_name"),
    ]);
    setCropRequests(crops || []);
    setLegacyRequests(legacy || []);
    setNames(Object.fromEntries((dir || []).map((d) => [d.id, d.full_name])));
  }
  useEffect(() => { load(); }, []);

  async function decide(id, status) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("crop_change_requests").update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(`Crop change request ${status.toLowerCase()}.`, "fa-tractor");
    load();
  }

  async function decideLegacy(id, decision) {
    const { error } = await supabase.from("profile_update_requests").update({ admin_status: decision, admin_at: new Date().toISOString() }).eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(`Request ${decision.toLowerCase()}.`, "fa-user-shield");
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-file-circle-check"></i> Crop Change Requests</h2></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Plants Grown is important farm information — a farmer's requested change only takes effect once ADMIN marks it Verified. General profile edits (contact info, photo, password) no longer require approval and are already applied directly by the farmer.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Current Crops</th><th>Requested Crops</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {cropRequests.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No crop change requests yet.</td></tr>}
            {cropRequests.map((r) => (
              <tr key={r.id}>
                <td>{names[r.farmer_id] || "—"}</td>
                <td style={{ maxWidth: 220 }}>{(r.old_crops || []).join(", ") || "—"}</td>
                <td style={{ maxWidth: 220 }}>{(r.new_crops || []).join(", ") || "—"}</td>
                <td>{new Date(r.requested_at).toLocaleDateString("en-PH")}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  {r.status === "Pending" && (
                    <>
                      <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => decide(r.id, "Verified")}><i className="fa-solid fa-check"></i> Verify</button>{" "}
                      <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => decide(r.id, "Rejected")}><i className="fa-solid fa-xmark"></i> Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {legacyRequests.length > 0 && (
        <>
          <div className="view-head" style={{ marginTop: 26 }}><h2 style={{ fontSize: "1rem" }}><i className="fa-solid fa-clock-rotate-left"></i> Legacy Profile Update Requests (pre-existing, awaiting ADMIN sign-off)</h2></div>
          <div className="table-panel">
            <table className="data-table">
              <thead><tr><th>Farmer</th><th>Submitted</th><th>President</th><th>ADMIN</th><th></th></tr></thead>
              <tbody>
                {legacyRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{names[r.farmer_id] || "—"}</td>
                    <td>{new Date(r.submitted_at).toLocaleDateString("en-PH")}</td>
                    <td><StatusBadge status={r.president_status} /></td>
                    <td><StatusBadge status={r.admin_status} /></td>
                    <td>
                      {r.admin_status === "Pending" && (
                        <>
                          <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => decideLegacy(r.id, "Approved")}><i className="fa-solid fa-check"></i></button>{" "}
                          <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => decideLegacy(r.id, "Rejected")}><i className="fa-solid fa-xmark"></i></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
