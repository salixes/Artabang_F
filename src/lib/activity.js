import { supabase } from "./supabaseClient";
import { getDeviceInfo } from "./device";

// Activity log: every call is fire-and-forget — logging must NEVER break or slow down the app.
let userId = null;
let warned = false;
export const setActivityUser = (id) => { userId = id || null; };

async function send(row) {
  if (!userId) return;
  try {
    const { error } = await supabase.from("activity_log").insert({ user_id: userId, ...getDeviceInfo(), ...row });
    if (error && !warned) { warned = true; console.warn("Activity log not saved:", error.message, "(has supabase/migrations/activity_log.sql been run?)"); }
  } catch (_) { /* never throw from logging */ }
}

const here = () => (typeof location !== "undefined" ? location.pathname : null);

// sign-in / sign-out
export const logAuth = (action, description) => send({ action, category: "auth", description, page: here() });

// something the user DID: logActivity("Registered crop Rice", "crop")
export const logActivity = (description, category = "general") => send({ action: "action", category, description, page: here() });

// a page they opened (same page again within 20 s is ignored)
let last = { path: null, at: 0 };
export function logPageView(path, label) {
  const now = Date.now();
  if (last.path === path && now - last.at < 20000) return;
  last = { path, at: now };
  send({ action: "page_view", category: "page", description: `Opened ${label || path}`, page: path });
}

// wrong password: they are not signed in yet, so the database records it by e-mail
export async function logLoginFailure(email) {
  try {
    const d = getDeviceInfo();
    await supabase.rpc("log_login_failure", {
      p_email: email, p_device_type: d.device_type, p_browser: d.browser, p_os: d.os,
      p_screen: d.screen, p_language: d.language, p_timezone: d.timezone, p_device_key: d.device_key,
    });
  } catch (_) { /* ignore */ }
}
