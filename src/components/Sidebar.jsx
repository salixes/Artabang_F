import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const NAV = {
  farmer: [
    { to: "/farmer", label: "Dashboard", icon: "fa-seedling", end: true },
    {
      group: "Notifications", icon: "fa-bell",
      items: [
        { to: "/farmer/notifications", label: "Notifications" },
        { to: "/farmer/announcements", label: "Announcements" },
        { to: "/farmer/activity", label: "Activity and History" },
      ],
    },
    { to: "/farmer/profile", label: "My Profile", icon: "fa-id-card" },
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
    { to: "/admin/requests", label: "Crop Change Requests", icon: "fa-file-circle-check" },
    { to: "/admin/yield", label: "Yield Reports", icon: "fa-file-lines" },
    { to: "/admin/insurance", label: "Crop Insurance Records", icon: "fa-shield-heart" },
    { to: "/admin/assistance", label: "Assistance Management", icon: "fa-hand-holding-dollar" },
    { to: "/admin/reports", label: "Assistance Reports", icon: "fa-chart-pie" },
    { to: "/admin/association", label: "Farmers Association", icon: "fa-flag" },
    { to: "/admin/profile", label: "Admin Profile", icon: "fa-id-badge" },
    { to: "/admin/settings", label: "Settings", icon: "fa-gear" },
  ],
  president: [
    { to: "/president", label: "Dashboard", icon: "fa-chart-line", end: true },
    { to: "/president/notifications", label: "Notifications", icon: "fa-bell" },
    { to: "/president/validation", label: "Farmer Validation", icon: "fa-user-check" },
    { to: "/president/association", label: "Membership Management", icon: "fa-people-group" },
    { to: "/president/requests", label: "Farmers Profile", icon: "fa-file-circle-check" },
    { to: "/president/crops", label: "Crop Registered Farmers", icon: "fa-tractor" },
    { to: "/president/qualification", label: "Qualification Check", icon: "fa-clipboard-check" },
    { to: "/president/assistance", label: "Assistance Distribution", icon: "fa-hand-holding-dollar" },
    { to: "/president/announcements", label: "Announcements", icon: "fa-bullhorn" },
    { to: "/president/reports", label: "Transparency Reports", icon: "fa-chart-pie" },
    { to: "/president/policies", label: "Policy Management", icon: "fa-scroll" },
    { to: "/president/meetings", label: "Meetings & Attendance", icon: "fa-people-roof" },
    { to: "/president/profile", label: "President Profile", icon: "fa-id-badge" },
    { to: "/president/settings", label: "Settings", icon: "fa-gear" },
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

  return (
    <>
      <div className={`mobile-overlay ${mobileOpen ? "show" : ""}`} onClick={onCloseMobile}></div>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <img src="/agritabang-logo.png" alt="AgriTabang" width="40" height="40" style={{ objectFit: "contain" }} />
          </div>
          <div className="brand-text">
            <span className="brand-name">Agri<em>Tabang</em></span>
            <span className="brand-tag">Farmer Profiling &amp; Assistance Management</span>
          </div>
          <button className="collapse-btn" onClick={onToggleCollapse} aria-label="Collapse sidebar">
            <i className="fa-solid fa-angles-left"></i>
          </button>
        </div>

        <div className="session-badge">
          <i className="fa-solid fa-shield-halved"></i>
          <div><span>{ROLE_LABEL[role]}</span><small>Supabase session active</small></div>
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
                  <i className={`fa-solid ${item.icon}`}></i><span>{item.group}</span>
                  <i className="fa-solid fa-chevron-down nav-caret"></i>
                </a>
                <div className={`nav-submenu ${openGroups[item.group] ? "open" : ""}`}>
                  {item.items.map((sub) => (
                    <NavLink key={sub.to} to={sub.to} className={({ isActive }) => `nav-link nav-sublink ${isActive ? "active" : ""}`} onClick={onCloseMobile}>
                      <span>{sub.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={onCloseMobile}>
                <i className={`fa-solid ${item.icon}`}></i><span>{item.label}</span>
              </NavLink>
            )
          )}
          <a href="#" className="nav-link nav-logout" onClick={(e) => { e.preventDefault(); onLogout(); }}>
            <i className="fa-solid fa-right-from-bracket"></i><span>Logout</span>
          </a>
        </nav>

        <div className="sidebar-foot">
          <div className="ring-mini" aria-hidden="true">
            <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="3" /><circle cx="20" cy="20" r="16" fill="none" stroke="#C89B3C" strokeWidth="3" strokeDasharray="100.5" strokeDashoffset="30" strokeLinecap="round" /></svg>
          </div>
          <p>Barangay Lindaban<br /><span>Manolo Fortich, Bukidnon</span></p>
        </div>
      </aside>
    </>
  );
}
