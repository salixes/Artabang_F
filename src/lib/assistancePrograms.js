import { todayISO } from "./rsbsaForm";
import { CROP_LIST, INSURANCE_SOURCES, formatPeso } from "./businessRules";

// An "Assistance" announcement type -> the assistance_records type it creates.
// (The database trigger applies the same mapping, so the client can't get it wrong.)
export const recordTypeFor = (t) => (t === "Cash Assistance" ? "Cash Aid" : t);

// Applications are open until the end of the deadline day (no deadline = always open).
export const isApplicationOpen = (a) => !a.deadline || a.deadline >= todayISO();

export const fmtDate = (d) => new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

// ---- kinds of assistance (what the MAO can give) ----------------------------
export const ASSISTANCE_KINDS = [
  { label: "Cash Assistance", icon: "fa-hand-holding-dollar" },
  { label: "Seeds", icon: "fa-seedling" },
  { label: "Fertilizer", icon: "fa-leaf" },
  { label: "Farming Equipment", icon: "fa-tractor" },
  { label: "Crop Insurance", icon: "fa-shield-heart" },
  { label: "Other Support Program", icon: "fa-hand-holding-heart" },
];
export const audienceLabel = (a) => (a.audience === "all" ? "All farmers" : `${(a.target_crops || []).join(", ")} farmers`);

// ---- kinds of announcement (what the admin picks when posting) --------------
export const ANNOUNCEMENT_KINDS = [
  { key: "General", icon: "fa-bullhorn", hint: "News and notices for everyone." },
  { key: "Alert", icon: "fa-triangle-exclamation", hint: "An urgent reminder or warning." },
  { key: "Event", icon: "fa-calendar-days", hint: "A meeting, training or gathering." },
  { key: "Assistance", icon: "fa-hand-holding-dollar", hint: "Cash, seeds, fertilizer, equipment or insurance. It appears directly in each matching farmer's Eligibility page, where they can apply." },
];
export const KIND_FILTERS = ["All", ...ANNOUNCEMENT_KINDS.map((k) => k.key)];
export const kindIcon = (k) => ANNOUNCEMENT_KINDS.find((x) => x.key === k)?.icon || "fa-bullhorn";
// announcements posted before "kind" existed only had an icon
export const kindOfAnnouncement = (a) => a.kind || ({ "fa-triangle-exclamation": "Alert", "fa-calendar-days": "Event" })[a.icon] || "General";

// ---- what each kind of assistance needs ------------------------------------
const CASH_MODES = ["Cash pick-up at the MAO", "Bank transfer", "GCash / e-wallet", "Through the farmers association"];
const FERTILIZERS = ["Urea (46-0-0)", "Complete (14-14-14)", "Ammonium sulfate (21-0-0)", "Ammonium phosphate (16-20-0)", "Organic / compost", "Other"];
const loaned = (v) => /^Loaned/.test(v.terms || "");
const TERMS = ["Given outright", "Loaned — must be returned"];

// 1) The PROGRAM: what the admin announces (saved in assistance_announcements.details)
export const PROGRAM_FIELDS = {
  "Cash Assistance": [
    { key: "amount", label: "Amount per farmer (₱)", type: "number", required: true, placeholder: "e.g. 3000" },
    { key: "release_mode", label: "How it will be released", type: "select", options: CASH_MODES, required: true },
    { key: "venue", label: "Where / when to claim", type: "text", placeholder: "e.g. Barangay Hall, Oct 30, 8 AM" },
  ],
  "Seeds": [
    { key: "item", label: "Seed type / variety", type: "text", required: true, placeholder: "e.g. Certified hybrid corn seeds" },
    { key: "quantity", label: "Quantity per farmer", type: "number", required: true },
    { key: "unit", label: "Unit", type: "select", options: ["Kilograms", "Sacks", "Bags"], required: true },
    { key: "venue", label: "Where / when to claim", type: "text" },
  ],
  "Fertilizer": [
    { key: "item", label: "Fertilizer type", type: "select", options: FERTILIZERS, required: true },
    { key: "quantity", label: "Quantity per farmer", type: "number", required: true },
    { key: "unit", label: "Unit", type: "select", options: ["Bags", "Sacks", "Kilograms", "Liters"], required: true },
    { key: "venue", label: "Where / when to claim", type: "text" },
  ],
  "Farming Equipment": [
    { key: "item", label: "Equipment", type: "text", required: true, placeholder: "e.g. Hand tractor, knapsack sprayer" },
    { key: "quantity", label: "Units available", type: "number", required: true },
    { key: "terms", label: "Terms", type: "select", options: TERMS, required: true },
    { key: "venue", label: "Where / when to claim", type: "text" },
  ],
  "Crop Insurance": [
    { key: "insurer", label: "Insurer / provider", type: "select", options: INSURANCE_SOURCES, required: true },
    { key: "coverage", label: "What is covered", type: "text", placeholder: "e.g. Typhoon, flood and drought damage" },
    { key: "subsidy", label: "Premium", type: "select", options: ["Fully subsidized (free to the farmer)", "Partly subsidized", "Paid by the farmer"], required: true },
  ],
  "Other Support Program": [
    { key: "item", label: "What is being given", type: "text", required: true },
    { key: "venue", label: "Where / when to claim", type: "text" },
  ],
};

