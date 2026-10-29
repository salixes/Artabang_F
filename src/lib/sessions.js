import { useEffect } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import { getDeviceInfo } from "./device";

// One row per signed-in browser in public.user_sessions. That is what makes
// "Terminate session" and "Log out all devices" possible: a device whose row was
// ended signs itself out within ~20 seconds. Everything here fails quietly when the
// migration (supabase/migrations/user_sessions.sql) has not been run yet.
const KEY = "agritabang.session";
const CHECK_EVERY = 20000;
let current = { id: null, key: null };

const newKey = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const currentSessionKey = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };

export async function registerSession(userId) {
  try {
    let key = currentSessionKey();
    if (key) {
      const { data } = await supabase.from("user_sessions").select("id, ended_at").eq("user_id", userId).eq("session_key", key).maybeSingle();
      if (data && !data.ended_at) { current = { id: data.id, key }; return current; }
    }
    key = newKey(); // new sign-in, or the old session was ended
    localStorage.setItem(KEY, key);
    const d = getDeviceInfo();
    const { data, error } = await supabase.from("user_sessions")
      .insert({ user_id: userId, session_key: key, device_key: d.device_key, device_type: d.device_type, browser: d.browser, os: d.os, screen: d.screen })
      .select("id").single();
    if (error || !data) return null;
    current = { id: data.id, key };
    return current;
  } catch (_) { return null; }
}

// "ok" | "ended" | "none" (not tracked / migration missing)
export async function checkSession() {
  if (!current.id) return "none";
  try {
    const { data, error } = await supabase.from("user_sessions").select("ended_at").eq("id", current.id).maybeSingle();
    if (error || !data) return "none";
    if (data.ended_at) return "ended";
    supabase.from("user_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", current.id).is("ended_at", null).then(() => {}, () => {});
    return "ok";
  } catch (_) { return "none"; }
}

export async function endCurrentSession(reason = "logout") {
  const id = current.id;
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
  current = { id: null, key: null };
  if (!id) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("user_sessions").update({ ended_at: new Date().toISOString(), ended_by: user?.id || null, end_reason: reason }).eq("id", id).is("ended_at", null);
  } catch (_) { /* ignore */ }
}

// every way of signing out (sidebar, top bar, the guard) goes through supabase.auth.signOut — mark the session ended first
let hooked = false;
function hookSignOut() {
  if (hooked) return;
  hooked = true;
  const original = supabase.auth.signOut.bind(supabase.auth);
  supabase.auth.signOut = async (...args) => {
    await Promise.race([endCurrentSession("logout"), new Promise((r) => setTimeout(r, 1200))]);
    return original(...args);
  };
}

// Runs inside the signed-in layout.
export function useSessionGuard() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile?.id) return undefined;
    hookSignOut();
    let stopped = false, timer = null;
    const forceLogout = async () => {
      stopped = true;
      try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
      current = { id: null, key: null };
      try { await supabase.auth.signOut({ scope: "local" }); } catch (_) { /* ignore */ }
      alert("Your session was ended — you were signed out from another device or by the admin. Please sign in again.");
    };
    const tick = async () => {
      if (stopped) return;
      if ((await checkSession()) === "ended") return forceLogout();
      timer = setTimeout(tick, CHECK_EVERY);
    };
    registerSession(profile.id).then(() => { if (!stopped) timer = setTimeout(tick, CHECK_EVERY); });
    const onVisible = () => { if (document.visibilityState === "visible" && !stopped) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [profile?.id]);
}
