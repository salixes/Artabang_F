// Ported 1:1 from the original script.js so the numbers match the legacy system.

export const CROP_LIST = [
  "Corn", "Rice", "Banana", "Coffee", "Sugarcane", "Pineapple", "Cassava",
  "Sweet Potato (Camote)", "Tomato", "Pechay", "Eggplant (Talong)", "Ampalaya",
  "Okra", "String Beans (Sitaw)", "Cabbage",
];

// RSBSA (Registry System for Basic Sectors in Agriculture) reference lists
export const SEX_OPTIONS = ["Male", "Female"];
export const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated", "Divorced"];
export const EDUCATION_OPTIONS = [
  "None", "Elementary Level", "Elementary Graduate", "High School Level",
  "High School Graduate", "Vocational", "College Level", "College Graduate", "Post Graduate",
];
export const PROOF_OF_IDENTITY_OPTIONS = [
  "Philippine National ID", "Voter's ID / Certificate", "Barangay Certification",
  "Driver's License", "Passport", "PhilHealth ID", "SSS/GSIS ID", "Postal ID", "Other Government-Issued ID",
];
export const FARM_TYPE_OPTIONS = ["Lowland", "Upland", "Coastal/Fishpond", "Mixed"];
export const OWNERSHIP_TENURE_OPTIONS = ["Registered Owner", "Tenant", "Lessee", "CLOA Holder", "Others"];
export const DEFAULT_REGION = "Region X (Northern Mindanao)";
export const DEFAULT_PROVINCE = "Bukidnon";
export const DEFAULT_CITY_MUNICIPALITY = "Manolo Fortich";
export const DEFAULT_BARANGAY = "Lindaban";

export const DEFAULT_PRICE_PER_KG = 20;
export const INSURANCE_COVERAGE_RATE = 0.8;
export const ASSUMED_YIELD_PER_HA = 2000;

export function formatPeso(n) {
  return "₱" + Math.round(n || 0).toLocaleString();
}

// verifiedYields: array of { crop_name, quantity_kg } already filtered to status='Verified'
// cropPrices: { [crop_name]: price_per_kg }
export function calculateInsuranceCoverage({ crop_name, area }, verifiedYields, cropPrices) {
  const price = cropPrices[crop_name] || DEFAULT_PRICE_PER_KG;
  const cropYields = verifiedYields.filter((y) => y.crop_name === crop_name);

  if (cropYields.length) {
    const avgKg = cropYields.reduce((sum, y) => sum + Number(y.quantity_kg), 0) / cropYields.length;
    const value = Math.round(avgKg * price * INSURANCE_COVERAGE_RATE);
    return { value, basis: `${Math.round(avgKg).toLocaleString()} kg avg. verified harvest × ₱${price}/kg × ${INSURANCE_COVERAGE_RATE * 100}% coverage` };
  }
  const assumedKg = area * ASSUMED_YIELD_PER_HA;
  const value = Math.round(assumedKg * price * INSURANCE_COVERAGE_RATE);
  return { value, basis: `No verified harvest on file yet — estimated using ${ASSUMED_YIELD_PER_HA.toLocaleString()} kg/ha standard yield × ${area} ha × ₱${price}/kg × ${INSURANCE_COVERAGE_RATE * 100}% coverage` };
}

export const YIELD_UNITS = ["kg", "Sacks", "Cavans", "Other"];
export const YIELD_UNIT_LABELS = { kg: "Kilograms (kg)", Sacks: "Sacks", Cavans: "Cavans", Other: "Other" };

export const ASSISTANCE_TYPES = ["Cash Aid", "Seeds", "Fertilizer", "Farming Equipment", "Crop Insurance"];
export const ASSISTANCE_SOURCES = ["MAO", "Department of Agriculture", "Other Program"];
export const ASSISTANCE_UNITS = ["Bags", "Sacks", "Kilograms", "Units", "Pieces", "Liters"];
export const ASSISTANCE_STATUSES = ["Pending", "Under Review", "Incoming", "Released", "Denied"];
export const INSURANCE_SOURCES = ["PCIC", "Department of Agriculture", "Municipal Agriculture Office", "LGU-Funded"];

