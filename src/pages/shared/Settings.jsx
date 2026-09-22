import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useToast } from "../../context/ToastContext.jsx";

export default function Settings({ canManagePrices = false }) {
  const { showToast } = useToast();
  const [dark, setDark] = useState(document.body.classList.contains("dark"));
  const [prices, setPrices] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("agritabang-theme");
    if (saved === "dark") { document.body.classList.add("dark"); setDark(true); }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.body.classList.toggle("dark", next);
    localStorage.setItem("agritabang-theme", next ? "dark" : "light");
  }

  useEffect(() => {
    if (!canManagePrices) return;
    supabase.from("crop_prices").select("*").order("crop_name").then(({ data }) => setPrices(data || []));
  }, [canManagePrices]);

  async function savePrice(crop_name, price_per_kg) {
    const { error } = await supabase.from("crop_prices").update({ price_per_kg: Number(price_per_kg) }).eq("crop_name", crop_name);
    if (error) return showToast(error.message, "fa-triangle-exclamation");
    showToast(`${crop_name} price updated.`, "fa-peso-sign");
  }

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-gear"></i> Settings</h2></div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3><i className="fa-solid fa-moon"></i> Appearance</h3></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 10px" }}>
          <span>Dark Mode</span>
          <button className="btn-ghost" onClick={toggleDark}>{dark ? "Switch to Light" : "Switch to Dark"}</button>
        </div>
      </div>

      {canManagePrices && (
        <div className="panel">
          <div className="panel-head"><h3><i className="fa-solid fa-peso-sign"></i> Crop Farmgate Prices</h3></div>
          <p className="hint-text" style={{ padding: "0 4px" }}>Used to estimate Crop Insurance coverage values. Changes apply immediately to new estimates.</p>
          <div className="table-panel no-shadow">
            <table className="data-table compact">
              <thead><tr><th>Crop</th><th>Price / kg</th><th></th></tr></thead>
              <tbody>
                {prices.map((p) => (
                  <PriceRow key={p.crop_name} row={p} onSave={savePrice} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function PriceRow({ row, onSave }) {
  const [val, setVal] = useState(row.price_per_kg);
  return (
    <tr>
      <td>{row.crop_name}</td>
      <td><input type="number" step="0.5" value={val} onChange={(e) => setVal(e.target.value)} style={{ width: 90 }} /></td>
      <td><button className="btn-ghost" style={{ padding: "4px 8px", fontSize: ".7rem" }} onClick={() => onSave(row.crop_name, val)}><i className="fa-solid fa-floppy-disk"></i></button></td>
    </tr>
  );
}
