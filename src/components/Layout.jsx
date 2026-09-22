import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const ROLE_LABEL = { farmer: "Registered Farmer", admin: "MAO Personnel", president: "Association President" };
const PROFILE_PATH = { farmer: "/farmer/profile", admin: "/admin/profile", president: "/president/profile" };

export default function Layout({ role }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

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
