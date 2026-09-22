import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";

export default function Validation() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);

  async function load() {
    const { data } = await supabase.from("farmer_directory").select("*").order("validated").order("full_name");
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function toggleValidate(row) {
    const { error } = await supabase.from("farmers").update({ validated: !row.validated }).eq("id", row.id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(row.validated ? "Validation revoked." : "Farmer validated.", "fa-user-check");
    load();
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-user-check"></i> Farmer Validation</h2></div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> As Association President, confirm the farmers you personally know and vouch for in Barangay Lindaban.</p>
      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Location</th><th>Crops</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{f.full_name}</td><td>{f.location || "—"}</td><td>{(f.crops || []).join(", ") || "—"}</td>
                <td><span className={`status-badge ${f.validated ? "status-resolved" : "status-pending"}`}>{f.validated ? "Validated" : "Pending"}</span></td>
                <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => toggleValidate(f)}>{f.validated ? "Revoke" : "Validate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
