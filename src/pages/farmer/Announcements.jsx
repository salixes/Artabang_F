import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ProgramDetails from "../../components/ProgramDetails.jsx";
import { KIND_FILTERS, kindIcon, kindOfAnnouncement, fmtDate } from "../../lib/assistancePrograms";

// Every announcement in one list. "Assistance" ones are the programs addressed to this
// farmer (row level security returns only those), and link to the Eligibility page.
export default function FarmerAnnouncements() {
  const [general, setGeneral] = useState([]);
  const [assist, setAssist] = useState([]);
  const [filter, setFilter] = useState("All");
  useEffect(() => {
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setGeneral(data || []));
    supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setAssist(data || []));
  }, []);

  const feed = [
    ...general.map((a) => ({ ...a, _kind: kindOfAnnouncement(a), _assist: false })),
    ...assist.map((a) => ({ ...a, _kind: "Assistance", _assist: true })),
  ].filter((a) => filter === "All" || a._kind === filter).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-bullhorn"></i> Announcements</h2></div>
      <div className="kind-tabs" role="group" aria-label="Filter announcements">
        {KIND_FILTERS.map((k) => <button type="button" key={k} className={`aa-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{k}</button>)}
      </div>
      <div className="announce-grid">
        {feed.length === 0 && <p className="hint-text">No announcements yet.</p>}
        {feed.map((a) => a._assist ? (
          <div className="panel" key={`a-${a.id}`}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-hand-holding-dollar"}`}></i> {a.title}</h3></div>
            <div className="aa-meta"><span className="aa-badge">Assistance</span><span className="aa-badge soft">{a.assistance_type}</span></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            <ProgramDetails type={a.assistance_type} details={a.details} />
            <div style={{ padding: "0 4px 8px" }}><Link to="/farmer/eligibility" className="btn-ghost" style={{ display: "inline-block", padding: "6px 12px", fontSize: ".75rem" }}><i className="fa-solid fa-clipboard-check"></i> Check my eligibility &amp; apply</Link></div>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>
              {a.deadline && <>Deadline: <b>{fmtDate(a.deadline)}</b> · </>}
              Posted {fmtDate(a.created_at)}
            </small>
          </div>
        ) : (
          <div className="panel" key={`g-${a.id}`}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || kindIcon(a._kind)}`}></i> {a.title}</h3></div>
            <div className="aa-meta"><span className="aa-badge soft">{a._kind}</span></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>{fmtDate(a.created_at)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
