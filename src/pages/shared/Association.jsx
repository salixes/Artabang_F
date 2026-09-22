import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Modal from "../../components/Modal.jsx";
import { CROP_LIST, calculateInsuranceCoverage, formatPeso, ASSUMED_YIELD_PER_HA } from "../../lib/businessRules";

function AllocationCalculator() {
  const [crop, setCrop] = useState(CROP_LIST[0]);
  const [area, setArea] = useState(1);
  const [cropPrices, setCropPrices] = useState({});

  useEffect(() => {
    supabase.from("crop_prices").select("*").then(({ data }) => setCropPrices(Object.fromEntries((data || []).map((p) => [p.crop_name, Number(p.price_per_kg)]))));
  }, []);

  const result = calculateInsuranceCoverage({ crop_name: crop, area: Number(area) || 0 }, [], cropPrices);

  return (
    <div className="panel">
      <div className="panel-head"><h3><i className="fa-solid fa-calculator"></i> Allocation Calculator</h3></div>
      <p className="hint-text" style={{ padding: "0 4px" }}>Estimate potential insurance/assistance value for a crop and area, using the assumed standard yield of {ASSUMED_YIELD_PER_HA.toLocaleString()} kg/ha where no verified harvest exists yet.</p>
      <form className="modal-body" style={{ padding: "0 4px" }}>
        <label>Crop <select value={crop} onChange={(e) => setCrop(e.target.value)}>{CROP_LIST.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Area (hectares) <input type="number" step="0.1" min="0.1" value={area} onChange={(e) => setArea(e.target.value)} /></label>
      </form>
      <div className="qual-box">
        <b>Estimated Value: {formatPeso(result.value)}</b>
        <p className="hint-text" style={{ margin: 0 }}>{result.basis}</p>
      </div>
    </div>
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

      {scope === "president" && <AllocationCalculator />}

      <Modal open={open} onClose={() => setOpen(false)} title="New Association" icon="fa-flag">
        <form className="modal-body" onSubmit={createAssociation}>
          <label>Association Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LARFA" required /></label>
          <div className="modal-actions"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary"><i className="fa-solid fa-floppy-disk"></i> Create</button></div>
        </form>
      </Modal>
    </section>
  );
}
