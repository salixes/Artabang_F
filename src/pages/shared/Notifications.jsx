import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";

export default function NotificationsPage() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("notifications").select("*").eq("recipient_id", profile.id).order("created_at", { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [profile?.id]);

  function openNotification(n) {
    if (n.category === "announcement") navigate(`/${role}/announcements`);
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-bell"></i> Notifications</h2></div>
      <div className="activity-list">
        {rows.length === 0 && <p className="hint-text">No notifications yet.</p>}
        {rows.map((n) => (
          <div className="notif-item" key={n.id} style={n.category === "announcement" ? { cursor: "pointer" } : undefined} onClick={() => openNotification(n)}>
            <i className={`fa-solid ${n.icon || "fa-bell"} ${n.read ? "" : "gold"}`}></i>
            <p dangerouslySetInnerHTML={{ __html: n.message }} />
            <small>{new Date(n.created_at).toLocaleString("en-PH")}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
