import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar, { NAV } from "./Sidebar.jsx";
import { logPageView } from "../lib/activity";
import Topbar from "./Topbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const ROLE_LABEL = { farmer: "Registered Farmer", admin: "MAO Personnel", president: "Association President" };
const PROFILE_PATH = { farmer: "/farmer/profile", admin: "/admin/profile", president: "/president/profile" };

// "/admin/crops" -> "Crop Approval" (the sidebar label); falls back to the path
function pageLabel(role, pathname) {
  const flat = (NAV[role] || []).flatMap((i) => (i.group ? i.items : [i]));
  const hit = flat.filter((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
  return hit ? hit.label : pathname;
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
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} roleLabel={ROLE_LABEL[role]} profilePath={PROFILE_PATH[role]} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
