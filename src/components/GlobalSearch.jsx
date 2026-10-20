import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import { NAV } from "./Sidebar.jsx";

// Where each kind of result opens, per role. A role only searches what it has a page for.
const ROUTES = {
  farmer: { crops: "/farmer/crops", yield: "/farmer/yield", insurance: "/farmer/insurance", assistance: "/farmer/assistance", announcements: "/farmer/announcements", assistanceAnn: "/farmer/announcements", policies: "/farmer/policies" },
  admin: { people: "/admin/farmers", crops: "/admin/crops", yield: "/admin/yield", insurance: "/admin/insurance", assistance: "/admin/assistance", announcements: "/admin/announcements", assistanceAnn: "/admin/assistance-announcement" },
  president: { people: "/president/farmers-profile", crops: "/president/crops", assistance: "/president/assistance", announcements: "/president/announcements", policies: "/president/policies", meetings: "/president/meetings" },
};
const GROUPS = [
  ["people", "Farmers", "fa-user"],
  ["crops", "Registered crops", "fa-tractor"],
  ["assistance", "Assistance records", "fa-hand-holding-dollar"],
  ["assistanceAnn", "Assistance programs", "fa-hand-holding-heart"],
  ["yield", "Yield records", "fa-wheat-awn"],
  ["insurance", "Crop insurance", "fa-shield-halved"],
  ["announcements", "Announcements", "fa-bullhorn"],
  ["policies", "Policies", "fa-scroll"],
  ["meetings", "Meetings", "fa-clipboard-user"],
  ["pages", "Pages", "fa-compass"],
];
const PER_GROUP = 5;

