// Deploy with: supabase functions deploy admin-create-user
// Called from the React app as:
//   supabase.functions.invoke('admin-create-user', { body: { email, password, full_name, role, ... } })
//
// This function runs with the service_role key (set automatically by Supabase
// for Edge Functions) so it can create auth.users rows — something the
// frontend must never be able to do directly. It also re-checks that the
// CALLER is an admin before doing anything, using the caller's own JWT.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Identify the caller from their JWT and confirm they are an admin.
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only ADMIN can create accounts" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      email, password, full_name, role = "farmer", contact_number,
      location, farm_size, is_association_member, association_id, crops,
      // RSBSA fields (all optional — only stored when role === "farmer")
      surname, first_name, middle_name, extension_name, sex, date_of_birth,
      place_of_birth, mobile_number, mothers_maiden_name, civil_status,
      spouse_name, religion, house_no_purok, street_sitio_subdivision,
      barangay, city_municipality, province, region, highest_formal_education,
      proof_of_identity, id_document_number, rsbsa_number, is_icc_ip, is_pwd,
      is_4ps_beneficiary, is_farmer, is_farmworker, is_fisherfolk, is_agri_youth,
      farm_location, farm_type, within_ancestral_domain, agrarian_reform_beneficiary,
      organic_agriculture_practitioner, ownership_tenure_type, land_owner_name,
      cropping_schedule, commodity, commodity_size, no_of_heads_trees,
    } = body;

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: "email, password, and full_name are required" }), { status: 400, headers: corsHeaders });
    }

    // 1. Create the Auth account.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }
    const newUserId = created.user.id;

    // 2. Create the profile row.
    const { error: profileErr } = await admin.from("profiles").insert({
      id: newUserId,
      role,
      full_name,
      email,
      contact_number: contact_number ?? null,
      avatar_seed: full_name.replace(/\s+/g, ""),
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(newUserId); // roll back the auth account
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: corsHeaders });
    }

    // 3. If a farmer, create the farmer row + crop list.
    if (role === "farmer") {
      const { error: farmerErr } = await admin.from("farmers").insert({
        id: newUserId,
        location: location ?? null,
        farm_size: farm_size || null,
        is_association_member: !!is_association_member,
        association_id: association_id ?? null,
        surname: surname ?? null, first_name: first_name ?? null, middle_name: middle_name ?? null,
        extension_name: extension_name ?? null, sex: sex ?? null, date_of_birth: date_of_birth || null,
        place_of_birth: place_of_birth ?? null, mobile_number: mobile_number ?? contact_number ?? null,
        mothers_maiden_name: mothers_maiden_name ?? null, civil_status: civil_status ?? null,
        spouse_name: spouse_name ?? null, religion: religion ?? null,
        house_no_purok: house_no_purok ?? null, street_sitio_subdivision: street_sitio_subdivision ?? null,
        barangay: barangay ?? "Lindaban", city_municipality: city_municipality ?? "Manolo Fortich",
        province: province ?? "Bukidnon", region: region ?? "Region X (Northern Mindanao)",
        highest_formal_education: highest_formal_education ?? null, proof_of_identity: proof_of_identity ?? null,
        id_document_number: id_document_number ?? null, rsbsa_number: rsbsa_number || null,
        is_icc_ip: !!is_icc_ip, is_pwd: !!is_pwd, is_4ps_beneficiary: !!is_4ps_beneficiary,
        is_farmer: is_farmer ?? true, is_farmworker: !!is_farmworker, is_fisherfolk: !!is_fisherfolk, is_agri_youth: !!is_agri_youth,
        farm_location: farm_location ?? null, farm_type: farm_type ?? null,
        within_ancestral_domain: !!within_ancestral_domain, agrarian_reform_beneficiary: !!agrarian_reform_beneficiary,
        organic_agriculture_practitioner: !!organic_agriculture_practitioner, ownership_tenure_type: ownership_tenure_type ?? null,
        land_owner_name: land_owner_name ?? null, cropping_schedule: cropping_schedule ?? null,
        commodity: commodity ?? null, commodity_size: commodity_size || null, no_of_heads_trees: no_of_heads_trees ?? null,
      });
      if (farmerErr) {
        await admin.auth.admin.deleteUser(newUserId);
        return new Response(JSON.stringify({ error: farmerErr.message }), { status: 400, headers: corsHeaders });
      }
      if (Array.isArray(crops) && crops.length) {
        await admin.from("farmer_crops").insert(crops.map((c: string) => ({ farmer_id: newUserId, crop_name: c })));
      }
    }

    return new Response(JSON.stringify({ id: newUserId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
