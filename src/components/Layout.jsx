import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar, { NAV } from "./Sidebar.jsx";
import { logPageView } from "../lib/activity";
import Topbar from "./Topbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { tr } from "../lib/i18n";
import "./backBar.css";

const ROLE_LABEL = { farmer: "Registered Farmer", admin: "MAO Personnel", president: "Association President" };
const PROFILE_PATH = { farmer: "/farmer/profile", admin: "/admin/profile", president: "/president/profile" };

// "/admin/crops" -> "Crop Approval" (the sidebar label); falls back to the path
function pageLabel(role, pathname) {
  const flat = (NAV[role] || []).flatMap((i) => (i.group ? i.items : [i]));
  const hit = flat.filter((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
  return hit ? hit.label : pathname;
}

// "← Back" at the upper-left of every page except the dashboard: returns to the page you came from
// (dashboard -> Recent Assistance -> Back = dashboard). With no history it goes to the dashboard.
function BackBar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  if (location.pathname.replace(/\/+$/, "") === `/${role}`) return null;
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(`/${role}`));
  return (
    <div className="back-bar">
      <button type="button" className="back-btn" onClick={goBack}><i className="fa-solid fa-arrow-left"></i> {tr("Back")}</button>
    </div>
  );
}

export default function Layout({ role }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { logPageView(location.pathname, pageLabel(role, location.pathname)); }, [location.pathname, role]);

  return (
    <div className="app">
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={async () => { await logout(); navigate("/login"); }}
      />
      <div className="main-wrap">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} roleLabel={tr(ROLE_LABEL[role])} profilePath={PROFILE_PATH[role]} />
        <main className="content">
          <BackBar role={role} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
