import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fails loudly instead of silently — see README "Setup" section.
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project credentials."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// A second client, pointed at the same project, but that never touches
// localStorage or the shared session. supabase.auth.signUp() on the MAIN
// client would sign the browser in as the newly created user, kicking the
// admin out of their own session — this isolated client lets ADMIN create a
// farmer's auth account without affecting their own login at all.
export const supabaseAuthOnly = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
