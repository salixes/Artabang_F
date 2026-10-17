import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function FarmerAnnouncements() {
  const [rows, setRows] = useState([]);
  const [assistance, setAssistance] = useState([]);
  useEffect(() => {
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setRows(data || []));
    // Assistance announcements: row level security returns ONLY the ones addressed to this farmer.
    supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setAssistance(data || []));
  }, []);
  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-bullhorn"></i> Announcements</h2></div>

      {assistance.length > 0 && (
        <>
          <p className="rsbsa-subhead"><i className="fa-solid fa-hand-holding-heart"></i> Assistance available to you</p>
          <div className="announce-grid" style={{ marginBottom: 20 }}>
            {assistance.map((a) => (
              <div className="panel" key={a.id}>
                <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-hand-holding-dollar"}`}></i> {a.title}</h3></div>
                <div className="aa-meta"><span className="aa-badge">{a.assistance_type}</span></div>
                <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
                <div style={{ padding: "0 4px 8px" }}><Link to="/farmer/eligibility" className="btn-ghost" style={{ display: "inline-block", padding: "6px 12px", fontSize: ".75rem" }}><i className="fa-solid fa-clipboard-check"></i> Check my eligibility &amp; apply</Link></div>
                <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>
                  {a.deadline && <>Deadline: <b>{new Date(a.deadline).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</b> · </>}
                  Posted {new Date(a.created_at).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                </small>
              </div>
            ))}
          </div>
          <p className="rsbsa-subhead"><i className="fa-solid fa-bullhorn"></i> General announcements</p>
        </>
      )}

      <div className="announce-grid">
        {rows.length === 0 && <p className="hint-text">No announcements yet.</p>}
        {rows.map((a) => (
          <div className="panel" key={a.id}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-bullhorn"}`}></i> {a.title}</h3></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)" }}>{a.body}</p>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>{new Date(a.created_at).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
