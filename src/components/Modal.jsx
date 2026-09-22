import React from "react";

export default function Modal({ open, onClose, title, icon = "fa-circle-info", children, wide = false }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined}>
        <div className="modal-head">
          <h3><i className={`fa-solid ${icon}`}></i> {title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
