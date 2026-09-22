import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const ROLE_TABS = [
  { key: "farmer", label: "Farmer", icon: "fa-user" },
  { key: "admin", label: "ADMIN", icon: "fa-user-shield" },
  { key: "president", label: "Association President", icon: "fa-user-tie" },
];

export default function Login() {
  const { login, logout, session, role, loading, profileError } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("farmer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session && role) return <Navigate to={`/${role}`} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      // AuthContext will populate `role` on the next render once the
      // profile row loads; App.jsx's redirect route handles sending
      // the user to the right dashboard.
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src="/agritabang-logo.png" alt="AgriTabang" width="56" height="56" style={{ objectFit: "contain" }} />
          <div>
            <span className="login-brand-name">Agri<em>Tabang</em></span>
            <span className="login-brand-tag">Farmer Profiling &amp; Assistance Management System</span>
          </div>
        </div>

        {!loading && session && !role && profileError && (
          <div className="hint-text" style={{ color: "var(--danger)", background: "var(--cream)", border: "1px solid var(--cream-2)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
            <i className="fa-solid fa-triangle-exclamation"></i> {profileError}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn-ghost" onClick={async () => { await logout(); }}>Sign out and try again</button>
            </div>
          </div>
        )}

        <div className="login-role-tabs">
          {ROLE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`login-role-tab ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              <i className={`fa-solid ${t.icon}`}></i> {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. renante.salvana@example.com" required /></label>
          <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></label>
          {error && <p className="hint-text" style={{ color: "var(--danger)" }}><i className="fa-solid fa-triangle-exclamation"></i> {error}</p>}
          <button type="submit" className="btn-primary login-submit" disabled={submitting}>
            {submitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Signing in…</> : <><i className="fa-solid fa-right-to-bracket"></i> Sign In</>}
          </button>
        </form>

        <div className="login-security-note">
          <i className="fa-solid fa-shield-halved"></i>
          <span>Protected by Supabase Authentication &amp; Row-Level Security (RLS) — each role only accesses the modules it is authorized for.</span>
        </div>
      </div>
    </div>
  );
}
