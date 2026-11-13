import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { tr } from "../../lib/i18n";

// Farmers can only READ the association's policies. The president adds, edits and deletes them.
export default function FarmerPolicies() {
  const { farmer } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!farmer) return;
    // every farmer sees the policies for ALL associations, plus the ones of his / her own association
    const base = () => supabase.from("policies").select("*").or(farmer.association_id ? `association_id.eq.${farmer.association_id},association_id.is.null` : "association_id.is.null");
    base().order("sort_order", { ascending: true }).order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error) return setRows(data || []);
        return base().order("created_at", { ascending: true }).then(({ data: d2 }) => setRows(d2 || [])); // SQL file not run yet
      });
  }, [farmer?.id, farmer?.association_id]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((p) => !s || `${p.title} ${p.body}`.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-scroll"></i> {tr("Association Policies")}</h2>
        {rows && rows.length > 0 && <div className="head-actions"><label className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input placeholder={tr("Search policies…")} value={q} onChange={(e) => setQ(e.target.value)} /></label></div>}
      </div>
      {!farmer?.association_id && <p className="hint-text"><i className="fa-solid fa-circle-info"></i> {tr("You are not currently a member of a farmers association.")} {tr("Ask the admin to add you to your association.")}</p>}
      {rows && rows.length > 0 && <p className="hint-text"><i className="fa-solid fa-eye"></i> <span>{tr("View only — your association's president manages these policies.")}</span></p>}
      {rows && rows.length === 0 && <p className="hint-text">{tr("No policies have been published yet.")}</p>}
      {rows && rows.length > 0 && filtered.length === 0 && <p className="hint-text">{tr("No policies match your search.")}</p>}

      <div className="policy-list">
        {filtered.map((p) => (
          <article className="panel policy-card" key={p.id}>
            <div className="panel-head"><h3><i className={`fa-solid ${p.icon || "fa-scroll"}`}></i> {p.title}</h3></div>
            <p className="policy-body">{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
