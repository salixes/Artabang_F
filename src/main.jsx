import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { hasSupabaseEnv } from "./lib/supabaseClient";
import "./index.css";
import "./form-borders.css";

// Shown instead of a blank white page when the .env file is missing.
function MissingEnv() {
  const box = { fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "8vh auto", padding: 28, border: "2px solid #C24444", borderRadius: 14, background: "#fff", color: "#1C2A20", lineHeight: 1.5 };
  const code = { background: "#f1f1f1", padding: "10px 12px", borderRadius: 8, display: "block", whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 13 };
  return (
    <div style={box}>
      <h2 style={{ marginTop: 0 }}>AgriTabang can't connect — the .env file is missing</h2>
      <p>This project needs your Supabase credentials. Create a file named <b>.env</b> in the project's main folder (the same folder as <b>package.json</b>) with:</p>
      <code style={code}>{"VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-public-key"}</code>
      <p>Find both in Supabase → <b>Project Settings → API</b> (Project URL and the <i>anon public</i> key).</p>
      <p>Then <b>stop</b> the server (Ctrl+C) and run <b>npm run dev</b> again — Vite only reads .env when it starts.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {!hasSupabaseEnv ? (
      <MissingEnv />
    ) : (
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    )}
  </React.StrictMode>
);
