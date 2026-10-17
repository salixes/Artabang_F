// Data model for the PCIC "Application for Crop Insurance (Individual Application)",
// form RC-UPI-01, Rev. 2025/Sep. Every box on the sheet lives in one `values`
// object that is saved whole (jsonb) next to the crop / insurance records it created,
// so the exact form can be viewed and printed again later.

import { CROP_LIST } from "./businessRules";
import { SEG, emptySeg, segDigits, todayISO } from "./rsbsaForm";

export const PCIC_SEG = { contact: SEG.mobile };
export const LOT_COUNT = 3;

export const CROPS = ["Rice", "Corn", "High-Value (Please Specify)"];
export const APP_TYPES = ["New Application", "Renewal"];
export const CATEGORIES = ["Self-Financed", "Borrowing"];
export const SEXES = ["Male", "Female"];
export const CIVILS = ["Single", "Married", "Widow/er", "Separated"];
export const PAYMENTS = ["LandBank or DBP", "Palawan Express", "GCash", "Others"];
export const PLANTING = ["Direct Seeded", "Transplanted"];
export const LAND = ["Irrigated", "Non-Irrigated"];
export const TENURE = ["Owner", "Lessee"];
export const PREMIUM = ["Non-Subsidized/Regular", "Subsidized/CFITF", "Subsidized/RSBSA", "Others"];

export const isHvc = (v) => (v.crop || "").startsWith("High");
export const isRenewal = (v) => v.appType === "Renewal";
export const isBorrowing = (v) => v.category === "Borrowing";
export const payIndex = (v) => PAYMENTS.indexOf(v.pay) + 1; // 1..4, 0 = none

export function emptyLot() {
  return {
    area: "", street: "", brgy: "", city: "", prov: "", north: "", east: "", south: "", west: "", geo: "",
    variety: "", plant: "", sow: "", planting: "", harvest: "", trees: "", land: "", tenure: "",
  };
}

export function emptyValues() {
  return {
    regional: "", crop: "", hvc: "", appType: "", totalArea: "", category: "", lender: "", appDate: todayISO(),
    lName: "", fName: "", mName: "", suffix: "", contact: emptySeg(PCIC_SEG.contact),
    street: "", brgy: "", city: "", prov: "", dob: "", sex: "",
    sPWD: false, sSenior: false, sYouth: false, sIP: false, tribe: "",
    civil: "", spouse: "",
    bL: "", bF: "", bM: "", bS: "", bRel: "", bBirth: "",
    gL: "", gF: "", gM: "", gS: "", gRel: "", gBirth: "",
    pay: "", acct1: "", acct2: "", acct3: "", acct4: "", payOther: "",
    lots: Array.from({ length: LOT_COUNT }, emptyLot),
    cover: "",
    cert1: false, cert2: false, cert3: false, sign: "", signDate: todayISO(),
    prem: "", ncfr: "", rsbsaRef: "", premOther: "",
  };
}

// Fields that are switched off are emptied too, like the form itself does.
export function applyDeps(v) {
  const n = { ...v };
  if (!isHvc(n)) n.hvc = "";
  if (!isBorrowing(n)) { n.lender = ""; n.cert3 = false; }
  if (isRenewal(n)) {
    // renewal: only B.4 – B.12 are filled in
    n.lots = n.lots.map((l) => ({ ...l, street: "", brgy: "", city: "", prov: "", north: "", east: "", south: "", west: "", geo: "" }));
  }
  if (n.civil !== "Married") n.spouse = "";
  if (!n.sIP) n.tribe = "";
  [1, 2, 3, 4].forEach((i) => { if (payIndex(n) !== i) n[`acct${i}`] = ""; });
  if (n.pay !== "Others") n.payOther = "";
  return n;
}