// characters that would break a PostgREST filter
const clean = (s) => s.replace(/[%_,()"\\*:]/g, " ").replace(/\s+/g, " ").trim();
const fullNameOf = (f) => [f.surname, f.first_name, f.middle_name, f.extension_name].filter(Boolean).join(", ") || f.full_name || "Unnamed farmer";
const snip = (s, n = 70) => { const t = (s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const day = (d) => (d ? new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "");
const dot = (...parts) => parts.filter(Boolean).join(" · ");

async function runSearch(role, term) {
  const routes = ROUTES[role] || {};
  const staff = role === "admin" || role === "president";
  const like = `%${term}%`;
  const or = (cols) => cols.map((c) => `${c}.ilike.${like}`).join(",");
  let attempted = 0, failed = 0;
  // a table the role can't read (or a query that errors) just counts as "no results"
  const run = async (fn) => {
    attempted += 1;
    try { const { data, error } = await fn(); if (error) { failed += 1; return []; } return data || []; }
    catch { failed += 1; return []; }
  };

  const nameOf = {};
  async function loadNames(ids) {
    if (!staff) return;
    const need = [...new Set(ids)].filter((i) => i && !(i in nameOf));
    if (!need.length) return;
    const rows = await run(() => supabase.from("farmer_directory").select("*").in("id", need));
    rows.forEach((r) => { nameOf[r.id] = fullNameOf(r); });
  }
  const who = (id) => (staff ? nameOf[id] : "");

  const jobs = {};

  if (routes.people && staff) jobs.people = async () => {
    const [byDir, byCrop] = await Promise.all([
      run(() => supabase.from("farmer_directory").select("*")
        .or(or(["full_name", "surname", "first_name", "email", "contact_number", "location", "rsbsa_number", "association_name"])).limit(8)),
      run(() => supabase.from("farmer_crops").select("farmer_id, crop_name").ilike("crop_name", like).limit(20)),
    ]);
    const have = new Set(byDir.map((r) => r.id));
    const cropIds = [...new Set(byCrop.map((c) => c.farmer_id))].filter((id) => !have.has(id)).slice(0, 8);
    const extra = cropIds.length ? await run(() => supabase.from("farmer_directory").select("*").in("id", cropIds)) : [];
    const grows = {};
    byCrop.forEach((c) => { (grows[c.farmer_id] = grows[c.farmer_id] || []).push(c.crop_name); });
    return [...byDir, ...extra].map((r) => {
      const name = fullNameOf(r);
      return {
        id: r.id, title: name, to: `${routes.people}?q=${encodeURIComponent(name)}`,
        sub: dot(r.location, r.contact_number, r.rsbsa_number && `RSBSA ${r.rsbsa_number}`, grows[r.id] && `Grows ${grows[r.id].join(", ")}`),
      };
    });
  };

  if (routes.crops) jobs.crops = async () => {
    const rows = await run(() => supabase.from("crop_registrations").select("id, farmer_id, crop_name, variety, area, status")
      .or(or(["crop_name", "variety", "status"])).order("registered_at", { ascending: false }).limit(PER_GROUP));
    await loadNames(rows.map((r) => r.farmer_id));
    return rows.map((r) => ({ id: r.id, title: r.variety ? `${r.crop_name} (${r.variety})` : r.crop_name, to: routes.crops, sub: dot(`${r.area} ha`, r.status || "Pending", who(r.farmer_id)) }));
  };

  if (routes.assistance) jobs.assistance = async () => {
    const rows = await run(() => supabase.from("assistance_records").select("id, farmer_id, assistance_type, value_description, program_title, status, source")
      .or(or(["assistance_type", "value_description", "program_title", "status", "source"])).order("requested_at", { ascending: false }).limit(PER_GROUP));
    await loadNames(rows.map((r) => r.farmer_id));
    return rows.map((r) => ({ id: r.id, title: r.program_title || r.assistance_type, to: routes.assistance, sub: dot(r.status, r.program_title ? r.assistance_type : "", snip(r.value_description, 40), who(r.farmer_id)) }));
  };

  if (routes.assistanceAnn) jobs.assistanceAnn = async () => {
    const rows = await run(() => supabase.from("assistance_announcements").select("id, title, assistance_type, deadline")
      .or(or(["title", "assistance_type", "body"])).order("created_at", { ascending: false }).limit(PER_GROUP));
    return rows.map((r) => ({ id: r.id, title: r.title, to: routes.assistanceAnn, sub: dot(r.assistance_type, r.deadline && `Deadline ${day(r.deadline)}`) }));
  };

  if (routes.yield) jobs.yield = async () => {
    const rows = await run(() => supabase.from("yield_records").select("id, farmer_id, crop_name, season, kilograms, status")
      .or(or(["crop_name", "season", "status"])).order("created_at", { ascending: false }).limit(PER_GROUP));
    await loadNames(rows.map((r) => r.farmer_id));
    return rows.map((r) => ({ id: r.id, title: `${r.crop_name} — ${r.season}`, to: routes.yield, sub: dot(`${r.kilograms} kg`, r.status, who(r.farmer_id)) }));
  };

  if (routes.insurance) jobs.insurance = async () => {
    const rows = await run(() => supabase.from("insurance_registrations").select("id, farmer_id, crop_name, area, status")
      .or(or(["crop_name", "status"])).order("registered_at", { ascending: false }).limit(PER_GROUP));
    await loadNames(rows.map((r) => r.farmer_id));
    return rows.map((r) => ({ id: r.id, title: r.crop_name, to: routes.insurance, sub: dot(`${r.area} ha`, r.status, who(r.farmer_id)) }));
  };

  if (routes.announcements) jobs.announcements = async () => {
    const rows = await run(() => supabase.from("announcements").select("id, title, body, created_at")
      .or(or(["title", "body"])).order("created_at", { ascending: false }).limit(PER_GROUP));
    return rows.map((r) => ({ id: r.id, title: r.title, to: routes.announcements, sub: dot(day(r.created_at), snip(r.body)) }));
  };

  if (routes.policies) jobs.policies = async () => {
    const rows = await run(() => supabase.from("policies").select("id, title, body").or(or(["title", "body"])).limit(PER_GROUP));
    return rows.map((r) => ({ id: r.id, title: r.title, to: routes.policies, sub: snip(r.body) }));
  };

  if (routes.meetings) jobs.meetings = async () => {
    const rows = await run(() => supabase.from("meetings").select("id, title, location, meeting_date, meeting_type")
      .or(or(["title", "location", "meeting_type"])).order("meeting_date", { ascending: false }).limit(PER_GROUP));
    return rows.map((r) => ({ id: r.id, title: r.title, to: routes.meetings, sub: dot(r.meeting_type, day(r.meeting_date), r.location) }));
  };

  // menu pages (always available — no database involved)
  const lower = term.toLowerCase();
  const pages = [];
  (NAV[role] || []).forEach((n) => {
    if (n.group) n.items.forEach((i) => { if (i.label.toLowerCase().includes(lower) || n.group.toLowerCase().includes(lower)) pages.push({ id: i.to, title: i.label, to: i.to, sub: n.group }); });
    else if (n.label.toLowerCase().includes(lower)) pages.push({ id: n.to, title: n.label, to: n.to, sub: "Open page" });
  });

  const keys = Object.keys(jobs);
  const results = await Promise.all(keys.map((k) => jobs[k]()));
  const byKey = { pages };
  keys.forEach((k, i) => { byKey[k] = results[i]; });

  const groups = GROUPS
    .map(([key, label, icon]) => ({ key, label, icon, items: (byKey[key] || []).slice(0, PER_GROUP) }))
    .filter((g) => g.items.length);
  return { groups, failedAll: attempted > 0 && failed === attempted && groups.length === 0 };
}

function Hl({ text, term }) {
  if (!text) return null;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0 || !term) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

export default function GlobalSearch() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: "idle", groups: [], failedAll: false });
  const wrapRef = useRef(null);
  const reqId = useRef(0);
  const term = clean(value);

  useEffect(() => {
    if (term.length < 2 || !role) { reqId.current += 1; setState({ status: "idle", groups: [], failedAll: false }); return undefined; }
    setState((s) => ({ ...s, status: "loading" }));
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const res = await runSearch(role, term);
      if (id === reqId.current) setState({ status: "done", ...res });
    }, 280);
    return () => clearTimeout(t);
  }, [term, role]);

  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const flat = state.groups.flatMap((g) => g.items);
  function go(item) { setOpen(false); setValue(""); navigate(item.to); }
  function onKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); e.currentTarget.blur(); }
    if (e.key === "Enter" && state.status === "done" && flat[0]) go(flat[0]);
  }

  return (
    <div className="topbar-search" ref={wrapRef}>
      <i className="fa-solid fa-magnifying-glass"></i>
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search farmers, crops, assistance records…"
        aria-label="Search"
        autoComplete="off"
      />
      {value && <button type="button" className="search-clear" onClick={() => { setValue(""); setOpen(false); }} aria-label="Clear search"><i className="fa-solid fa-xmark"></i></button>}

      {open && value.trim() && (
        <div className="search-panel" role="listbox">
          {term.length < 2 && <p className="search-note">Type at least 2 characters to search.</p>}
          {term.length >= 2 && state.status === "loading" && <p className="search-note"><i className="fa-solid fa-spinner fa-spin"></i> Searching…</p>}
          {term.length >= 2 && state.status === "done" && state.failedAll && <p className="search-note">Search isn't available right now. Please try again.</p>}
          {term.length >= 2 && state.status === "done" && !state.failedAll && state.groups.length === 0 && (
            <p className="search-note"><b>“{value.trim()}”</b> is not in the system.<br /><span>Try another name, crop, or assistance type.</span></p>
          )}
          {term.length >= 2 && state.status === "done" && state.groups.map((g) => (
            <div key={g.key}>
              <div className="search-group-label"><i className={`fa-solid ${g.icon}`}></i> {g.label}</div>
              {g.items.map((it) => (
                <button type="button" className="search-item" key={`${g.key}-${it.id}`} onClick={() => go(it)}>
                  <i className={`fa-solid ${g.icon} si-icon`}></i>
                  <span>
                    <span className="si-title"><Hl text={it.title} term={term} /></span>
                    {it.sub && <span className="si-sub"><Hl text={it.sub} term={term} /></span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
