import React from "react";
import { useTheme } from "../../context/ThemeContext.jsx";
import { tr } from "../../lib/i18n";

export default function Settings() {
  const { dark, toggleTheme } = useTheme();

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-gear"></i> {tr("Settings")}</h2></div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3><i className={`fa-solid ${dark ? "fa-moon" : "fa-sun"}`}></i> {tr("Appearance")}</h3></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 10px" }}>
          <span>{tr("Dark Mode")} <small style={{ color: "var(--ink-soft)" }}>{tr(" (you can also use the sun / moon button at the top)")}</small></span>
          <button className="btn-ghost" onClick={toggleTheme}>{dark ? "Switch to Light" : "Switch to Dark"}</button>
        </div>
      </div>
    </section>
  );
}
