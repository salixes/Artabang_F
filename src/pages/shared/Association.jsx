import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { logActivity } from "../../lib/activity";

const nameOf = (f) => [f.surname, f.first_name, f.middle_name, f.extension_name].filter(Boolean).join(", ") || f.full_name || "—";

// President: profiling management of the members of each association (LIFA, Lindasan ...)
function MembershipManagement() {
  const { showToast } = useToast();
  const [associations, setAssociations] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [tab, setTab] = useState("all"); // "all" | an association id | "unassigned"
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ farmer_id: "", association_id: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: assoc }, { data: dir }] = await Promise.all([
      supabase.from("associations").select("*").order("name"),
      supabase.from("farmer_directory").select("id, full_name, surname, first_name, middle_name, extension_name, contact_number, location, farm_size, barangay, rsbsa_number, is_association_member, association_id, association_name, crops, total_verified_yield"),
    ]);
    setAssociations(assoc || []);
    setFarmers(dir || []);
  }
  useEffect(() => { load(); }, []);

  const members = farmers.filter((f) => f.is_association_member);
  const nonMembers = farmers.filter((f) => !f.is_association_member).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const unassigned = members.filter((m) => !m.association_id);
  const count = (id) => members.filter((m) => m.association_id === id).length;
  const q = search.trim().toLowerCase();
  const list = members
    .filter((m) => tab === "all" || (tab === "unassigned" ? !m.association_id : m.association_id === tab))
    .filter((m) => !q || nameOf(m).toLowerCase().includes(q) || (m.location || "").toLowerCase().includes(q))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const assocName = (id) => associations.find((a) => a.id === id)?.name;

  async function change(f, patch, doneMsg, logMsg) {
    setBusy(true);
    const { data, error } = await supabase.from("farmers").update(patch).eq("id", f.id).select("id");
    setBusy(false);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    if (!data || data.length === 0) return showToast("The change could not be saved (not allowed).", "fa-triangle-exclamation");
    logActivity(logMsg, "association");
    showToast(doneMsg, "fa-people-group");
    load();
  }
  const assign = (f, associationId) => change(f, { is_association_member: true, association_id: associationId || null },
    associationId ? `${nameOf(f)} is now a member of ${assocName(associationId)}.` : `${nameOf(f)} has no association assigned yet.`,
    `Set the association of ${nameOf(f)} to ${assocName(associationId) || "none"}`);
  const removeMember = (f) => {
    if (!confirm(`Remove ${nameOf(f)} from the association members?`)) return;
    change(f, { is_association_member: false, association_id: null }, `${nameOf(f)} was removed from the members.`, `Removed ${nameOf(f)} from the association members`);
  };
  async function addMember(e) {
    e.preventDefault();
    const f = farmers.find((x) => x.id === addForm.farmer_id);
    if (!f) return showToast("Choose the farmer to add.", "fa-triangle-exclamation");
    if (!addForm.association_id) return showToast("Choose the association.", "fa-triangle-exclamation");
    await change(f, { is_association_member: true, association_id: addForm.association_id }, `${nameOf(f)} was added to ${assocName(addForm.association_id)}.`, `Added ${nameOf(f)} to ${assocName(addForm.association_id)}`);
    setAddOpen(false); setAddForm({ farmer_id: "", association_id: "" });
  }

  const tabs = [["all", "All members", members.length], ...associations.map((a) => [a.id, a.name, count(a.id)]), ["unassigned", "Not assigned yet", unassigned.length]];

  return (
    <>
      <div className="view-head">
        <h2><i className="fa-solid fa-flag"></i> Membership Management</h2>
        <button className="btn-primary" onClick={() => { setAddForm({ farmer_id: "", association_id: associations[0]?.id || "" }); setAddOpen(true); }}><i className="fa-solid fa-user-plus"></i> Add Member</button>
      </div>
      <p className="hint-text"><i className="fa-solid fa-circle-info"></i> Manage the profile of every member of {associations.map((a) => a.name).join(" and ") || "the associations"}. Farmers who said they are members but have not picked an association yet appear under <b>Not assigned yet</b> — assign them here.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 12px" }}>
        {tabs.map(([key, label, n]) => (
          <button type="button" key={key} className={tab === key ? "btn-primary" : "btn-ghost"} style={{ padding: "6px 14px", fontSize: ".8rem" }} onClick={() => setTab(key)}>{label} ({n})</button>
        ))}
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a member or place…" style={{ marginLeft: "auto", minWidth: 220 }} aria-label="Search members" />
      </div>

      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>Farmer</th><th>Association</th><th>Contact</th><th>Location</th><th>Farm size</th><th>Crops</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No members here.</td></tr>}
            {list.map((m) => (
              <tr key={m.id}>
                <td><b>{nameOf(m)}</b></td>
                <td>
                  <select value={m.association_id || ""} disabled={busy} onChange={(e) => assign(m, e.target.value)} aria-label={`Association of ${nameOf(m)}`}>
                    <option value="">— Not assigned —</option>
                    {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td>{m.contact_number || "—"}</td><td>{m.location || "—"}</td><td>{m.farm_size ? `${m.farm_size} ha` : "—"}</td><td>{(m.crops || []).join(", ") || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: ".72rem" }} onClick={() => setDetail(m)}><i className="fa-solid fa-id-card"></i> Profile</button>{" "}
                  <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: ".72rem", color: "var(--danger)" }} onClick={() => removeMember(m)} disabled={busy} title="Remove from the association"><i className="fa-solid fa-user-minus"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? nameOf(detail) : ""} icon="fa-id-card">
        {detail && (
          <div className="modal-body">
            <ul className="detail-list">
              <li><span>Association</span><b>{detail.association_id ? assocName(detail.association_id) : "Not assigned yet"}</b></li>
              <li><span>RSBSA No.</span><b>{detail.rsbsa_number || "—"}</b></li>
              <li><span>Contact</span><b>{detail.contact_number || "—"}</b></li>
              <li><span>Location</span><b>{detail.location || "—"}</b></li>
              <li><span>Farm size</span><b>{detail.farm_size ? `${detail.farm_size} ha` : "—"}</b></li>
              <li><span>Crops</span><b>{(detail.crops || []).join(", ") || "—"}</b></li>
              <li><span>Total verified yield</span><b>{Number(detail.total_verified_yield || 0).toLocaleString()} kg</b></li>
            </ul>
            <div className="modal-actions"><button className="btn-primary" onClick={() => setDetail(null)}>Close</button></div>
          </div>
        )}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Member" icon="fa-user-plus">
        <form className="modal-body" onSubmit={addMember}>
          <label>Farmer
            <select value={addForm.farmer_id} onChange={(e) => setAddForm({ ...addForm, farmer_id: e.target.value })} required>
              <option value="">Choose a farmer who is not a member yet…</option>
              {nonMembers.map((f) => <option key={f.id} value={f.id}>{nameOf(f)}{f.location ? ` — ${f.location}` : ""}</option>)}
            </select>
          </label>
          <label>Association
            <select value={addForm.association_id} onChange={(e) => setAddForm({ ...addForm, association_id: e.target.value })} required>
              {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={busy}><i className="fa-solid fa-floppy-disk"></i> Add</button></div>
        </form>
      </Modal>
    </>
  );
}

