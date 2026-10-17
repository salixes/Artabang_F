import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { valuesFromRecord } from "./rsbsaForm";

// Loads the saved paper-form answers (farmers.rsbsa_form) for a farmer row.
// If the column isn't there yet, or the farmer was enrolled before the paper
// form existed, the answers are rebuilt from the regular farmers columns.
export function useRsbsaValues(farmer) {
  const [state, setState] = useState({ loading: true, values: null });
  useEffect(() => {
    let off = false;
    if (!farmer.id) { setState({ loading: false, values: null }); return undefined; }
    setState({ loading: true, values: null });
    supabase.from("farmers").select("rsbsa_form").eq("id", farmer.id).maybeSingle().then(({ data }) => {
      if (off) return;
      setState({ loading: false, values: valuesFromRecord({ ...farmer, rsbsa_form: data?.rsbsa_form ?? null }) });
    });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmer.id]);
  return state;
}
