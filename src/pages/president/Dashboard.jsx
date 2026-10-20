import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ReportSummary from "../../components/ReportSummary.jsx";
import { ReleasedPieCard } from "../../components/ReleasedPie.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function PresidentDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState(0); // farmers who belong to an association

  useEffect(() => {
    (async () => {
      const [{ data: statRow }, { data: announce }, { count: memberCount }] = await Promise.all([
        supabase.from("dashboard_stats").select("*").single(),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(2),
        supabase.from("farmers").select("id", { count: "exact", head: true }).eq("is_association_member", true),
      ]);
      setMembers(memberCount || 0);
      setStats(statRow);
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
        <p>Oversight of association membership, assistance distribution, and yield for Barangay Lindaban.</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card ring-total"><div className="stat-icon"><i className="fa-solid fa-people-group"></i></div><div className="stat-num">{stats.total_farmers}</div><div className="stat-label">Total Registered Farmers</div></div>
        <div className="stat-card ring-progress"><div className="stat-icon"><i className="fa-solid fa-hourglass-half"></i></div><div className="stat-num">{stats.pending_applications}</div><div className="stat-label">Pending Assistance</div></div>
        <div className="stat-card ring-resolved"><div className="stat-icon"><i className="fa-solid fa-hand-holding-dollar"></i></div><div className="stat-num">{stats.released_assistance}</div><div className="stat-label">Assistance Released</div></div>
        <div className="stat-card ring-total"><div className="stat-icon"><i className="fa-solid fa-users"></i></div><div className="stat-num">{members}</div><div className="stat-label">Association Members</div></div>
      </div>
      <ReleasedPieCard title="Assistance already released" />

      <ReportSummary basePath="/president" />
    </section>
  );
}
