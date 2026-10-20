import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import Modal from "../../components/Modal.jsx";
import Avatar from "../../components/Avatar.jsx";

function fullNameOf(f) {
  return [f.surname, f.first_name, f.middle_name, f.extension_name].filter(Boolean).join(", ") || f.full_name;
}
const NOT_MEMBER = "Not a member";

// President: the same farmer cards as the admin's Farmer Profiling — VIEW ONLY
// (no add / edit / delete), plus which association each farmer belongs to.
export default function FarmersProfile() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [searchParams] = useSearchParams();
  // opened from the top search bar: /president/farmers-profile?q=<name>
  const [search, setSearch] = useState(searchParams.get("q") || "");
  useEffect(() => { const q = searchParams.get("q"); if (q !== null) setSearch(q); }, [searchParams]);
  const [assoc, setAssoc] = useState("All");
  const [detailRow, setDetailRow] = useState(null);

  useEffect(() => {
    supabase.from("farmer_directory").select("*").order("full_name").then(({ data }) => setRows(data || []));
  }, []);

  const associations = useMemo(
    () => Array.from(new Set(rows.map((r) => r.association_name).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const a = r.association_name || NOT_MEMBER;
      if (assoc !== "All" && a !== assoc) return false;
      if (!q) return true;
      return fullNameOf(r).toLowerCase().includes(q) || (r.barangay || r.location || "").toLowerCase().includes(q)
        || (r.rsbsa_number || "").toLowerCase().includes(q) || a.toLowerCase().includes(q)
        || (r.crops || []).join(" ").toLowerCase().includes(q);
    });
  }, [rows, search, assoc]);

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-people-group"></i> Farmers Profile</h2>
        <div className="head-actions">
          <button className="btn-ghost" onClick={() => navigate("/president/meetings")}><i className="fa-solid fa-clipboard-user"></i> Attendance</button>
          <select className="filter-select" value={assoc} onChange={(e) => setAssoc(e.target.value)} aria-label="Association">
            <option value="All">All associations</option>
            {associations.map((a) => <option key={a}>{a}</option>)}
            <option value={NOT_MEMBER}>{NOT_MEMBER}</option>
          </select>
          <div className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, location, association…" /></div>
        </div>
      </div>
      <p className="hint-text"><i className="fa-solid fa-shield-halved"></i> <span>View only. Shown here is what's needed for association coordination — personal details like birthdate, civil status, ID numbers, and full address are kept private in line with the Data Privacy Act.</span></p>

      <div className="farmer-grid">
        {filtered.length === 0 && <p className="hint-text">No farmers found.</p>}
        {filtered.map((f) => (
          <div className="farmer-card" key={f.id}>
            <Avatar src={f.photo_url} name={fullNameOf(f)} size={66} border="2px solid var(--sage-pale)" style={{ margin: "0 auto 10px" }} />
            <h4>{fullNameOf(f)}</h4>
            <p className="f-loc">{f.barangay || f.location || "—"}</p>
            <p style={{ fontSize: ".72rem", color: "var(--ink-soft)" }}>{f.rsbsa_number ? `RSBSA# ${f.rsbsa_number}` : "No RSBSA number yet"}</p>
            <p className="f-assoc"><i className="fa-solid fa-flag"></i> {f.association_name || NOT_MEMBER}</p>
            <p style={{ fontSize: ".72rem", margin: "6px 0" }}><b>{Number(f.total_verified_yield).toLocaleString()} kg</b> verified yield</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn-ghost" title="View" aria-label="View farmer" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => setDetailRow(f)}><i className="fa-solid fa-eye"></i></button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title={detailRow ? fullNameOf(detailRow) : ""} icon="fa-id-card">
        {detailRow && (
          <div className="modal-body">
            <ul className="detail-list">
              <li><span>RSBSA Number</span><b>{detailRow.rsbsa_number || "No RSBSA number yet"}</b></li>
              <li><span>Barangay</span><b>{detailRow.barangay || detailRow.location || "—"}</b></li>
              <li><span>Association (member of)</span><b>{detailRow.association_name || NOT_MEMBER}</b></li>
              <li><span>Farm Size</span><b>{detailRow.farm_size ? `${detailRow.farm_size} ha` : "—"}</b></li>
              <li><span>Crops Grown</span><b>{(detailRow.crops || []).join(", ") || "—"}</b></li>
              <li><span>Total Verified Yield</span><b>{Number(detailRow.total_verified_yield).toLocaleString()} kg</b></li>
            </ul>
            <div className="modal-actions"><button className="btn-primary" onClick={() => setDetailRow(null)}>Close</button></div>
          </div>
        )}
      </Modal>
    </section>
  );
}
