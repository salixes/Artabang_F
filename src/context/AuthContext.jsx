import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // row from public.profiles (includes role)
  const [farmer, setFarmer] = useState(null); // row from public.farmers, only when role === 'farmer'
  const [loading, setLoading] = useState(true);

  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setFarmer(null);
      setProfileError(null);
      return;
    }
    const { data: profileRow, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load profile:", error.message);
      setProfile(null);
      setFarmer(null);
      setProfileError(error.message);
      return;
    }
    if (!profileRow) {
      const msg = "Signed in, but no matching profile record exists for this account yet. Ask ADMIN to check the profiles table for this user.";
      console.error(msg);
      setProfile(null);
      setFarmer(null);
      setProfileError(msg);
      return;
    }
    setProfileError(null);
    setProfile(profileRow);

    if (profileRow.role === "farmer") {
      const { data: farmerRow } = await supabase
        .from("farmers")
        .select("*, associations(name)")
        .eq("id", userId)
        .single();
      setFarmer(farmerRow || null);
    } else {
      setFarmer(null);
    }
  }, []);

  const refreshProfile = useCallback(() => {
    if (session?.user?.id) return loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await loadProfile(newSession?.user?.id);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    farmer,
    role: profile?.role ?? null,
    loading,
    profileError,
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
