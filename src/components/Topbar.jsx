import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

export default function Topbar({ onOpenMobileMenu, roleLabel, profilePath }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (active) setNotifications(data || []); });

    const channel = supabase
      .channel(`notif-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` },
        (payload) => setNotifications((prev) => [payload.new, ...prev]))
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [profile?.id]);

  const unread = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!profile?.id) return;
    await supabase.from("notifications").update({ read: true }).eq("recipient_id", profile.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={onOpenMobileMenu} aria-label="Open menu"><i className="fa-solid fa-bars"></i></button>
      <div className="topbar-search"><i className="fa-solid fa-magnifying-glass"></i><input placeholder="Search farmers, crops, assistance records…" /></div>
      <div className="topbar-widgets">
        <div className="clock-widget">
          <i className="fa-regular fa-clock"></i>
          <div>
            <span>{now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
            <small>{now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</small>
          </div>
        </div>

        <div className="notif-wrap">
          <button className="icon-btn" onClick={() => { setNotifOpen((v) => !v); setAvatarOpen(false); if (!notifOpen) markAllRead(); }} aria-label="Notifications">
            <i className="fa-solid fa-bell"></i>
            {unread > 0 && <span className="notif-badge">{unread}</span>}
          </button>
          <div className={`notif-panel ${notifOpen ? "" : "hidden"}`}>
            <h4>Notifications</h4>
            {notifications.length === 0 && <p className="hint-text">No notifications yet.</p>}
            {notifications.map((n) => (
              <div className="notif-item" key={n.id}>
                <i className={`fa-solid ${n.icon || "fa-bell"} ${n.read ? "" : "gold"}`}></i>
                <p dangerouslySetInnerHTML={{ __html: n.message }} />
                <small>{new Date(n.created_at).toLocaleString("en-PH")}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="avatar-wrap">
          <button className="avatar-btn" onClick={() => { setAvatarOpen((v) => !v); setNotifOpen(false); }}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile?.avatar_seed || profile?.full_name || "user")}&backgroundColor=b6e3b6`} alt="avatar" />
          </button>
          <div className={`avatar-menu ${avatarOpen ? "" : "hidden"}`}>
            <p className="avatar-name">{profile?.full_name}</p>
            <p className="avatar-role">{roleLabel}</p>
            <a href="#" onClick={(e) => { e.preventDefault(); setAvatarOpen(false); navigate(profilePath); }}><i className="fa-solid fa-id-card"></i> My Profile</a>
            <a href="#" className="avatar-logout" onClick={async (e) => { e.preventDefault(); await logout(); navigate("/login"); }}><i className="fa-solid fa-right-from-bracket"></i> Logout</a>
          </div>
        </div>
      </div>
    </header>
  );
}
