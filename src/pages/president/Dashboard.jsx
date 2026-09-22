import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";

export default function PresidentDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [pendingValidations, setPendingValidations] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: statRow }, { data: pending }, { data: announce }] = await Promise.all([
        supabase.from("dashboard_stats").select("*").single(),
        supabase.from("farmer_directory").select("*").eq("validated", false).limit(6),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(2),
      ]);
      setStats(statRow);
      setPendingValidations(pending || []);
      setAnnouncements(announce || []);
    })();
  }, []);

  if (!stats) return <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> Loading dashboard…</p>;

  return (
    <section>
      {announcements.length > 0 && (
        <div className="announce-top-strip">
          {announcements.map((a) => (
            <div className="announce-top-card" key={a.id}>
              <i className={`fa-solid ${a.icon || "fa-bullhorn"}`}></i>
              <div>
                <div className="announce-top-head"><b>{a.title}</b><span>{new Date(a.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span></div>
                <p>{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="welcome-panel">
        <span className="eyebrow">Association Leadership</span>
        <h1>Welcome, {profile?.full_name?.split(" ")[0]}</h1>
        <p>Oversight of farmer validation, association membership, and assistance recommendations for Barangay Lindaban.</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card ring-total"><div className="stat-icon"><i className="fa-solid fa-people-group"></i></div><div className="stat-num">{stats.total_farmers}</div><div className="stat-label">Total Registered Farmers</div></div>
        <div className="stat-card ring-pending"><div className="stat-icon"><i className="fa-solid fa-user-check"></i></div><div className="stat-num">{stats.pending_validations}</div><div className="stat-label">Pending Validations</div></div>
        <div className="stat-card ring-progress"><div className="stat-icon"><i className="fa-solid fa-hourglass-half"></i></div><div className="stat-num">{stats.pending_applications}</div><div className="stat-label">Pending Assistance</div></div>
        <div className="stat-card ring-resolved"><div className="stat-icon"><i className="fa-solid fa-hand-holding-dollar"></i></div><div className="stat-num">{stats.released_assistance}</div><div className="stat-label">Assistance Released</div></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h3><i className="fa-solid fa-user-check"></i> Farmers Awaiting Validation</h3></div>
        <ul className="detail-list">
          {pendingValidations.length === 0 && <li className="hint-text" style={{ listStyle: "none" }}>All farmers are validated.</li>}
          {pendingValidations.map((f) => <li key={f.id}><span>{f.full_name}</span><b>{f.location || "—"}</b></li>)}
        </ul>
      </div>
    </section>
  );
}
