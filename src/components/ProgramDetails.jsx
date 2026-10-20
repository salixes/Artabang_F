import React from "react";
import { programDetailRows } from "../lib/assistancePrograms";
import "./programDetails.css";

// "What is being given" for a posted assistance (amount, seed type, quantity ...)
export default function ProgramDetails({ type, details }) {
  const rows = programDetailRows(type, details);
  if (!rows.length) return null;
  return (
    <ul className="pd-list">
      {rows.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}
    </ul>
  );
}

// The input fields for one kind of assistance. `fields` comes from PROGRAM_FIELDS / RELEASE_FIELDS.
export function DynamicFields({ fields, values, onChange, requiredAttr = false }) {
  return (
    <div className="rsbsa-grid">
      {fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => (
        <label key={f.key}>
          {f.label}{f.required && <span style={{ color: "var(--danger)" }}> *</span>}
          {f.type === "select" ? (
            <select value={values[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} required={requiredAttr && f.required}>
              <option value="">Select…</option>
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.type} value={values[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)}
              min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined}
              placeholder={f.placeholder} required={requiredAttr && f.required}
            />
          )}
        </label>
      ))}
    </div>
  );
}
