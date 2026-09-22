import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatPeso } from "../../lib/businessRules";

export default function FarmerDashboard() {
  const { farmer, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalYield: 0, assistanceCount: 0, insuranceCount: 0, pendingCount: 0 });
  const [recentAssistance, setRecentAssistance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (!farmer?.id) return;
    (async () => {
      const [{ data: yieldRows }, { data: assistRows }, { data: insRows }, { data: announceRows }] = await Promise.all([
        supabase.from("yield_records").select("quantity_kg").eq("farmer_id", farmer.id).eq("status", "Verified"),
        supabase.from("assistance_records").select("*").eq("farmer_id", farmer.id).order("requested_at", { ascending: false }),
        supabase.from("insurance_registrations").select("id").eq("farmer_id", farmer.id),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(2),
      ]);
      const totalYield = (yieldRows || []).reduce((s, y) => s + Number(y.quantity_kg), 0);
      setStats({
        totalYield,
        assistanceCount: assistRows?.length || 0,
        insuranceCount: insRows?.length || 0,
        pendingCount: (assistRows || []).filter((a) => a.status === "Pending" || a.status === "Under Review").length,
      });
      setRecentAssistance((assistRows || []).slice(0, 5));
      setAnnouncements(announceRows || []);
    })();
  }, [farmer?.id]);

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

      <div className="welcome-card">
        <div className="welcome-text">
          <span className="eyebrow">Barangay Lindaban · Registered Farmer</span>
          <h1>Welcome, {profile?.full_name?.split(" ")[0] || "Farmer"}!</h1>
          <p>Track your farm profile, harvest records, and assistance received from the Municipal Agriculture Office.</p>
          <button className="btn-gold" onClick={() => navigate("/farmer/yield")}><i className="fa-solid fa-plus"></i> Report New Yield</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card ring-total"><div className="stat-icon"><i className="fa-solid fa-wheat-awn"></i></div><div className="stat-num">{stats.totalYield.toLocaleString()}</div><div className="stat-label">Verified Yield (kg)</div></div>
        <div className="stat-card ring-progress"><div className="stat-icon"><i className="fa-solid fa-hand-holding-dollar"></i></div><div className="stat-num">{stats.assistanceCount}</div><div className="stat-label">Assistance Records</div></div>
        <div className="stat-card ring-pending"><div className="stat-icon"><i className="fa-solid fa-hourglass-half"></i></div><div className="stat-num">{stats.pendingCount}</div><div className="stat-label">Pending Applications</div></div>
        <div className="stat-card ring-resolved"><div className="stat-icon"><i className="fa-solid fa-shield-heart"></i></div><div className="stat-num">{stats.insuranceCount}</div><div className="stat-label">Crops Insured</div></div>
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head"><h3><i className="fa-solid fa-hand-holding-dollar"></i> Recent Assistance</h3><a href="#" className="link-more" onClick={(e) => { e.preventDefault(); navigate("/farmer/assistance"); }}>View all</a></div>
          <div className="table-panel no-shadow">
            <table className="data-table compact">
              <thead><tr><th>Type</th><th>Value</th><th>Status</th></tr></thead>
              <tbody>
                {recentAssistance.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No assistance records yet.</td></tr>}
                {recentAssistance.map((a) => (
                  <tr key={a.id}><td>{a.assistance_type}</td><td>{a.value_description || "—"}</td><td>{a.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
