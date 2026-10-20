import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { getDeviceInfo } from "../../lib/device";

/* ---------------------------------------------------------------- helpers */
const ACTION_META = {
  login: { label: "Signed in", icon: "fa-right-to-bracket", tone: "ok" },
  logout: { label: "Signed out", icon: "fa-right-from-bracket", tone: "info" },
  login_failed: { label: "Failed sign-in", icon: "fa-triangle-exclamation", tone: "bad" },
  page_view: { label: "Page", icon: "fa-window-maximize", tone: "page" },
  action: { label: "Action", icon: "fa-bolt", tone: "act" },
};
const KIND_OPTIONS = [
  { v: "all", l: "All activity" },
  { v: "auth", l: "Sign-ins & sign-outs" },
  { v: "login_failed", l: "Failed sign-ins" },
  { v: "action", l: "Actions" },
  { v: "page_view", l: "Pages opened" },
];
const kindMatch = (r, kind) => kind === "all" || (kind === "auth" ? r.action === "login" || r.action === "logout" : r.action === kind);
const deviceIcon = (t) => (t === "Mobile" ? "fa-mobile-screen" : t === "Tablet" ? "fa-tablet-screen-button" : "fa-desktop");
const fmt = (d) => new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
function ago(d) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} day${Math.floor(s / 86400) === 1 ? "" : "s"} ago`;
}
const newestFirst = (list) => [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function ActionBadge({ r }) {
  const m = ACTION_META[r.action] || ACTION_META.action;
  return <span className={`al-badge ${m.tone}`}><i className={`fa-solid ${m.icon}`}></i> {m.label}</span>;
}
function DeviceCell({ r }) {
  if (!r.browser && !r.os) return <span style={{ color: "var(--ink-soft)" }}>—</span>;
  return (
    <div className="al-dev">
      <i className={`fa-solid ${deviceIcon(r.device_type)}`}></i>
      <div>{r.browser} · {r.os}<small>{[r.device_type, r.screen].filter(Boolean).join(" · ")}</small></div>
    </div>
  );
}
function What({ r }) {
  return (
    <div>
      <ActionBadge r={r} />{r.is_new_device && <span className="al-badge warn" title="First time this user signed in from this device"><i className="fa-solid fa-circle-exclamation"></i> New device</span>}
      <div style={{ marginTop: 3 }}>{r.description || "—"}</div>
    </div>
  );
}

/* ------------------------------------------------- farmer / president view */
function MyActivityLog() {
  const { profile } = useAuth();
  const [rows, setRows] = useState(null);
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(100);
  const thisDevice = getDeviceInfo().device_key;

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from("activity_log").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1000)
      .then(({ data }) => setRows(newestFirst(data || [])));
  }, [profile?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter((r) => kindMatch(r, kind)
      && (!from || new Date(r.created_at) >= new Date(from))
      && (!to || new Date(r.created_at) <= new Date(`${to}T23:59:59`))
      && (!q || `${r.description} ${r.page} ${r.browser} ${r.os}`.toLowerCase().includes(q)));
  }, [rows, kind, from, to, search]);

  const devices = useMemo(() => {
    const m = {};
    (rows || []).forEach((r) => {
      if (!r.device_key) return;
      const d = (m[r.device_key] ||= { key: r.device_key, r, last: r.created_at, logins: 0, isNew: false });
      if (new Date(r.created_at) > new Date(d.last)) { d.last = r.created_at; d.r = r; }
      if (r.action === "login") { d.logins += 1; if (r.is_new_device) d.isNew = true; }
    });
    return Object.values(m).sort((a, b) => new Date(b.last) - new Date(a.last));
  }, [rows]);

  if (!rows) return <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> Loading your activity…</p>;
  const logins = rows.filter((r) => r.action === "login");
  const monthAgo = Date.now() - 30 * 864e5;
  const failed30 = rows.filter((r) => r.action === "login_failed" && new Date(r.created_at) > monthAgo).length;
  const lastLogin = logins[1] || logins[0]; // [0] is this session; [1] the one before it

  return (
    <section>
      <div className="view-head"><h2><i className="fa-solid fa-clock-rotate-left"></i> Activity Log</h2></div>
      <p className="hint-text"><i className="fa-solid fa-shield-halved"></i> <span>This is the activity of <b>your account only</b> — when you signed in, from which device, and what you did. If you see a sign-in or device you don't recognize, change your password right away.</span></p>

      <div className="al-stats">
        <div className="al-stat"><b>{lastLogin ? ago(lastLogin.created_at) : "—"}</b><span>Previous sign-in{lastLogin ? ` · ${lastLogin.browser || ""}` : ""}</span></div>
        <div className="al-stat"><b>{devices.length}</b><span>Devices used</span></div>
        <div className="al-stat"><b>{logins.filter((r) => new Date(r.created_at) > monthAgo).length}</b><span>Sign-ins in the last 30 days</span></div>
        <div className={`al-stat ${failed30 ? "bad" : ""}`}><b>{failed30}</b><span>Failed sign-in attempts (30 days)</span></div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3><i className="fa-solid fa-laptop-mobile"></i> Devices that signed in to your account</h3></div>
        <div className="table-panel no-shadow">
          <table className="data-table">
            <thead><tr><th>Device</th><th>Last used</th><th>Sign-ins</th></tr></thead>
            <tbody>
              {devices.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No devices recorded yet.</td></tr>}
              {devices.map((d) => (
                <tr key={d.key}>
                  <td><DeviceCell r={d.r} />{d.key === thisDevice && <span className="al-badge ok" style={{ marginTop: 4 }}><i className="fa-solid fa-circle-check"></i> This device</span>}{d.isNew && <span className="al-badge warn" style={{ marginTop: 4 }}>New device</span>}</td>
                  <td>{fmt(d.last)} <small style={{ color: "var(--ink-soft)" }}>({ago(d.last)})</small></td>
                  <td>{d.logins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="al-filters">
        <select className="filter-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">{KIND_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
        <label className="al-date">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="al-date">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity…" /></div>
      </div>

      <div className="table-panel">
        <table className="data-table">
          <thead><tr><th>When</th><th>Activity</th><th>Device</th><th>Page</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No activity matches.</td></tr>}
            {filtered.slice(0, shown).map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmt(r.created_at)}<small style={{ display: "block", color: "var(--ink-soft)" }}>{ago(r.created_at)}</small></td>
                <td><What r={r} /></td><td><DeviceCell r={r} /></td><td style={{ color: "var(--ink-soft)" }}>{r.page || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > shown && <div style={{ textAlign: "center", marginTop: 12 }}><button className="btn-ghost" onClick={() => setShown(shown + 100)}>Show more ({filtered.length - shown} left)</button></div>}
    </section>
  );
}

/* ----------------------------------------------------------- admin view */
const RANGES = [{ v: 1, l: "Today" }, { v: 7, l: "Last 7 days" }, { v: 30, l: "Last 30 days" }, { v: 90, l: "Last 90 days" }];
const LIMIT = 3000;

function AdminActivityLog() {
  const [tab, setTab] = useState("activity");
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState(null);
  const [people, setPeople] = useState({});
  const [roleF, setRoleF] = useState("all");
  const [userF, setUserF] = useState("all");
  const [kind, setKind] = useState("all");
  const [devF, setDevF] = useState("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(150);

  useEffect(() => {
    setRows(null);
    const since = days === 1 ? startOfDay() : new Date(Date.now() - days * 864e5);
    (async () => {
      const [{ data: logs }, { data: profs }] = await Promise.all([
        supabase.from("activity_log").select("*").gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(LIMIT),
        supabase.from("profiles").select("id, full_name, role, email"),
      ]);
      setPeople(Object.fromEntries((profs || []).map((p) => [p.id, p])));
      setRows(newestFirst(logs || []));
    })();
  }, [days]);

  const named = useMemo(() => (rows || []).map((r) => ({ ...r, name: people[r.user_id]?.full_name || "Unknown user", email: people[r.user_id]?.email || "" })), [rows, people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return named.filter((r) => (roleF === "all" || r.role === roleF) && (userF === "all" || r.user_id === userF)
      && kindMatch(r, kind) && (devF === "all" || r.device_type === devF)
      && (!q || `${r.name} ${r.email} ${r.description} ${r.page} ${r.ip_address} ${r.browser} ${r.os}`.toLowerCase().includes(q)));
  }, [named, roleF, userF, kind, devF, search]);

  const users = useMemo(() => {
    const m = {};
    named.forEach((r) => { // named is newest-first
      const u = (m[r.user_id] ||= { id: r.user_id, name: r.name, email: r.email, role: r.role, last: r.created_at, lastRow: r, lastIp: null, events: 0, logins: 0, failed: 0, devices: new Set() });
      u.events += 1;
      if (!u.lastIp && r.ip_address) u.lastIp = r.ip_address;
      if (r.action === "login") u.logins += 1;
      if (r.action === "login_failed") u.failed += 1;
      if (r.device_key) u.devices.add(r.device_key);
    });
    return Object.values(m).sort((a, b) => new Date(b.last) - new Date(a.last));
  }, [named]);

  const stats = useMemo(() => ({
    events: named.length,
    active: users.length,
    logins: named.filter((r) => r.action === "login").length,
    failed: named.filter((r) => r.action === "login_failed").length,
    newDev: named.filter((r) => r.is_new_device).length,
  }), [named, users]);

  if (!rows) return <p className="hint-text"><i className="fa-solid fa-spinner fa-spin"></i> Loading activity…</p>;

  const userOptions = Object.values(people).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const suspicious = users.filter((u) => u.failed >= 3).sort((a, b) => b.failed - a.failed);
  const newDeviceRows = named.filter((r) => r.is_new_device);
  const failedRows = named.filter((r) => r.action === "login_failed");
  const label = RANGES.find((r) => r.v === days).l;

  function exportCsv() {
    const head = ["When", "User", "Email", "Role", "Activity", "Details", "Page", "Device type", "Browser", "System", "Screen", "Language", "Time zone", "IP address", "New device"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => [new Date(r.created_at).toLocaleString("en-PH"), r.name, r.email, r.role, (ACTION_META[r.action] || {}).label, r.description, r.page,
      r.device_type, r.browser, r.os, r.screen, r.language, r.timezone, r.ip_address, r.is_new_device ? "Yes" : ""].map(esc).join(","));
    const blob = new Blob(["\ufeff" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const openUser = (id) => { setUserF(id); setTab("activity"); setShown(150); };

  return (
    <section>
      <div className="print-only print-report-header"><h1>AgriTabang — Activity Log</h1><p>{label} · {filtered.length} event{filtered.length === 1 ? "" : "s"}</p><p>Generated {new Date().toLocaleString("en-PH")}</p></div>
      <div className="no-print">
        <div className="view-head">
          <h2><i className="fa-solid fa-clock-rotate-left"></i> Activity Log <small className="al-admin-tag"><i className="fa-solid fa-user-shield"></i> All users</small></h2>
          <div className="head-actions">
            <select className="filter-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Range">{RANGES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
            <button className="btn-ghost" onClick={exportCsv}><i className="fa-solid fa-file-csv"></i> Export CSV</button>
            <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Print</button>
          </div>
        </div>
        <p className="hint-text"><i className="fa-solid fa-user-shield"></i> <span>Admin view: the activity of <b>every farmer and the president</b> (and yours), with IP addresses, devices, and security alerts. Farmers and the president can only see their own log.</span></p>

        <div className="al-stats">
          <div className="al-stat"><b>{stats.events.toLocaleString()}</b><span>Events · {label.toLowerCase()}</span></div>
          <div className="al-stat"><b>{stats.active}</b><span>Active users</span></div>
          <div className="al-stat"><b>{stats.logins}</b><span>Sign-ins</span></div>
          <div className={`al-stat ${stats.failed ? "bad" : ""}`}><b>{stats.failed}</b><span>Failed sign-ins</span></div>
          <div className={`al-stat ${stats.newDev ? "warn" : ""}`}><b>{stats.newDev}</b><span>New-device sign-ins</span></div>
        </div>
        {rows.length >= LIMIT && <p className="hint-text"><i className="fa-solid fa-circle-info"></i> <span>Showing the latest {LIMIT.toLocaleString()} events in this range. Choose a shorter range to see the rest.</span></p>}

        <div className="al-tabs" role="tablist">
          <button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>All activity</button>
          <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>Users ({users.length})</button>
          <button className={tab === "security" ? "on" : ""} onClick={() => setTab("security")}>Security alerts{stats.failed + stats.newDev > 0 ? ` (${stats.failed + stats.newDev})` : ""}</button>
        </div>
      </div>

      {tab === "activity" && (
        <>
          <div className="al-filters no-print">
            <select className="filter-select" value={roleF} onChange={(e) => setRoleF(e.target.value)} aria-label="Role"><option value="all">All roles</option><option value="farmer">Farmers</option><option value="president">President</option><option value="admin">Admin</option></select>
            <select className="filter-select" value={userF} onChange={(e) => setUserF(e.target.value)} aria-label="User"><option value="all">All users</option>{userOptions.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}</select>
            <select className="filter-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">{KIND_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
            <select className="filter-select" value={devF} onChange={(e) => setDevF(e.target.value)} aria-label="Device"><option value="all">All devices</option><option>Desktop</option><option>Mobile</option><option>Tablet</option></select>
            <div className="table-search"><i className="fa-solid fa-magnifying-glass"></i><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, IP, page…" /></div>
          </div>
          <div className="table-panel">
            <table className="data-table print-table">
              <thead><tr><th>When</th><th>User</th><th>Activity</th><th>Device</th><th>IP address</th><th>Page</th></tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No activity matches these filters.</td></tr>}
                {filtered.slice(0, shown).map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmt(r.created_at)}<small style={{ display: "block", color: "var(--ink-soft)" }}>{ago(r.created_at)}</small></td>
                    <td><b>{r.name}</b><small style={{ display: "block", color: "var(--ink-soft)", textTransform: "capitalize" }}>{r.role}</small></td>
                    <td><What r={r} /></td><td><DeviceCell r={r} /></td>
                    <td style={{ fontFamily: "monospace", fontSize: ".78rem" }}>{r.ip_address || "—"}</td>
                    <td style={{ color: "var(--ink-soft)" }}>{r.page || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > shown && <div className="no-print" style={{ textAlign: "center", marginTop: 12 }}><button className="btn-ghost" onClick={() => setShown(shown + 150)}>Show more ({filtered.length - shown} left)</button></div>}
        </>
      )}

      {tab === "users" && (
        <div className="table-panel">
          <table className="data-table">
            <thead><tr><th>User</th><th>Last seen</th><th>Last device</th><th>Last IP</th><th>Sign-ins</th><th>Devices</th><th>Failed</th><th>Events</th><th></th></tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ink-soft)" }}>No activity in this range.</td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b><small style={{ display: "block", color: "var(--ink-soft)", textTransform: "capitalize" }}>{u.role}</small></td>
                  <td style={{ whiteSpace: "nowrap" }}>{Date.now() - new Date(u.last).getTime() < 5 * 60000 && <span className="al-dot" title="Active in the last 5 minutes"></span>}{ago(u.last)}<small style={{ display: "block", color: "var(--ink-soft)" }}>{fmt(u.last)}</small></td>
                  <td><DeviceCell r={u.lastRow} /></td>
                  <td style={{ fontFamily: "monospace", fontSize: ".78rem" }}>{u.lastIp || "—"}</td>
                  <td>{u.logins}</td><td>{u.devices.size}</td>
                  <td style={{ color: u.failed ? "var(--danger)" : undefined, fontWeight: u.failed ? 700 : 400 }}>{u.failed}</td>
                  <td>{u.events}</td>
                  <td><button className="btn-ghost" style={{ padding: "4px 10px", fontSize: ".72rem" }} onClick={() => openUser(u.id)}>View log</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "security" && (
        <>
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-head"><h3><i className="fa-solid fa-triangle-exclamation"></i> Repeated failed sign-ins</h3></div>
            {suspicious.length === 0 ? <p className="hint-text" style={{ margin: "0 4px" }}>No account has 3 or more failed sign-ins in this range.</p> : (
              <div className="table-panel no-shadow"><table className="data-table">
                <thead><tr><th>User</th><th>Failed attempts</th><th>Last attempt</th><th>From</th><th></th></tr></thead>
                <tbody>{suspicious.map((u) => {
                  const lastFail = failedRows.find((r) => r.user_id === u.id);
                  return (
                    <tr key={u.id}>
                      <td><b>{u.name}</b><small style={{ display: "block", color: "var(--ink-soft)", textTransform: "capitalize" }}>{u.role}</small></td>
                      <td><span className={`al-badge ${u.failed >= 5 ? "bad" : "warn"}`}>{u.failed}</span> {u.failed >= 5 && <small style={{ color: "var(--danger)" }}>Possible password guessing</small>}</td>
                      <td>{lastFail ? fmt(lastFail.created_at) : "—"}</td>
                      <td style={{ fontSize: ".78rem" }}>{lastFail ? `${lastFail.browser || ""} · ${lastFail.os || ""}${lastFail.ip_address ? ` · ${lastFail.ip_address}` : ""}` : "—"}</td>
                      <td><button className="btn-ghost" style={{ padding: "4px 10px", fontSize: ".72rem" }} onClick={() => openUser(u.id)}>View log</button></td>
                    </tr>
                  );
                })}</tbody></table></div>
            )}
          </div>
          <div className="panel">
            <div className="panel-head"><h3><i className="fa-solid fa-circle-exclamation"></i> Sign-ins from a new device</h3></div>
            {newDeviceRows.length === 0 ? <p className="hint-text" style={{ margin: "0 4px" }}>No sign-ins from a new device in this range.</p> : (
              <div className="table-panel no-shadow"><table className="data-table">
                <thead><tr><th>When</th><th>User</th><th>Device</th><th>IP address</th></tr></thead>
                <tbody>{newDeviceRows.map((r) => (
                  <tr key={r.id}><td style={{ whiteSpace: "nowrap" }}>{fmt(r.created_at)}</td><td><b>{r.name}</b><small style={{ display: "block", color: "var(--ink-soft)", textTransform: "capitalize" }}>{r.role}</small></td>
                    <td><DeviceCell r={r} /></td><td style={{ fontFamily: "monospace", fontSize: ".78rem" }}>{r.ip_address || "—"}</td></tr>
                ))}</tbody></table></div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default function ActivityLog() {
  const { role } = useAuth();
  // The admin gets the all-users view; every other role sees only their own account.
  return role === "admin" ? <AdminActivityLog /> : <MyActivityLog />;
}
