import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import { tr } from "../lib/i18n";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "./Badges.jsx";
import { useMemberScope, inScope } from "../lib/memberScope";
import "./releasedWho.css";

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
export default function ReleasedPie({ statuses = [], title = "Assistance already released", onPick, active }) {
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
        <p className="hint-text" style={{ margin: 0 }}>{tr("No assistance records yet.")}</p>
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
            <div className="rel-pie-big"><b>{pct}%</b><span>{tr("released")}</span></div>
            <div className="rel-pie-sub">{released.count} {tr("of")} {data.total} {tr("record")}{data.total === 1 ? "" : "s"}</div>
            <ul className="rel-pie-legend">
              {data.slices.map((s) => (
                <li key={s.key} className={onPick ? "pick" : undefined} onClick={onPick ? () => onPick(s.key) : undefined} style={active === s.key ? { fontWeight: 700 } : undefined}><i style={{ background: s.color }}></i><span>{s.label}</span><b>{s.count}</b><em>{Math.round(s.pct)}%</em></li>
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
      <thead><tr><th>{head}</th><th>{tr("Released")}</th>{!isFarmer && <th>{tr("Farmers")}</th>}</tr></thead>
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
        {!isFarmer && <em>{d.released} {tr("released record")}{d.released === 1 ? "" : "s"} {tr("in total")}</em>}
      </div>
      {d.released === 0 ? (
        <p className="hint-text" style={{ margin: 0 }}>{tr("No assistance has been released yet.")}</p>
      ) : (
        <>
          <h5><i className="fa-solid fa-hand-holding-dollar"></i> {tr("What assistance")}</h5>
          {mini(d.byType, "Assistance")}
          <h5><i className="fa-solid fa-location-dot"></i> {tr("Where")}</h5>
          {mini(d.byPlace, "Barangay, Municipality")}
        </>
      )}
    </div>
  );
}

const nameOf = (d) => [d?.surname, d?.first_name, d?.middle_name, d?.extension_name].filter(Boolean).join(", ") || d?.full_name || "—";
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");

// "Who are Released / Incoming / Pending-Under Review / Denied" (a farmer only sees his/her own released ones)
function WhoList({ records, directory, isFarmer, tab, setTab, onOpen }) {
  const active = SLICES.find((s) => s.key === tab) || SLICES[0];
  const list = records
    .filter((r) => active.match.includes(r.status))
    .sort((a, b) => new Date(b.resolved_at || b.requested_at) - new Date(a.resolved_at || a.requested_at));
  const count = (s) => records.filter((r) => s.match.includes(r.status)).length;
  return (
    <div className="rel-who-list">
      <h5><i className="fa-solid fa-users"></i> {isFarmer ? tr("My released assistance") : `${tr("Who are")} ${active.label}`}</h5>
      {!isFarmer && (
        <div className="rel-who-tabs" role="tablist">
          {SLICES.map((s) => (
            <button type="button" key={s.key} role="tab" aria-selected={active.key === s.key} className={`rel-who-tab ${active.key === s.key ? "on" : ""}`} onClick={() => setTab(s.key)}>
              <i className="dot" style={{ background: s.color }}></i>{s.label} <b>{count(s)}</b>
            </button>
          ))}
        </div>
      )}
      <div className="rel-who-scroll">
        {list.length === 0 ? (
          <p className="rel-who-empty">{isFarmer ? tr("No assistance has been released to you yet.") : `${tr("Nobody is in this status yet.")}`}</p>
        ) : (
          <table>
            <thead><tr>{!isFarmer && <th>{tr("Farmer")}</th>}<th>{tr("Assistance")}</th><th>{tr("Program")}</th><th>{active.key === "Released" ? tr("Released on") : tr("Requested on")}</th>{active.key === "Pending" && <th>{tr("Status")}</th>}</tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} onClick={onOpen}>
                  {!isFarmer && <td>{nameOf(directory[r.farmer_id])}</td>}
                  <td>{tr(r.assistance_type)}</td><td>{r.program_title || "—"}</td>
                  <td>{fmt(r.status === "Released" ? (r.distribution_date || r.resolved_at || r.requested_at) : r.requested_at)}</td>
                  {active.key === "Pending" && <td><StatusBadge status={r.status} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Dashboard card. Admin: everyone. President: only members of the association.
// Farmer: only his/her own released assistance.
export function ReleasedPieCard({ title = "Assistance already released" }) {
  const { farmer, role } = useAuth();
  const navigate = useNavigate();
  const isFarmer = role === "farmer";
  const scope = useMemberScope();
  const [all, setAll] = useState(null);
  const [directory, setDirectory] = useState({});
  const [tab, setTab] = useState("Released");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("assistance_records")
        .select("id, farmer_id, assistance_type, program_title, status, requested_at, resolved_at, distribution_date")
        .order("requested_at", { ascending: false });
      setAll(data || []);
      if (isFarmer) {
        if (farmer) setDirectory({ [farmer.id]: farmer });
      } else {
        const { data: dir } = await supabase.from("farmer_directory")
          .select("id, full_name, surname, first_name, middle_name, extension_name, barangay, city_municipality");
        setDirectory(Object.fromEntries((dir || []).map((x) => [x.id, x])));
      }
    })();
  }, [isFarmer, farmer?.id]);

  const records = useMemo(() => {
    if (!all) return null;
    if (isFarmer) return all.filter((r) => r.status === "Released" && (!farmer || r.farmer_id === farmer.id));
    return all.filter((r) => inScope(scope, r.farmer_id));
  }, [all, scope, isFarmer, farmer?.id]);

  if (!records || scope === undefined) return null;
  const open = () => navigate(`/${role}/assistance`);

  if (isFarmer) {
    return (
      <div className="panel rel-pie-card">
        <h4 className="rel-pie-title"><i className="fa-solid fa-hand-holding-dollar"></i> {tr(title)}</h4>
        <ReleasedBreakdown records={records} directory={directory} isFarmer />
        <WhoList records={records} directory={directory} isFarmer tab="Released" setTab={() => {}} onOpen={open} />
      </div>
    );
  }
  return (
    <div className="panel rel-pie-card">
      <div className="rel-card-grid">
        <ReleasedPie statuses={records.map((r) => r.status)} title={title} onPick={setTab} active={tab} />
        <ReleasedBreakdown records={records} directory={directory} isFarmer={false} />
      </div>
      {role === "president" && <p className="hint-text" style={{ margin: "10px 0 0" }}><i className="fa-solid fa-circle-info"></i> {tr("Only members of the association are counted here.")}</p>}
      <WhoList records={records} directory={directory} isFarmer={false} tab={tab} setTab={setTab} onOpen={open} />
    </div>
  );
}
