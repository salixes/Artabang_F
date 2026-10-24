import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { tr } from "../lib/i18n";
import "./sidebarSpacing.css";

export const NAV = {
  farmer: [
    { to: "/farmer", label: "Dashboard", icon: "fa-seedling", end: true },
    {
      group: "Notifications", icon: "fa-bell",
      items: [
        { to: "/farmer/notifications", label: "Notifications" },
        { to: "/farmer/announcements", label: "Announcements" },
      ],
    },
    { to: "/farmer/profile", label: "My Profile", icon: "fa-id-card" },
    { to: "/farmer/rsbsa", label: "RSBSA Enrollment", icon: "fa-file-signature" },
    { to: "/farmer/crops", label: "Crop Registration", icon: "fa-tractor" },
    { to: "/farmer/yield", label: "My Yield Records", icon: "fa-wheat-awn" },
    {
      group: "Assistance Programs", icon: "fa-list-check",
      items: [
        { to: "/farmer/assistance", label: "My Assistance" },
        { to: "/farmer/eligibility", label: "My Eligibility" },
        { to: "/farmer/insurance", label: "Crop Insurance Records" },
      ],
    },
    { to: "/farmer/policies", label: "Association Policies", icon: "fa-scroll" },
    { to: "/farmer/activity-log", label: "Activity Log", icon: "fa-clock-rotate-left" },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: "fa-chart-line", end: true },
    {
      group: "Notifications", icon: "fa-bell",
      items: [
        { to: "/admin/notifications", label: "Notifications" },
        { to: "/admin/announcements", label: "Announcements" },
      ],
    },
    { to: "/admin/farmers", label: "Farmer Profiling", icon: "fa-people-group" },
    { to: "/admin/rsbsa-validation", label: "RSBSA Validation", icon: "fa-file-circle-check" },
    { to: "/admin/assistance", label: "Assistance Management", icon: "fa-hand-holding-dollar" },
    {
      group: "Reports", icon: "fa-chart-pie",
      items: [
        { to: "/admin/insurance", label: "Crop Insurance Reports" },
        { to: "/admin/reports", label: "Assistance Reports" },
        { to: "/admin/yield", label: "Yield Reports" },
      ],
    },
    { to: "/admin/crops", label: "Crop Approval", icon: "fa-seedling" },
    { to: "/admin/association", label: "Farmers Association", icon: "fa-flag" },
    { to: "/admin/activity-log", label: "Activity Log", icon: "fa-clock-rotate-left" },
    { to: "/admin/profile", label: "Admin Profile", icon: "fa-id-badge" },
  ],
  president: [
    { to: "/president", label: "Dashboard", icon: "fa-chart-line", end: true },
    { to: "/president/notifications", label: "Notifications", icon: "fa-bell" },
    { to: "/president/association", label: "Membership Management", icon: "fa-people-group" },
    { to: "/president/farmers-profile", label: "Farmers Profile", icon: "fa-users" },
    { to: "/president/crops", label: "Crop/Plants Registered", icon: "fa-tractor" },
    {
      group: "Assistance Distribution", icon: "fa-hand-holding-dollar",
      items: [
        { to: "/president/assistance", label: "Assistance Distribution" },
        { to: "/president/qualification", label: "Qualification Check" },
      ],
    },
    { to: "/president/announcements", label: "Announcements", icon: "fa-bullhorn" },
    { to: "/president/reports", label: "Transparency Reports", icon: "fa-file-invoice" },
    { to: "/president/policies", label: "Policy Management", icon: "fa-scroll" },
    { to: "/president/activity-log", label: "Activity Log", icon: "fa-clock-rotate-left" },
    { to: "/president/profile", label: "President Profile", icon: "fa-id-badge" },
  ],
};

const ROLE_LABEL = { farmer: "Farmer Access", admin: "ADMIN Access", president: "President Access" };

