import React from "react";

// Profile picture. With no photo it shows an "Add profile" placeholder (no cartoon avatar).
export default function Avatar({ src, name = "", size = 88, onClick, style, border = "3px solid var(--sage-pale)" }) {
  const base = { width: size, height: size, borderRadius: "50%", flex: "none", display: "inline-flex", ...style };
  const clickable = typeof onClick === "function";
  const props = clickable ? { onClick, role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") onClick(e); }, title: src ? "Change profile" : "Add profile" } : {};

  if (src) {
    return (
      <span className="avatar-x" style={{ ...base, cursor: clickable ? "pointer" : undefined }} {...props}>
        <img src={src} alt={name || "Profile"} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border, margin: 0 }} />
      </span>
    );
  }
  const tiny = size < 56;
  return (
    <span className={`avatar-x avatar-add${clickable ? " clickable" : ""}`} style={base} aria-label="Add profile" {...props}>
      {!tiny && <i className="fa-solid fa-camera" style={{ fontSize: Math.round(size * 0.2) }}></i>}
      <b style={{ fontSize: tiny ? Math.max(7, Math.round(size * 0.2)) : Math.max(11, Math.round(size * 0.13)) }}>{tiny ? <>Add<br />profile</> : "Add profile"}</b>
    </span>
  );
}
