import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function FarmerAnnouncements() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => setRows(data || []));
  }, []);
  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-bullhorn"></i> Announcements</h2></div>
      <div className="announce-grid">
        {rows.length === 0 && <p className="hint-text">No announcements yet.</p>}
        {rows.map((a) => (
          <div className="panel" key={a.id}>
            <div className="panel-head"><h3><i className={`fa-solid ${a.icon || "fa-bullhorn"}`}></i> {a.title}</h3></div>
            <p style={{ padding: "0 4px 8px", fontSize: ".85rem", color: "var(--ink-soft)" }}>{a.body}</p>
            <small style={{ padding: "0 4px", color: "var(--ink-soft)" }}>{new Date(a.created_at).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