export default function Association({ scope = "admin" }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [associations, setAssociations] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function load() {
    const { data: assoc } = await supabase.from("associations").select("*").order("name");
    const { data: dir } = await supabase.from("farmer_directory").select("*");
    setAssociations(assoc || []);
    setMembers(dir || []);
  }
  useEffect(() => { load(); }, []);

  const visibleAssociations = scope === "president"
    ? associations.filter((a) => a.president_id === profile.id)
    : associations;

  async function createAssociation(e) {
    e.preventDefault();
    const { error } = await supabase.from("associations").insert({ name });
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast("Association created.", "fa-flag");
    setOpen(false);
    setName("");
    load();
  }

  async function removeAssociation(id) {
    if (!confirm("Delete this association? Members will be unassigned.")) return;
    await supabase.from("farmers").update({ association_id: null, is_association_member: false }).eq("association_id", id);
    const { error } = await supabase.from("associations").delete().eq("id", id);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    load();
  }

  if (scope === "president") return (<section><MembershipManagement /></section>);

  return (
    <section>
      <div className="view-head">
        <h2><i className="fa-solid fa-flag"></i> {scope === "president" ? "Membership Management" : "Farmers Association"}</h2>
        {scope === "admin" && <button className="btn-primary" onClick={() => setOpen(true)}><i className="fa-solid fa-plus"></i> New Association</button>}
      </div>
      <div className="dash-grid">
        {visibleAssociations.length === 0 && <p className="hint-text">No associations{scope === "president" ? " assigned to you yet" : ""}.</p>}
        {visibleAssociations.map((a) => {
          const assocMembers = members.filter((m) => m.association_name === a.name);
          return (
            <div className="panel" key={a.id}>
              <div className="panel-head"><h3><i className="fa-solid fa-people-group"></i> {a.name}</h3>{scope === "admin" && <button className="btn-ghost" onClick={() => removeAssociation(a.id)}><i className="fa-solid fa-trash"></i></button>}</div>
              <p className="hint-text" style={{ padding: "0 4px" }}>{assocMembers.length} member{assocMembers.length === 1 ? "" : "s"}</p>
              <ul className="detail-list">
                {assocMembers.map((m) => <li key={m.id}><span>{m.full_name}</span><b>{m.location || "—"}</b></li>)}
              </ul>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Association" icon="fa-flag">
        <form className="modal-body" onSubmit={createAssociation}>
          <label>Association Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LIFA" required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary"><i className="fa-solid fa-floppy-disk"></i> Create</button></div>
        </form>
      </Modal>
    </section>
  );
}
