import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { notificationPath } from "../../lib/assistancePrograms";
import { tr } from "../../lib/i18n";

export default function NotificationsPage() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    const fetchRows = () => supabase.from("notifications").select("*").eq("recipient_id", profile.id).order("created_at", { ascending: false })
      .then(({ data }) => setRows(data || []));
    fetchRows();
    const poll = setInterval(fetchRows, 30000);
    return () => clearInterval(poll);
  }, [profile?.id]);

  function openNotification(n) {
    const to = notificationPath(n, role);
    if (to) navigate(to);
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-bell"></i> {tr("Notifications")}</h2></div>
      <div className="activity-list">
        {rows.length === 0 && <p className="hint-text">{tr("No notifications yet.")}</p>}
        {rows.map((n) => (
          <div className="notif-item" key={n.id} style={notificationPath(n, role) ? { cursor: "pointer" } : undefined} onClick={() => openNotification(n)}>
            <i className={`fa-solid ${n.icon || "fa-bell"} ${n.read ? "" : "gold"}`}></i>
            <p dangerouslySetInnerHTML={{ __html: n.message }} />
            <small>{new Date(n.created_at).toLocaleString("en-PH")}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
