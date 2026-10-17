import React from "react";
import { useTheme } from "../../context/ThemeContext.jsx";

export default function Settings() {
  const { dark, toggleTheme } = useTheme();

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-gear"></i> Settings</h2></div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3><i className={`fa-solid ${dark ? "fa-moon" : "fa-sun"}`}></i> Appearance</h3></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 10px" }}>
          <span>Dark Mode <small style={{ color: "var(--ink-soft)" }}>&nbsp;(you can also use the sun / moon button at the top)</small></span>
          <button className="btn-ghost" onClick={toggleTheme}>{dark ? "Switch to Light" : "Switch to Dark"}</button>
        </div>
      </div>
    </section>
  );
}
