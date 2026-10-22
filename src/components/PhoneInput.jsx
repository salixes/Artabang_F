import React, { useRef, useState } from "react";

export const PHONE_LEN = 11;
export const phoneDigits = (s) => String(s || "").replace(/\D/g, "");

// message for a contact number, or "" when it is fine
export function phoneError(value, { required = false } = {}) {
  const d = phoneDigits(value);
  if (!d) return required ? "Contact number is required." : "";
  if (d.length > PHONE_LEN) return "Contact number can't be more than 11 digits.";
  if (d.length < PHONE_LEN) return `Contact number must be exactly 11 digits (you entered ${d.length}).`;
  return "";
}

const RED = "#c0392b";

// Contact number box: digits only, never more than 11. Typing or pasting past 11 digits
// turns the box red (the extra digits are not accepted); fewer than 11 shows red once you leave the box.
export default function PhoneInput({ value, onChange, required = false, placeholder = "09XXXXXXXXX", id }) {
  const [over, setOver] = useState(false);
  const [touched, setTouched] = useState(false);
  const timer = useRef(null);
  const digits = phoneDigits(value);
  const short = touched && digits.length > 0 && digits.length < PHONE_LEN;
  const bad = over || short;

  function handle(e) {
    const d = phoneDigits(e.target.value);
    if (d.length > PHONE_LEN) {
      setOver(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOver(false), 3000);
      onChange(d.slice(0, PHONE_LEN));
      return;
    }
    setOver(false);
    onChange(d);
  }

  return (
    <span style={{ display: "block" }}>
      <input
        id={id} type="tel" inputMode="numeric" autoComplete="tel" value={digits} onChange={handle} onBlur={() => setTouched(true)}
        placeholder={placeholder} required={required} aria-invalid={bad}
        style={bad ? { borderColor: RED, boxShadow: "0 0 0 3px rgba(192,57,43,.16)", background: "#fff6f5" } : undefined}
      />
      <small style={{ display: "block", marginTop: 4, fontSize: ".72rem", color: bad ? RED : "var(--ink-soft)", fontWeight: bad ? 700 : 400 }}>
        {digits.length}/{PHONE_LEN}{over ? " — can't be more than 11 digits" : short ? " — must be exactly 11 digits" : ""}
      </small>
    </span>
  );
}
