import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

// The president only works with members of the association; the admin sees every farmer.
//   null      -> no limit (admin / farmer)
//   undefined -> still loading
//   Set(ids)  -> only these farmers (association members)
export function useMemberScope() {
  const { role } = useAuth();
  const [ids, setIds] = useState(role === "president" ? undefined : null);
  useEffect(() => {
    if (role !== "president") { setIds(null); return undefined; }
    let off = false;
    supabase.from("farmers").select("id").eq("is_association_member", true)
      .then(({ data }) => { if (!off) setIds(new Set((data || []).map((r) => r.id))); });
    return () => { off = true; };
  }, [role]);
  return ids;
}
export const inScope = (ids, farmerId) => ids === null || (ids instanceof Set && ids.has(farmerId));