/* ---------------- validation ---------------- */
// Returns [{ key, msg }] — `key` is what the paper uses to outline the box.
export function validate(v) {
  const er = [];
  const t = (s) => (s ?? "").toString().trim();
  const need = (key, msg, ok) => { if (!ok) er.push({ key, msg }); };

  need("crop", "Crop is required", v.crop);
  if (isHvc(v)) need("hvc", "Please specify the High-Value crop", t(v.hvc));
  need("appType", "Application type is required", v.appType);
  need("totalArea", "Total area (hectares) is required", t(v.totalArea));
  need("category", "Farmer category is required", v.category);
  if (isBorrowing(v)) need("lender", "Lender is required for Borrowing farmers", t(v.lender));
  need("appDate", "Date of application is required", v.appDate);
  need("lName", "Last name is required", t(v.lName));
  need("fName", "First name is required", t(v.fName));
  if (segDigits(v.contact).length < 11) er.push({ key: "contact", msg: "Contact number must be 11 digits (09XXXXXXXXX)" });
  need("brgy", "Address: Barangay is required", t(v.brgy));
  need("city", "Address: Municipality/City is required", t(v.city));
  need("prov", "Address: Province is required", t(v.prov));
  need("dob", "Date of birth is required", v.dob);
  if (v.dob && new Date(v.dob) > new Date()) er.push({ key: "dob", msg: "Date of birth cannot be in the future" });
  need("sex", "Sex is required", v.sex);
  need("civil", "Civil status is required", v.civil);
  if (v.civil === "Married") need("spouse", "Name of spouse is required (Married)", t(v.spouse));
  if (v.sIP) need("tribe", "Please indicate the tribe", t(v.tribe));
  if ((t(v.bL) || t(v.bF)) && !t(v.bRel)) er.push({ key: "bRel", msg: "Beneficiary: relationship to applicant is required" });
  if (v.bBirth) {
    const age = (Date.now() - new Date(v.bBirth)) / 31557600000;
    if (age < 18 && (!t(v.gL) || !t(v.gF))) er.push({ key: "gL", msg: "Guardian name is required because the beneficiary is a minor" });
  }
  if (!v.pay) er.push({ key: "pay", msg: "Preferred payment method is required" });
  else {
    need(`acct${payIndex(v)}`, `Account number is required for ${v.pay}`, t(v[`acct${payIndex(v)}`]));
    if (v.pay === "Others") need("payOther", "Please specify the other payment method", t(v.payOther));
  }

  const l1 = v.lots[0];
  need("lot0Area", "Lot 1 area (ha.) is required", t(l1.area));
  if (!isRenewal(v) && !t(l1.geo)) {
    need("lot0Brgy", "Lot 1 Barangay is required (or enter a GeoRef/Farm ID)", t(l1.brgy));
    need("lot0City", "Lot 1 Municipality/City is required (or enter a GeoRef/Farm ID)", t(l1.city));
    need("lot0Prov", "Lot 1 Province is required (or enter a GeoRef/Farm ID)", t(l1.prov));
  }
  need("lot0Variety", "Lot 1 variety (B.4) is required", t(l1.variety));
  need("lot0Plant", "Lot 1 planting method (B.5) is required", l1.plant);
  need("lot0Land", "Lot 1 land category (B.10) is required", l1.land);
  need("lot0Tenure", "Lot 1 tenurial status (B.11) is required", l1.tenure);
  need("lot0Sow", "Lot 1 date of sowing (B.6) is required", l1.sow);
  need("lot0Planting", "Lot 1 date of planting (B.7) is required", l1.planting);
  need("lot0Harvest", "Lot 1 date of harvest (B.8) is required", l1.harvest);
  if (l1.planting && l1.harvest && l1.harvest < l1.planting) er.push({ key: "lot0Harvest", msg: "Lot 1 date of harvest cannot be before the date of planting" });
  if (isHvc(v)) need("lot0Trees", "Lot 1 number of trees/hills (B.9) is required for High-Value crops", t(l1.trees));
  need("cover", "B.12 Desired amount of cover is required", t(v.cover));

  need("cert1", "Certification (first box) must be ticked", v.cert1);
  need("cert2", "Data privacy consent (second box) must be ticked", v.cert2);
  if (isBorrowing(v)) need("cert3", "Deed of Assignment box must be ticked for borrowing farmers", v.cert3);
  need("sign", "Signature / thumb mark over printed name is required", t(v.sign));
  need("signDate", "Date of signature is required", v.signDate);

  const seen = new Set();
  return er.filter((e) => (seen.has(e.key) ? false : seen.add(e.key)));
}

