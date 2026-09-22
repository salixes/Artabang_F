import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";

export default function FarmerPolicies() {
  const { farmer } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!farmer?.association_id) return;
    supabase.from("policies").select("*").eq("association_id", farmer.association_id).order("created_at", { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [farmer?.association_id]);

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-scroll"></i> Association Policies</h2></div>
      {!farmer?.association_id && <p className="hint-text"><i className="fa-solid fa-circle-info"></i> You are not currently a member of a farmers association.</p>}
      <div className="program-grid">
        {rows.map((p) => (
          <div className="panel" key={p.id}>
            <div className="panel-head"><h3><i className={`fa-solid ${p.icon || "fa-scroll"}`}></i> {p.title}</h3></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)" }}>{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
