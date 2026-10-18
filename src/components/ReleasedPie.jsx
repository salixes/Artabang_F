import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

const SLICES = [
  { key: "Released", label: "Released", color: "#2F6B45", match: ["Released"] },
  { key: "Incoming", label: "Incoming", color: "#3B82C4", match: ["Incoming"] },
  { key: "Pending", label: "Pending / Under Review", color: "#E8934A", match: ["Pending", "Under Review"] },
  { key: "Denied", label: "Denied", color: "#C24444", match: ["Denied"] },
];
const R = 88, C = 100;
const pt = (deg) => { const a = ((deg - 90) * Math.PI) / 180; return [C + R * Math.cos(a), C + R * Math.sin(a)]; };

// Pie chart of assistance records by status, headlined with the share already RELEASED.
// statuses = one status string per assistance record.
export default function ReleasedPie({ statuses = [], title = "Assistance already released" }) {
  const data = useMemo(() => {
    const counts = SLICES.map((s) => ({ ...s, count: statuses.filter((x) => s.match.includes(x)).length }));
    const total = counts.reduce((a, s) => a + s.count, 0);
    let angle = 0;
    return {
      total,
      slices: counts.map((s) => {
        const sweep = total ? (s.count / total) * 360 : 0;
        const out = { ...s, pct: total ? (s.count / total) * 100 : 0, from: angle, to: angle + sweep };
        angle += sweep;
        return out;
      }),
    };
  }, [statuses]);

  const released = data.slices[0];
  const pct = Math.round(released.pct);

  return (
    <div className="rel-pie">
      <h4 className="rel-pie-title"><i className="fa-solid fa-chart-pie"></i> {title}</h4>
      {data.total === 0 ? (
        <p className="hint-text" style={{ margin: 0 }}>No assistance records yet.</p>
      ) : (
        <div className="rel-pie-body">
          <svg viewBox="0 0 200 200" width="170" height="170" role="img" aria-label={`${pct}% of ${data.total} assistance records released`} className="rel-pie-svg">
            {data.slices.filter((s) => s.count > 0).map((s) => {
              if (s.pct >= 99.999) return <circle key={s.key} cx={C} cy={C} r={R} fill={s.color} />;
              const [x0, y0] = pt(s.from), [x1, y1] = pt(s.to);
              const large = s.to - s.from > 180 ? 1 : 0;
              return <path key={s.key} d={`M${C},${C} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} Z`} fill={s.color} stroke="#fff" strokeWidth="1.5" />;
            })}
          </svg>
          <div className="rel-pie-side">
            <div className="rel-pie-big"><b>{pct}%</b><span>released</span></div>
            <div className="rel-pie-sub">{released.count} of {data.total} record{data.total === 1 ? "" : "s"}</div>
            <ul className="rel-pie-legend">
              {data.slices.map((s) => (
                <li key={s.key}><i style={{ background: s.color }}></i><span>{s.label}</span><b>{s.count}</b><em>{Math.round(s.pct)}%</em></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const placeOf = (d) => [d?.barangay, d?.city_municipality].filter(Boolean).join(", ") || "Not specified";

// What was released, to how many farmers, and where (barangay / municipality of those farmers).
function ReleasedBreakdown({ records, directory, isFarmer }) {
  const d = useMemo(() => {
    const released = records.filter((r) => r.status === "Released");
    const farmers = new Set(released.map((r) => r.farmer_id));
    const group = (keyOf) => {
      const m = {};
      released.forEach((r) => {
        const k = keyOf(r);
        const g = (m[k] ||= { name: k, records: 0, farmers: new Set() });
        g.records += 1; g.farmers.add(r.farmer_id);
      });
      return Object.values(m).sort((a, b) => b.records - a.records || b.farmers.size - a.farmers.size);
    };
    return { released: released.length, farmers: farmers.size, byType: group((r) => r.assistance_type), byPlace: group((r) => placeOf(directory[r.farmer_id])) };
  }, [records, directory]);

  const mini = (rows, head) => (
    <table className="rel-mini">
      <thead><tr><th>{head}</th><th>Released</th>{!isFarmer && <th>Farmers</th>}</tr></thead>
      <tbody>{rows.map((g) => <tr key={g.name}><td>{g.name}</td><td>{g.records}</td>{!isFarmer && <td>{g.farmers.size}</td>}</tr>)}</tbody>
    </table>
  );

  return (
    <div className="rel-breakdown">
      <div className="rel-who">
        <b>{isFarmer ? d.released : d.farmers}</b>
        <span>{isFarmer
          ? `assistance record${d.released === 1 ? "" : "s"} released to you`
          : `farmer${d.farmers === 1 ? "" : "s"} already received assistance`}</span>
        {!isFarmer && <em>{d.released} released record{d.released === 1 ? "" : "s"} in total</em>}
      </div>
      {d.released === 0 ? (
        <p className="hint-text" style={{ margin: 0 }}>No assistance has been released yet.</p>
      ) : (
        <>
          <h5><i className="fa-solid fa-hand-holding-dollar"></i> What assistance</h5>
          {mini(d.byType, "Assistance")}
          <h5><i className="fa-solid fa-location-dot"></i> Where</h5>
          {mini(d.byPlace, "Barangay, Municipality")}
        </>
      )}
    </div>
  );
}

// Dashboard card: the pie (share released) + how many farmers received assistance,
// what assistance and where. Admin / president: everyone's records. Farmer: their own.
export function ReleasedPieCard({ title }) {
  const { farmer, role } = useAuth();
  const isFarmer = role === "farmer";
  const [records, setRecords] = useState(null);
  const [directory, setDirectory] = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("assistance_records").select("farmer_id, assistance_type, status");
      setRecords(data || []);
      if (isFarmer) {
        if (farmer) setDirectory({ [farmer.id]: farmer });
      } else {
        const { data: dir } = await supabase.from("farmer_directory").select("id, barangay, city_municipality");
        setDirectory(Object.fromEntries((dir || []).map((x) => [x.id, x])));
      }
    })();
  }, [isFarmer, farmer?.id]);

  if (!records) return null;
  return (
    <div className="panel rel-pie-card">
      <div className="rel-card-grid">
        <ReleasedPie statuses={records.map((r) => r.status)} title={title} />
        <ReleasedBreakdown records={records} directory={directory} isFarmer={isFarmer} />
      </div>
    </div>
  );
}
