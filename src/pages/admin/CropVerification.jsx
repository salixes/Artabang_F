import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";
import { StatusBadge } from "../../components/Badges.jsx";
import { PcicView } from "../farmer/PcicApplication.jsx";

// Admin verifies the crops farmers register. A crop only counts toward assistance
// eligibility once it is Verified; the farmer is notified of the result automatically.
export default function CropVerification() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [filter, setFilter] = useState("Pending");
  const [search, setSearch] = useState("");
  const [viewForm, setViewForm] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    const [{ data: crops }, { data: dir }] = await Promise.all([
      supabase.from("crop_registrations").select("*").order("registered_at", { ascending: false }),
      supabase.from("farmer_directory").select("id, full_name"),
    ]);
    setRows(crops || []);
    setNames(Object.fromEntries((dir || []).map((d) => [d.id, d.full_name])));
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    Pending: rows.filter((r) => r.status === "Pending").length,
    Verified: rows.filter((r) => r.status === "Verified").length,
    Rejected: rows.filter((r) => r.status === "Rejected").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (filter === "All" || r.status === filter)
      && (!q || (names[r.farmer_id] || "").toLowerCase().includes(q) || r.crop_name.toLowerCase().includes(q)));
  }, [rows, names, filter, search]);

  async function setStatus(row, status) {
    let remarks = null;
    if (status === "Rejected") {
      remarks = prompt(`Reason for rejecting ${names[row.farmer_id] || "this farmer"}'s ${row.crop_name} registration (the farmer will see this):`);
      if (remarks === null) return;
    }
    setBusy(row.id);
    const { error } = await supabase.from("crop_registrations").update({ status, remarks: remarks?.trim() || null }).eq("id", row.id);
    setBusy(null);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(`Crop registration ${status.toLowerCase()}. The farmer was notified.`, status === "Verified" ? "fa-circle-check" : "fa-circle-xmark");
    load();
  }

  if (viewForm) return <PcicView saved={viewForm} onBack={() => setViewForm(null)} />;

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-seedling"></i> Crop Verification</h2>
        <div className="head-actions">
          <label className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input placeholder="Search farmer or crop" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="Pending">Pending ({counts.Pending})</option>
            <option value="Verified">Verified ({counts.Verified})</option>
            <option value="Rejected">Rejected ({counts.Rejected})</option>
            <option value="All">All</option>
          </select>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> When a farmer registers a new crop it waits here. Verify it to count toward their assistance eligibility — they are notified automatically (and told straight away if they now qualify for posted assistance).</p>

      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Crop</th><th>Area (ha)</th><th>Planting date</th><th>Variety</th><th>Land / Tenure</th><th>Registered</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ink-soft)" }}>{filter === "Pending" ? "No crops waiting for verification." : "No crop registrations."}</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{names[r.farmer_id] || "—"}</td><td>{r.crop_name}</td><td>{r.area}</td><td>{r.planting_date}</td><td>{r.variety || "—"}</td>
                <td>{[r.land_category, r.tenurial_status].filter(Boolean).join(" · ") || "—"}</td>
                <td>{new Date(r.registered_at).toLocaleDateString("en-PH")}</td>
                <td><StatusBadge status={r.status} />{r.status === "Rejected" && r.remarks && <div style={{ fontSize: ".68rem", color: "var(--ink-soft)", marginTop: 2 }}>{r.remarks}</div>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.pcic_application && <button className="btn-ghost" title="View the PCIC application form" onClick={() => setViewForm(r.pcic_application)}><i className="fa-solid fa-file-lines"></i></button>}{" "}
                  {r.status !== "Verified" && <button className="btn-primary" style={{ padding: "5px 10px", fontSize: ".72rem" }} disabled={busy === r.id} onClick={() => setStatus(r, "Verified")}><i className="fa-solid fa-circle-check"></i> Verify</button>}{" "}
                  {r.status !== "Rejected" && <button className="btn-ghost" style={{ padding: "5px 10px", fontSize: ".72rem" }} disabled={busy === r.id} onClick={() => setStatus(r, "Rejected")}><i className="fa-solid fa-circle-xmark"></i> Reject</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