export default function Sidebar({ role, collapsed, onToggleCollapse, mobileOpen, onCloseMobile, onLogout }) {
  const location = useLocation();
  const items = NAV[role] || [];
  const initialOpen = {};
  items.forEach((item) => {
    if (item.group && item.items.some((s) => location.pathname.startsWith(s.to))) initialOpen[item.group] = true;
  });
  const [openGroups, setOpenGroups] = useState(initialOpen);

  // admin: how many crop registrations / change requests are waiting for approval
  const [pendingCrops, setPendingCrops] = useState(0);
  const [pendingRsbsa, setPendingRsbsa] = useState(0);
  useEffect(() => {
    if (role !== "admin") return undefined;
    let live = true;
    const count = async () => {
      const { count: n } = await supabase.from("crop_registrations").select("id", { count: "exact", head: true }).eq("status", "Pending");
      if (live) setPendingCrops(n || 0);
      const { count: r } = await supabase.from("rsbsa_submissions").select("id", { count: "exact", head: true }).eq("status", "Pending");
      if (live) setPendingRsbsa(r || 0);
    };
    count();
    const timer = setInterval(count, 30000);
    return () => { live = false; clearInterval(timer); };
  }, [role, location.pathname]);

  return (
    <>
      <div className={`mobile-overlay ${mobileOpen ? "show" : ""}`} onClick={onCloseMobile}></div>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <img src="/agritabang-logo.png" alt={tr("AgriTabang")} width="40" height="40" style={{ objectFit: "contain" }} />
          </div>
          <div className="brand-text">
            <span className="brand-name">{tr("Agri")}<em>{tr("Tabang")}</em></span>
            <span className="brand-tag">{tr("Farmer Profiling & Assistance Management")}</span>
          </div>
          <button className="collapse-btn" onClick={onToggleCollapse} aria-label={tr("Collapse sidebar")}>
            <i className="fa-solid fa-angles-left"></i>
          </button>
        </div>

        <div className="session-badge">
          <i className="fa-solid fa-shield-halved"></i>
          <div><span>{tr(ROLE_LABEL[role])}</span><small>{tr("Supabase session active")}</small></div>
        </div>

        <nav className="side-nav">
          {items.map((item, i) =>
            item.group ? (
              <div className="nav-group" key={i}>
                <a
                  href="#"
                  className="nav-link nav-parent-label"
                  onClick={(e) => { e.preventDefault(); setOpenGroups((g) => ({ ...g, [item.group]: !g[item.group] })); }}
                >
                  <i className={`fa-solid ${item.icon}`}></i><span>{tr(item.group)}</span>
                  <i className="fa-solid fa-chevron-down nav-caret"></i>
                </a>
                <div className={`nav-submenu ${openGroups[item.group] ? "open" : ""}`}>
                  {item.items.map((sub) => (
                    <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `nav-link nav-sublink ${isActive ? "active" : ""}`} onClick={onCloseMobile}>
                      <span>{tr(sub.label)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={onCloseMobile}>
                <i className={`fa-solid ${item.icon}`}></i><span>{tr(item.label)}</span>
                {role === "admin" && item.to === "/admin/crops" && pendingCrops > 0 && <b className="nav-count" title={`${pendingCrops} waiting for approval`}>{pendingCrops}</b>}
                {role === "admin" && item.to === "/admin/rsbsa-validation" && pendingRsbsa > 0 && <b className="nav-count" title={`${pendingRsbsa} forms waiting for validation`}>{pendingRsbsa}</b>}
              </NavLink>
            )
          )}
          <a href="#" className="nav-link nav-logout" onClick={(e) => { e.preventDefault(); onLogout(); }}>
            <i className="fa-solid fa-right-from-bracket"></i><span>{tr("Logout")}</span>
          </a>
        </nav>

        <div className="sidebar-foot">
          <div className="ring-mini" aria-hidden="true">
            <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><circle cx="20" cy="20" r="16" fill="none" stroke="#C89B3C" strokeWidth="3" strokeDasharray="100.5" strokeDashoffset="30" strokeLinecap="round" /></svg>
          </div>
          <p>{tr("Barangay Lindaban")}<br /><span>{tr("Manolo Fortich, Bukidnon")}</span></p>
        </div>
      </aside>
    </>
  );
}