// 2) The RELEASE: what the admin records for each farmer in Assistance Management
//    (saved in assistance_records.details; quantity/unit are mirrored into the old columns)
export const RELEASE_FIELDS = {
  "Cash Aid": [
    { key: "amount", label: "Amount released (₱)", type: "number", required: true },
    { key: "release_mode", label: "How it was released", type: "select", options: CASH_MODES, required: true },
    { key: "reference_no", label: "Voucher / receipt no.", type: "text" },
  ],
  "Seeds": [
    { key: "item", label: "Seed type / variety", type: "text", required: true },
    { key: "quantity", label: "Quantity given", type: "number", required: true },
    { key: "unit", label: "Unit", type: "select", options: ["Kilograms", "Sacks", "Bags"], required: true },
    { key: "crop", label: "For which crop", type: "select", options: CROP_LIST },
  ],
  "Fertilizer": [
    { key: "item", label: "Fertilizer type", type: "select", options: FERTILIZERS, required: true },
    { key: "quantity", label: "Quantity given", type: "number", required: true },
    { key: "unit", label: "Unit", type: "select", options: ["Bags", "Sacks", "Kilograms", "Liters"], required: true },
  ],
  "Farming Equipment": [
    { key: "item", label: "Equipment given", type: "text", required: true },
    { key: "quantity", label: "Units given", type: "number", required: true },
    { key: "terms", label: "Terms", type: "select", options: TERMS, required: true },
    { key: "return_date", label: "Return date", type: "date", showIf: loaned },
    { key: "serial_no", label: "Serial / property no.", type: "text" },
  ],
  "Crop Insurance": [
    { key: "insurer", label: "Insurer / provider", type: "select", options: INSURANCE_SOURCES, required: true },
    { key: "policy_no", label: "Policy / reference no.", type: "text", required: true },
    { key: "coverage_amount", label: "Coverage amount (₱)", type: "number" },
    { key: "coverage_until", label: "Covered until", type: "date" },
  ],
  "Other Support Program": [
    { key: "item", label: "What was given", type: "text", required: true },
    { key: "quantity", label: "Quantity", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: ["Bags", "Sacks", "Kilograms", "Units", "Pieces", "Liters"] },
  ],
};

const visible = (f, values) => !f.showIf || f.showIf(values);
const filled = (v) => v !== undefined && v !== null && v !== "";

// labels of required fields that are still empty
export const missingRequired = (fields, values) => fields.filter((f) => f.required && visible(f, values) && !filled(values[f.key])).map((f) => f.label);
// only the fields that belong to this kind (and are shown), with empty ones dropped
export function cleanDetails(fields, values) {
  const out = {};
  fields.forEach((f) => { if (visible(f, values) && filled(values[f.key])) out[f.key] = f.type === "number" ? Number(values[f.key]) : values[f.key]; });
  return out;
}

const money = new Set(["amount", "coverage_amount"]);
function rowsFor(fields, d) {
  const rows = [];
  fields.forEach((f) => {
    if (f.key === "unit" || !visible(f, d) || !filled(d[f.key])) return;
    let text = String(d[f.key]);
    if (money.has(f.key)) text = formatPeso(Number(d[f.key]));
    else if (f.key === "quantity") text = `${d[f.key]}${d.unit ? " " + d.unit : ""}`;
    else if (f.type === "date") text = fmtDate(d[f.key]);
    rows.push([f.label, text]);
  });
  return rows;
}
// [label, value] rows for what a program announces
export const programDetailRows = (type, details) => rowsFor(PROGRAM_FIELDS[type] || [], details || {});
// [label, value] rows for what was released to one farmer
export function releaseDetailRows(r) {
  const rows = rowsFor(RELEASE_FIELDS[r.assistance_type] || [], r.details || {});
  if (!rows.length && r.quantity) rows.push(["Quantity", `${r.quantity} ${r.unit || ""}`.trim()]);
  return rows;
}
// one-line summary for tables
export function releaseSummary(r) {
  const d = r.details || {};
  if (r.assistance_type === "Cash Aid") {
    const amt = d.amount ?? (r.unit === "PHP" ? r.quantity : null);
    return amt ? formatPeso(Number(amt)) : "—";
  }
  if (r.assistance_type === "Crop Insurance") return d.policy_no ? `Policy ${d.policy_no}` : (d.insurer || "—");
  const qty = r.quantity ? `${r.quantity} ${r.unit || ""}`.trim() : "";
  return [d.item, qty].filter(Boolean).join(" — ") || "—";
}
// pre-fill the release form from the posted program (amount, item, quantity ...)
export function defaultsFromProgram(recordType, programDetails) {
  const p = programDetails || {};
  const keys = (RELEASE_FIELDS[recordType] || []).map((f) => f.key);
  const out = {};
  keys.forEach((k) => { if (filled(p[k])) out[k] = p[k]; });
  if (recordType === "Farming Equipment") out.quantity = 1; // "units available" is the stock, each farmer usually gets one
  return out;
}

// Where clicking a notification should take the user.
export function notificationPath(n, role) {
  if (n.category === "announcement") return `/${role}/announcements`;
  if (n.category === "assistance") return `/${role}/eligibility`;      // farmer: see eligibility + apply
  if (n.category === "application") return `/${role}/assistance`;      // admin: Assistance Management
  if (n.category === "crop_verification") return `/${role}/crops`;      // admin: Crop Verification
  if (n.category === "crop") return `/${role}/crops`;                   // farmer: result of their crop registration
  return null;
}
