import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ allow, children }) {
  const { session, role, loading, profileError, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-forest-deep">
        <i className="fa-solid fa-spinner fa-spin mr-2"></i> Loading session…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!role) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ flexDirection: "column", gap: 12, padding: 24, textAlign: "center" }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ color: "var(--danger)", fontSize: "1.5rem" }}></i>
        <p>{profileError || "Signed in, but your account has no profile/role on file."}</p>
        <button className="btn-ghost" onClick={async () => { await logout(); }}>Sign out</button>
      </div>
    );
  }

  // allow can be a single role string or an array of role strings.
  if (allow) {
    const allowed = Array.isArray(allow) ? allow.includes(role) : allow === role;
    if (!allowed) return <Navigate to={`/${role}`} replace />;
  }

  return children;
}