/* ---------------- form -> crop / insurance records ---------------- */
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function canonicalCrop(v) {
  if (v.crop === "Rice" || v.crop === "Corn") return v.crop;
  const n = (v.hvc || "").trim();
  const hit = CROP_LIST.find((c) => norm(c) === norm(n) || norm(c.split(" (")[0]) === norm(n));
  return hit || n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
export const cropLabel = (v) => canonicalCrop(v);
export const applicantName = (v) => [v.fName, v.mName, v.lName, v.suffix].map((s) => (s || "").trim()).filter(Boolean).join(" ").toUpperCase();

export function toRecords(v, farmerId) {
  const crop_name = canonicalCrop(v);
  const lots = v.lots.filter((l) => Number(l.area) > 0);
  const l1 = v.lots[0];
  const planting_date = l1.planting;
  const insurance = {
    farmer_id: farmerId, crop_name, area: Number(v.totalArea) || lots.reduce((s, l) => s + Number(l.area), 0),
    planting_date, coverage_start_date: planting_date, coverage_end_date: l1.harvest || null,
    insurance_source: "PCIC", status: "Active", pcic_application: v,
  };
  const crops = lots.map((l) => ({
    farmer_id: farmerId, crop_name, area: Number(l.area), planting_date: l.planting || planting_date,
    variety: (l.variety || l1.variety || "").trim() || null,
    land_category: l.land || null, tenurial_status: l.tenure || null,
    cropping_schedule: l.sow && l.harvest ? `${l.sow} to ${l.harvest}` : null,
    no_of_heads_trees: (l.trees ?? "").toString().trim() || null,
    is_organic: false, pcic_application: v,
  }));
  return { insurance, crops };
}

/* ---------------- farmer profile -> prefilled applicant block ---------------- */
const pickOpt = (val, opts) => opts.find((o) => norm(o).startsWith(norm((val || "").split("/")[0]))) || "";
function mobile9(m) {
  let d = (m || "").replace(/\D/g, "");
  if (d.startsWith("63")) d = "0" + d.slice(2);
  if (d.startsWith("09")) d = d.slice(2); else if (d.startsWith("9")) d = d.slice(1);
  return d.slice(0, 9);
}
export function prefillFromFarmer(f) {
  const v = emptyValues();
  if (!f) return v;
  const up = (s) => (s || "").toString().toUpperCase();
  v.lName = up(f.surname); v.fName = up(f.first_name); v.mName = up(f.middle_name); v.suffix = up(f.extension_name);
  const digits = mobile9(f.mobile_number);
  v.contact = "09" + digits.padEnd(9, " ");
  v.street = up([f.house_no_purok, f.street_sitio_subdivision].filter(Boolean).join(", "));
  v.brgy = up(f.barangay); v.city = up(f.city_municipality); v.prov = up(f.province);
  v.dob = f.date_of_birth || ""; v.sex = SEXES.includes(f.sex) ? f.sex : "";
  v.civil = f.civil_status === "Widow/Widower" ? "Widow/er" : CIVILS.includes(f.civil_status) ? f.civil_status : pickOpt(f.civil_status, CIVILS);
  v.spouse = v.civil === "Married" ? up(f.spouse_name) : "";
  v.sPWD = !!f.is_pwd;
  v.sIP = !!f.is_icc_ip;
  if (f.date_of_birth) {
    const age = (Date.now() - new Date(f.date_of_birth)) / 31557600000;
    v.sYouth = age >= 18 && age <= 30;
    v.sSenior = age >= 60;
  }
  return v;
}

// Saved applications from older/newer revisions: merge over a blank form.
export function valuesFromSaved(saved) {
  const base = emptyValues();
  if (!saved || typeof saved !== "object") return base;
  const lots = Array.from({ length: LOT_COUNT }, (_, i) => ({ ...emptyLot(), ...(saved.lots?.[i] || {}) }));
  return { ...base, ...saved, lots };
}
