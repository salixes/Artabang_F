import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentAssistance, setRecentAssistance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  async function load() {
    const [{ data: statRow }, { data: assist }, { data: announce }, { data: directory }] = await Promise.all([
      supabase.from("dashboard_stats").select("*").single(),
      supabase.from("assistance_records").select("id, farmer_id, assistance_type, source").order("requested_at", { ascending: false }).limit(6),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(2),
      supabase.from("farmer_directory").select("id, full_name"),
    ]);
    const nameById = Object.fromEntries((directory || []).map((d) => [d.id, d.full_name]));
    setStats(statRow);
    setRecentAssistance((assist || []).map((a) => ({ ...a, farmer_name: nameById[a.farmer_id] || "—" })));
    setAnnouncements(announce || []);
  }
  useEffect(() => { load(); }, []);

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
        <span className="eyebrow">Barangay Lindaban · Municipal Agriculture Office</span>
        <h1>Welcome, Agricultural Personnel</h1>
        <p>Overview of registered farmers, recorded yield, and assistance distribution for Barangay Lindaban.</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card ring-total"><div className="stat-icon"><i className="fa-solid fa-people-group"></i></div><div className="stat-num">{stats.total_farmers}</div><div className="stat-label">Total Registered Farmers</div></div>
        <div className="stat-card ring-pending"><div className="stat-icon"><i className="fa-solid fa-wheat-awn"></i></div><div className="stat-num">{Number(stats.total_yield_kg).toLocaleString()}</div><div className="stat-label">Total Yield Recorded (kg)</div></div>
        <div className="stat-card ring-progress"><div className="stat-icon"><i className="fa-solid fa-hand-holding-dollar"></i></div><div className="stat-num">{stats.total_assistance_records}</div><div className="stat-label">Assistance Records</div></div>
        <div className="stat-card ring-resolved"><div className="stat-icon"><i className="fa-solid fa-shield-heart"></i></div><div className="stat-num">{stats.insurance_claims}</div><div className="stat-label">Crop Insurance Claims</div></div>
      </div>
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head"><h3><i className="fa-solid fa-hand-holding-dollar"></i> Recent Assistance Records</h3><a href="#" className="link-more" onClick={(e) => { e.preventDefault(); navigate("/admin/assistance"); }}>View all</a></div>
          <div className="table-panel no-shadow">
            <table className="data-table compact">
              <thead><tr><th>Farmer</th><th>Type</th><th>Source</th></tr></thead>
              <tbody>
                {recentAssistance.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No records yet.</td></tr>}
                {recentAssistance.map((r) => (
                  <tr key={r.id}><td>{r.farmer_name}</td><td>{r.assistance_type}</td><td>{r.source}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
