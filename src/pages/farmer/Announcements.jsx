import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ProgramDetails from "../../components/ProgramDetails.jsx";
import { KIND_FILTERS, kindIcon, kindOfAnnouncement, fmtDate } from "../../lib/assistancePrograms";
import { tr } from "../../lib/i18n";

// Every announcement in one list. "Assistance" ones are the programs addressed to this
// farmer (row level security returns only those), and link to the Eligibility page.
export default function FarmerAnnouncements() {
  const [general, setGeneral] = useState([]);
  const [assist, setAssist] = useState([]);
  const [filter, setFilter] = useState("All");
  const { farmer } = useAuth();
  const [assoc, setAssoc] = useState([]);
  const [meetings, setMeetings] = useState([]);
  useEffect(() => {
    supabase.from("associations").select("id, name").then(({ data }) => setAssoc(data || []));
    // meetings of the farmer's own association (or of all associations)
    supabase.from("meetings").select("*").order("meeting_date", { ascending: false }).then(({ data }) => setMeetings(data || []));
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setGeneral(data || []));
    supabase.from("assistance_announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setAssist(data || []));
  }, []);

  const feed = [
    ...general.map((a) => ({ ...a, _kind: kindOfAnnouncement(a), _assist: false })),
    ...assist.map((a) => ({ ...a, _kind: "Assistance", _assist: true })),
    ...meetings
      .filter((m) => farmer?.is_association_member && (!m.association_id || m.association_id === farmer.association_id))
      .map((m) => ({ ...m, _kind: "Event", _meeting: true })),
  ].filter((a) => filter === "All" || a._kind === filter).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-bullhorn"></i> {tr("Announcements")}</h2></div>
      <div className="kind-tabs" role="group" aria-label={tr("Filter announcements")}>
        {KIND_FILTERS.map((k) => <button type="button" key={k} className={`aa-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{tr(k)}</button>)}
      </div>
      <div className="announce-grid">
        {feed.length === 0 && <p className="hint-text">{tr("No announcements yet.")}</p>}
        {feed.map((a) => a._meeting ? (
          <div className="panel" key={`m-${a.id}`}>
            <div className="panel-head"><h3><i className="fa-solid fa-people-roof"></i> {a.title}</h3></div>
            <div className="aa-meta"><span className="aa-badge soft">{a.meeting_type}</span><span className="aa-badge soft"><i className="fa-solid fa-bullseye"></i> {a.association_id ? `${assoc.find((x) => x.id === a.association_id)?.name || "Your association"} members` : "All associations"}</span></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)" }}><i className="fa-solid fa-calendar-days"></i> {fmtDate(a.meeting_date)} &nbsp;·&nbsp; <i className="fa-solid fa-location-dot"></i> {a.location}</p>
          </div>
        ) : a._assist ? (
          <div className="panel" key={`a-${a.id}`}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-hand-holding-dollar"}`}></i> {a.title}</h3></div>
            <div className="aa-meta"><span className="aa-badge">{tr("Assistance")}</span><span className="aa-badge soft">{tr(a.assistance_type)}</span></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            <ProgramDetails type={a.assistance_type} details={a.details} />
            <div style={{ padding: "0 4px 8px" }}><Link to="/farmer/eligibility" className="btn-ghost" style={{ display: "inline-block", padding: "6px 12px", fontSize: ".75rem" }}><i className="fa-solid fa-clipboard-check"></i> {tr("Check my eligibility & apply")}</Link></div>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>
              {a.deadline && <>{tr("Deadline:")} <b>{fmtDate(a.deadline)}</b> · </>}
              {tr("Posted")} {fmtDate(a.created_at)}
            </small>
          </div>
        ) : (
          <div className="panel" key={`g-${a.id}`}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || kindIcon(a._kind)}`}></i> {a.title}</h3></div>
            <div className="aa-meta"><span className="aa-badge soft">{tr(a._kind)}</span>{a.association_id && <span className="aa-badge soft"><i className="fa-solid fa-bullseye"></i> {assoc.find((x) => x.id === a.association_id)?.name || "Your association"} members</span>}</div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>{fmtDate(a.created_at)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
