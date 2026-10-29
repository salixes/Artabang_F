import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Avatar from "./Avatar.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import { notificationPath } from "../lib/assistancePrograms";
import { tr } from "../lib/i18n";
import "./notifPanel.css";

export default function Topbar({ onOpenMobileMenu, roleLabel, profilePath }) {
  const { profile, role, logout, farmer } = useAuth();
  // farmers keep their photo on the farmer record; admin / president on their profile
  const photo = role === "farmer" ? farmer?.photo_url : profile?.avatar_url;
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { lang, languages, chooseLanguage } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [freshIds, setFreshIds] = useState(() => new Set()); // which notifications were new when the bell was opened
  const [notifHover, setNotifHover] = useState(false);
  const [notifPulse, setNotifPulse] = useState(0); // bump = restart the 5-second countdown

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
      .limit(100)
      .then(({ data }) => { if (active) setNotifications(data || []); });

    const channel = supabase
      .channel(`notif-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` },
        (payload) => setNotifications((prev) => [payload.new, ...prev]))
      .subscribe();

    // fallback: re-check every 30 s in case the live connection is off
    const poll = setInterval(() => {
      supabase.from("notifications").select("*").eq("recipient_id", profile.id).order("created_at", { ascending: false }).limit(100)
        .then(({ data }) => { if (active && data) setNotifications(data); });
    }, 30000);

    return () => { active = false; clearInterval(poll); supabase.removeChannel(channel); };
  }, [profile?.id]);

  const unread = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!profile?.id) return;
    await supabase.from("notifications").update({ read: true }).eq("recipient_id", profile.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  // the bell list vanishes by itself after 5 seconds of not touching it (hover / touch / scroll keeps it open)
  useEffect(() => {
    if (!notifOpen || notifHover) return undefined;
    const t = setTimeout(() => setNotifOpen(false), 5000);
    return () => clearTimeout(t);
  }, [notifOpen, notifHover, notifPulse]);

  function toggleNotif() {
    setAvatarOpen(false);
    if (notifOpen) return setNotifOpen(false);
    const fresh = notifications.filter((n) => !n.read);
    setFreshIds(new Set(fresh.map((n) => n.id)));
    setNotifHover(false);
    setNotifOpen(true);
    if (fresh.length) markAllRead();
  }
  function openNotif(n) {
    const to = notificationPath(n, role);
    setNotifOpen(false);
    if (to) navigate(to); // opens the panel it belongs to
  }

  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={onOpenMobileMenu} aria-label={tr("Open menu")}><i className="fa-solid fa-bars"></i></button>
      <GlobalSearch />
      <div className="topbar-widgets">
        <div className="clock-widget">
          <i className="fa-regular fa-clock"></i>
          <div>
            <span>{now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</span>
            <small>{now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</small>
          </div>
        </div>

        {/* sun = click for light mode (shown in dark) · moon = click for dark mode (shown in light) */}
        <button
          className="icon-btn theme-toggle"
          onClick={toggleTheme}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <i className={`fa-solid ${dark ? "fa-sun" : "fa-moon"}`}></i>
        </button>

        <div className="notif-wrap">
          <button className="icon-btn" onClick={toggleNotif} aria-label={tr("Notifications")}>
            <i className="fa-solid fa-bell"></i>
            {unread > 0 && <span className="notif-badge">{unread}</span>}
          </button>
          {notifOpen && (
            <div
              className="notif-panel"
              onMouseEnter={() => setNotifHover(true)} onMouseLeave={() => setNotifHover(false)}
              onTouchStart={() => setNotifPulse((p) => p + 1)} onScroll={() => setNotifPulse((p) => p + 1)}
            >
              <h4>{tr("Notifications")}</h4>
              {notifications.length === 0 && <p className="hint-text">{tr("No notifications yet.")}</p>}
              {notifications.map((n) => (
                <div className={`notif-item ${freshIds.has(n.id) ? "is-new" : ""}`} key={n.id} onClick={() => openNotif(n)} style={{ cursor: notificationPath(n, role) ? "pointer" : "default" }}>
                  <i className={`fa-solid ${n.icon || "fa-bell"} gold`}></i>
                  <p dangerouslySetInnerHTML={{ __html: n.message }} />
                  <small>{new Date(n.created_at).toLocaleString("en-PH")}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="avatar-wrap">
          <button className="avatar-btn" onClick={() => { setAvatarOpen((v) => !v); setNotifOpen(false); }}>
            <Avatar src={photo} name={profile?.full_name} size={38} border="2px solid var(--gold-light)" />
          </button>
          <div className={`avatar-menu ${avatarOpen ? "" : "hidden"}`}>
            <p className="avatar-name">{profile?.full_name}</p>
            <p className="avatar-role">{roleLabel}</p>
            <a href="#" onClick={(e) => { e.preventDefault(); setAvatarOpen(false); navigate(profilePath); }}><i className="fa-solid fa-id-card"></i> {tr("My Profile")}</a>
            {role === "farmer" && (
              <>
                <a href="#" className="avatar-lang-toggle" onClick={(e) => { e.preventDefault(); setLangOpen((v) => !v); }} aria-expanded={langOpen}>
                  <i className="fa-solid fa-language"></i> {tr("Language")} <i className={`fa-solid fa-chevron-${langOpen ? "up" : "down"} avatar-caret`}></i>
                </a>
                {langOpen && (
                  <div className="lang-list" role="listbox" aria-label="Language">
                    {languages.map((l) => (
                      <button type="button" key={l.code} role="option" aria-selected={lang === l.code} className={lang === l.code ? "on" : ""}
                        onClick={() => { chooseLanguage(l.code); setLangOpen(false); setAvatarOpen(false); }}>
                        <span>{l.label}</span>{lang === l.code && <i className="fa-solid fa-check"></i>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <a href="#" className="avatar-logout" onClick={async (e) => { e.preventDefault(); await logout(); navigate("/login"); }}><i className="fa-solid fa-right-from-bracket"></i> {tr("Logout")}</a>
          </div>
        </div>
      </div>
    </header>
  );
}