// The record's *effective* status is always derived from real data (the
// coverage end date) rather than a stored "Expired" flag someone forgot to
// set — this is what item 3 asks for ("do not manually hard-code Expired").
export function computeInsuranceStatus(record) {
  if (record.status === "Claimed" || record.status === "Cancelled") return record.status;
  if (record.coverage_end_date && new Date(record.coverage_end_date) < new Date()) return "Expired";
  return record.status === "Registered" ? "Active" : record.status;
}

// Basis + damage/claim math, following the exact chain the instructor asked
// for: Crop Value -> Damage Value -> Insurance Assistance.
export function computeInsuranceBasis(record, verifiedYields, cropPrices) {
  const price = cropPrices[record.crop_name] || DEFAULT_PRICE_PER_KG;
  const cropYields = (verifiedYields || []).filter((y) => y.crop_name === record.crop_name);
  let yieldKg, yieldBasisNote;
  if (cropYields.length) {
    yieldKg = cropYields.reduce((sum, y) => sum + Number(y.quantity_kg), 0) / cropYields.length;
    yieldBasisNote = `${Math.round(yieldKg).toLocaleString()} kg avg. verified harvest`;
  } else {
    yieldKg = Number(record.area) * ASSUMED_YIELD_PER_HA;
    yieldBasisNote = `${ASSUMED_YIELD_PER_HA.toLocaleString()} kg/ha assumed standard yield × ${record.area} ha (no verified harvest on file yet)`;
  }
  const cropValue = yieldKg * price;
  const coverageRate = Number(record.coverage_rate) || INSURANCE_COVERAGE_RATE;
  const damagePct = record.estimated_damage_percentage != null ? Number(record.estimated_damage_percentage) : null;
  const damageValue = damagePct != null ? cropValue * (damagePct / 100) : null;
  const insuranceAmount = damageValue != null ? damageValue * coverageRate : null;
  return {
    price, yieldKg, yieldBasisNote, cropValue, coverageRate,
    damagePct, damageValue, insuranceAmount,
    // Undamaged, no-claim estimate — what FarmerInsurance/AdminInsurance showed before claims existed.
    undamagedEstimate: cropValue * coverageRate,
  };
}

export const ASSISTANCE_REQUIREMENTS = {
  "Cash Aid": "Requires an updated profile photo, a registered crop, a farm size on file, and a verified harvest/yield record.",
  "Seeds": "Requires an updated profile photo, a registered crop, a farm size on file, and a verified harvest/yield record.",
  "Fertilizer": "Requires an updated profile photo, a registered crop, a farm size on file, and a verified harvest/yield record.",
  "Farming Equipment": "Requires an updated profile photo, a registered crop, a farm size on file, and active membership in a recognized farmers association. Given once per farmer.",
  "Crop Insurance": "Requires an updated profile photo, a registered crop, a farm size on file, a verified harvest/yield record, and that the affected crop was registered under Crop Insurance before any damage occurred.",
};

// Runs the same automatic qualification check for every role.
// farmer: row from farmer_directory (has photo_url, farm_size, is_association_member, crops, total_verified_yield)
// hasVerifiedYield / hasCropRegistered / hasInsuranceRegistered / hasEquipmentAlready: booleans computed by caller from real tables
export function runQualificationCheck(type, farmer, ctx) {
  const checks = [
    { label: "Profile photo on file", pass: !!farmer.photo_url },
    { label: "At least one crop registered", pass: !!ctx.hasCropRegistered },
    { label: "Farm size on file", pass: !!farmer.farm_size },
  ];

  if (type === "Farming Equipment") {
    checks.push({ label: "Active farmers association member", pass: !!farmer.is_association_member });
    checks.push({ label: "No equipment previously released", pass: !ctx.hasEquipmentAlready });
  } else {
    checks.push({ label: "Verified harvest/yield record on file", pass: !!ctx.hasVerifiedYield });
  }

  if (type === "Crop Insurance") {
    checks.push({ label: "Crop registered under Crop Insurance before damage", pass: !!ctx.hasInsuranceRegistered });
  }

  const qualified = checks.every((c) => c.pass);
  return { checks, qualified };
}
