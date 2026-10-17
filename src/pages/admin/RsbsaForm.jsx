import React from "react";
import RsbsaPaper from "../../components/RsbsaPaper.jsx";
import { useRsbsaValues } from "../../lib/useRsbsaValues";

// View / Print a farmer's RSBSA Enrollment Form — the same two long bond
// sheets used for enrollment, filled with the saved answers.
export default function RsbsaForm({ farmer, onBack }) {
  const { loading, values } = useRsbsaValues(farmer);
  return (
    <section className="rp">
      <div className="rp-bar">
        <button className="rp-btn" onClick={onBack}>← Back to Farmer Profiling</button>
        <div className="rp-btns"><button className="rp-btn pri" onClick={() => window.print()}>Print (2 long bond sheets)</button></div>
      </div>
      {loading || !values
        ? <p className="hint-text" style={{ padding: 20 }}>Loading RSBSA form…</p>
        : <RsbsaPaper values={values} readOnly photoUrl={farmer.photo_url} />}
    </section>
  );
}
