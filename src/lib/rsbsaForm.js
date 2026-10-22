// Data model for the RSBSA Enrollment Form (Revised Version 01-2024).
// Everything on the paper form — every box, radio, parcel row and signature
// line — lives in one `values` object. It is saved whole in farmers.rsbsa_form
// (jsonb) and the headline answers are also mirrored to the existing farmers
// columns so the rest of AgriTabang (profile, eligibility, reports) keeps working.

import { CROP_LIST, EDUCATION_OPTIONS } from "./businessRules";

/* ------------------------------------------------------------------ */
/* Digit-box ("seg") helpers                                           */
/* ------------------------------------------------------------------ */
// A pattern such as "xx-xx-xxxx" describes the boxes: "x" = writable box,
// any other digit = pre-printed box, "-" = dash between boxes.
export const SEG = {
  pcn: "xxxx-xxxx-xxxx-xxxx",
  trn: "xxxxxxxxxxxxxxxxxxx",
  dob: "xx-xx-xxxx",
  mobile: "09xxxxxxxxx",
  rsbsa: "xx-xx-xx-xxx-xxxxxx",
};
export const slotCount = (pattern) => [...pattern].filter((c) => c !== "-").length;
// Stored value = one char per box; a blank box is a space.
export const emptySeg = (pattern) => [...pattern].filter((c) => c !== "-").map((c) => (c === "x" ? " " : c)).join("");
export const segDigits = (value) => (value || "").replace(/\s/g, "");

/* ------------------------------------------------------------------ */
/* Option lists exactly as printed on the form                         */
/* ------------------------------------------------------------------ */
export const SEX = ["Male (Lalaki)", "Female (Babae)"];
export const CIVIL = ["Single (Walang asawa)", "Widow/er (Balo)", "Married (Kasal)", "Legally Separated (Hiwalay)"];
export const RELIGION = ["Christianity", "Islam", "Others", "None"];
export const EDUCATION = [
  "Pre-school", "Senior High School (K-12)", "Elementary", "College", "High School (non K-12)",
  "Post-graduate", "Junior High School (K-12)", "Vocational", "None",
];
export const YES_NO = ["Yes", "No"];
export const LIVELIHOOD = ["FARMER (MAGSASAKA)", "FARM WORKER (MANGGAGAWA SA SAKAHAN)", "FISHER (MANGINGISDA)", "AGRI-YOUTH"];
export const TENURE = ["Registered Owner", "Lessee", "Tenant", "Others"];
export const FARM_TYPES = ["1", "2", "3", "4", "N/A"];
const FARM_TYPE_LABEL = { "1": "Irrigated", "2": "Rainfed Upland", "3": "Rainfed Lowland", "4": "Urban/Peri-Urban", "N/A": "N/A" };

export const PARCEL_COUNT = 3;
export const CROP_ROWS = 6; // 4 rows, "for intercropping" bar, then 2 rows

/* ------------------------------------------------------------------ */
/* Blank form                                                          */
/* ------------------------------------------------------------------ */
export const todayISO = () => {
  const d = new Date(); // local date (not UTC), so early-morning Philippine time isn't "yesterday"
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function emptyParcel() {
  return {
    brgy: "", city: "", area: "", ad: "", arb: "", proof: "", tenure: "",
    loFirst: "", loSur: "", loExt: "", loNo: emptySeg(SEG.rsbsa),
    tiller: "", tlNo: emptySeg(SEG.rsbsa), remarks: "",
    rows: Array.from({ length: CROP_ROWS }, () => ({ crop: "", comm: "", size: "", heads: "", type: "", org: "" })),
  };
}

export function emptyValues() {
  return {
    pcn: emptySeg(SEG.pcn), trn: emptySeg(SEG.trn),
    surname: "", firstName: "", middleName: "", noMid: false, ext: "", noExt: false, sex: "",
    pHouse: "", pStreet: "", pBrgy: "", pCity: "", pProv: "", pRegion: "",
    vHouse: "", vStreet: "", vBrgy: "", vCity: "", vProv: "", vRegion: "",
    dob: emptySeg(SEG.dob), pobCity: "", pobProv: "",
    mFirst: "", mMid: "", mSur: "", mExt: "",
    mobile: emptySeg(SEG.mobile), ownMobile: "", ownerName: "", ownerRel: "",
    civil: "", spFirst: "", spMid: "", spSur: "", spExt: "", spNo: emptySeg(SEG.rsbsa),
    religion: "", edu: "", idType: "", idNo: "",
    icc: "", iccName: "", pwd: "", fourPs: "",
    org1: "", org2: "", org3: "",
    livelihood: "",
    parcels: Array.from({ length: PARCEL_COUNT }, emptyParcel),
    signDate: todayISO(), printedName: "", signature: "",
  };
}

/* ------------------------------------------------------------------ */
/* Dependent fields (same rules as the form's own behaviour)           */
/* ------------------------------------------------------------------ */
export const isMarried = (v) => (v.civil || "").startsWith("Married");
export const isFarmer = (v) => (v.livelihood || "").startsWith("FARMER");
export const isNcr = (v) => /ncr|national capital/i.test(v.pRegion || "");

// Fields that are switched off are also emptied, like the form does.
export function applyDeps(v) {
  const n = { ...v };
  if (n.noMid) n.middleName = "";
  if (n.noExt) n.ext = "";
  if (n.ownMobile !== "No") { n.ownerName = ""; n.ownerRel = ""; }
  if (!isMarried(n)) { n.spFirst = ""; n.spMid = ""; n.spSur = ""; n.spExt = ""; n.spNo = emptySeg(SEG.rsbsa); }
  if (n.icc !== "Yes") n.iccName = "";
  return n;
}

/* ------------------------------------------------------------------ */
/* Validation (required boxes + a few conditional ones)                */
/* ------------------------------------------------------------------ */
// Returns [{ key, msg }]. `key` is what the paper component uses to outline the box.
export function validate(v) {
  const er = [];
  const need = (key, msg, ok) => { if (!ok) er.push({ key, msg: msg + " is required" }); };
  const t = (s) => (s || "").toString().trim();

  need("surname", "Surname", t(v.surname));
  need("firstName", "First name", t(v.firstName));
  if (!v.noMid) need("middleName", "Middle name (or tick No Middle Name)", t(v.middleName));
  need("sex", "Sex", v.sex);
  need("pBrgy", "Permanent address: Barangay", t(v.pBrgy));
  need("pCity", "Permanent address: City/Municipality", t(v.pCity));
  need("pProv", "Permanent address: Province", t(v.pProv));
  need("pRegion", "Permanent address: Region", t(v.pRegion));

  const d = segDigits(v.dob);
  if (d.length < 8) er.push({ key: "dob", msg: "Date of birth is required (MM-DD-YYYY)" });
  else {
    const m = +d.slice(0, 2), dd = +d.slice(2, 4), y = +d.slice(4), tt = new Date(y, m - 1, dd);
    if (tt.getMonth() !== m - 1 || tt.getDate() !== dd || y < 1900 || tt > new Date()) er.push({ key: "dob", msg: "Date of birth is not a valid date" });
  }
  need("pobCity", "Place of birth: City/Municipality", t(v.pobCity));
  need("mFirst", "Mother's maiden name: First name", t(v.mFirst));
  need("mSur", "Mother's maiden name: Surname", t(v.mSur));
  if (segDigits(v.mobile).length < 11) er.push({ key: "mobile", msg: "Mobile number must be 11 digits (09XXXXXXXXX)" });
  need("ownMobile", "Own the mobile number (Yes/No)", v.ownMobile);
  if (v.ownMobile === "No") need("ownerName", "Full name of the mobile number owner", t(v.ownerName));
  need("civil", "Civil status", v.civil);
  if (isMarried(v)) need("spFirst", "Spouse first name (Married)", t(v.spFirst));
  need("religion", "Religion", v.religion);
  need("edu", "Highest formal education", v.edu);
  need("idType", "ID/Document Type", t(v.idType));
  need("idNo", "ID/Document Number", t(v.idNo));
  need("icc", "Part of ICC/IP (Yes/No)", v.icc);
  if (v.icc === "Yes") need("iccName", "Name of ICC/IP", t(v.iccName));
  need("pwd", "PWD (Yes/No)", v.pwd);
  need("fourPs", "4Ps Beneficiary (Yes/No)", v.fourPs);
  need("livelihood", "Livelihood profile (Part 2)", v.livelihood);

  if (isFarmer(v)) {
    const p = v.parcels[0];
    need("p0Brgy", "Parcel 1: Barangay", t(p.brgy));
    need("p0City", "Parcel 1: City/Municipality, Province", t(p.city));
    need("p0Area", "Parcel 1: Total parcel area", t(p.area));
  }
  need("signDate", "Date (Part 4)", t(v.signDate));
  need("printedName", "Printed name of registrant", t(v.printedName));
  need("signature", "Signature of the registrant (click the signature box to sign)", t(v.signature));

  // one message per key
  const seen = new Set();
  return er.filter((e) => (seen.has(e.key) ? false : seen.add(e.key)));
}

/* ------------------------------------------------------------------ */
/* System-generated numbers (as in the original form)                  */
/* ------------------------------------------------------------------ */
const gen = (n) => { let r = ""; while (r.length < n) r += Math.floor(Math.random() * 10); return r; };
const fillSeg = (pattern, digits) => {
  const slots = [...pattern].filter((c) => c !== "-");
  let k = 0;
  return slots.map((c) => (c === "x" ? (digits[k++] || " ") : c)).join("");
};

// Adds the transaction code (TRN) and RSBSA numbers the system is meant to issue.
export function withGeneratedNumbers(v) {
  const n = { ...v, parcels: v.parcels.map((p) => ({ ...p })) };
  if (!segDigits(n.pcn) && !segDigits(n.trn)) n.trn = fillSeg(SEG.trn, gen(19));
  if (n.spFirst.trim() && segDigits(n.spNo).length === 0) n.spNo = fillSeg(SEG.rsbsa, gen(15));
  n.parcels.forEach((p) => {
    if (p.loFirst.trim() && segDigits(p.loNo).length === 0) p.loNo = fillSeg(SEG.rsbsa, gen(15));
    if (p.tiller.trim() && segDigits(p.tlNo).length === 0) p.tlNo = fillSeg(SEG.rsbsa, gen(15));
  });
  return n;
}

export const transactionCode = (v) => segDigits(v.pcn) || segDigits(v.trn);

/* ------------------------------------------------------------------ */
/* Form  ->  farmers table columns                                     */
/* ------------------------------------------------------------------ */
const U = (s) => (s || "").toString().trim().toUpperCase();
const nul = (s) => (s === "" || s === undefined ? null : s);
const head = (s) => (s || "").split(" (")[0];
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const matchOption = (label, options) => options.find((o) => norm(o) === norm(label)) || options.find((o) => norm(label).startsWith(norm(o))) || null;

function canonicalCrop(name) {
  const n = (name || "").trim();
  if (!n) return "";
  const hit = CROP_LIST.find((c) => norm(c) === norm(n) || norm(c.split(" (")[0]) === norm(n));
  if (hit) return hit;
  return n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function dobToISO(seg) {
  const d = segDigits(seg);
  if (d.length < 8) return null;
  return `${d.slice(4)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
}

export const fullNameFromValues = (v) => [U(v.firstName), v.noMid ? "" : U(v.middleName), U(v.surname), v.noExt ? "" : U(v.ext)].filter(Boolean).join(" ");

export function toFarmerColumns(v, associations = []) {
  const p1 = v.parcels[0];
  const usedParcels = v.parcels.filter((p) => p.brgy.trim() || p.city.trim() || p.area);
  const totalArea = v.parcels.reduce((s, p) => s + (Number(p.area) || 0), 0);
  const firstRow = v.parcels.flatMap((p) => p.rows).find((r) => r.comm.trim() || r.crop.trim() || r.size);
  const anyType = v.parcels.flatMap((p) => p.rows).find((r) => r.type)?.type;
  const assoc = associations.find((a) => norm(a.name) === norm(v.org1));
  const civilHead = head(v.civil);
  const crops = [...new Set(v.parcels.flatMap((p) => p.rows).map((r) => canonicalCrop(r.comm)).filter(Boolean))];

  return {
    columns: {
      surname: U(v.surname), first_name: U(v.firstName),
      middle_name: v.noMid ? null : nul(U(v.middleName)), extension_name: v.noExt ? null : nul(U(v.ext)),
      sex: head(v.sex) || null, date_of_birth: dobToISO(v.dob),
      place_of_birth: [U(v.pobCity), U(v.pobProv)].filter(Boolean).join(", ") || null,
      mobile_number: segDigits(v.mobile) || null,
      own_mobile_number: v.ownMobile !== "No",
      mobile_owner_name: v.ownMobile === "No" ? nul(U(v.ownerName)) : null,
      mobile_owner_relationship: v.ownMobile === "No" ? nul(U(v.ownerRel)) : null,
      mother_first_name: nul(U(v.mFirst)), mother_middle_name: nul(U(v.mMid)), mother_surname: nul(U(v.mSur)),
      civil_status: civilHead === "Widow/er" ? "Widow/Widower" : civilHead || null,
      spouse_name: isMarried(v) ? nul([U(v.spFirst), U(v.spMid), U(v.spSur), U(v.spExt)].filter(Boolean).join(" ")) : null,
      religion: v.religion || null,
      house_no_purok: nul(U(v.pHouse)), street_sitio_subdivision: nul(U(v.pStreet)),
      barangay: nul(U(v.pBrgy)), city_municipality: nul(U(v.pCity)), province: nul(U(v.pProv)), region: nul(U(v.pRegion)),
      highest_formal_education: matchOption(v.edu, EDUCATION_OPTIONS) || v.edu || null,
      proof_of_identity: nul(U(v.idType)), id_document_number: nul(U(v.idNo)),
      is_icc_ip: v.icc === "Yes", is_pwd: v.pwd === "Yes", is_4ps_beneficiary: v.fourPs === "Yes",
      organization_2: nul(U(v.org2)), organization_3: nul(U(v.org3)),
      // only a *registered* association counts as membership in the rest of the system
      is_association_member: !!assoc, association_id: assoc ? assoc.id : null,
      is_farmer: isFarmer(v), is_farmworker: (v.livelihood || "").startsWith("FARM WORKER"),
      is_fisherfolk: (v.livelihood || "").startsWith("FISHER"), is_agri_youth: v.livelihood === "AGRI-YOUTH",
      farm_location: usedParcels.length ? [U(p1.brgy), U(p1.city)].filter(Boolean).join(", ") || null : null,
      farm_size: totalArea || null,
      farm_type: anyType ? FARM_TYPE_LABEL[anyType] : null,
      within_ancestral_domain: v.parcels.some((p) => p.ad === "Yes"),
      agrarian_reform_beneficiary: v.parcels.some((p) => p.arb === "Yes"),
      organic_agriculture_practitioner: v.parcels.some((p) => p.rows.some((r) => r.org === "Y")),
      proof_of_land_ownership: nul(U(p1.proof)), ownership_tenure_type: p1.tenure || null,
      land_owner_name: nul([U(p1.loFirst), U(p1.loSur), U(p1.loExt)].filter(Boolean).join(" ")),
      rotational_tiller_name: nul(U(p1.tiller)),
      cropping_schedule: firstRow ? nul(U(firstRow.crop)) : null,
      commodity: firstRow ? nul(U(firstRow.comm)) : null,
      commodity_size: firstRow && firstRow.size !== "" ? Number(firstRow.size) : null,
      no_of_heads_trees: firstRow ? nul(String(firstRow.heads ?? "")) : null,
      consent_given: !!(v.signature || "").trim() && !!v.signDate, consent_date: v.signDate || null,
      rsbsa_form: v,
    },
    crops,
  };
}

/* ------------------------------------------------------------------ */
/* farmers row  ->  form (for Edit / View / Print)                     */
/* ------------------------------------------------------------------ */
const asSeg = (pattern, digits) => fillSeg(pattern, (digits || "").replace(/\D/g, ""));
const pick = (label, options) => {
  const l = label === "Widow/Widower" ? "Widow/er" : label; // older records spell it out
  return options.find((o) => norm(head(o)) === norm(head(l))) || options.find((o) => norm(o) === norm(l)) || "";
};
// "09171234567" / "+63 917 123 4567" -> the 9 writable boxes after the printed "09"
const mobileDigits = (m) => {
  let d = (m || "").replace(/\D/g, "");
  if (d.startsWith("63")) d = "0" + d.slice(2);
  if (d.startsWith("09")) d = d.slice(2); else if (d.startsWith("9")) d = d.slice(1);
  return d.slice(0, 9);
};

export function valuesFromRecord(row = {}) {
  const base = emptyValues();
  const saved = row.rsbsa_form;
  if (saved && typeof saved === "object") {
    // merge saved answers over a blank form so a newer form revision never breaks old records
    const parcels = Array.from({ length: PARCEL_COUNT }, (_, i) => {
      const sp = saved.parcels?.[i] || {};
      const bp = emptyParcel();
      return { ...bp, ...sp, rows: bp.rows.map((r, k) => ({ ...r, ...(sp.rows?.[k] || {}) })) };
    });
    return { ...base, ...saved, parcels };
  }

  // Older records (enrolled before this form existed): rebuild what we can from the columns.
  const v = base;
  v.surname = row.surname || ""; v.firstName = row.first_name || "";
  v.middleName = row.middle_name || ""; v.noMid = !row.middle_name;
  v.ext = row.extension_name || ""; v.noExt = !row.extension_name;
  v.sex = pick(row.sex, SEX);
  v.pHouse = row.house_no_purok || ""; v.pStreet = row.street_sitio_subdivision || "";
  v.pBrgy = row.barangay || ""; v.pCity = row.city_municipality || ""; v.pProv = row.province || ""; v.pRegion = row.region || "";
  if (row.date_of_birth) { const [y, m, d] = String(row.date_of_birth).split("-"); v.dob = asSeg(SEG.dob, `${m}${d}${y}`); }
  const [pc, ...pp] = (row.place_of_birth || "").split(",");
  v.pobCity = (pc || "").trim(); v.pobProv = pp.join(",").trim();
  v.mFirst = row.mother_first_name || ""; v.mMid = row.mother_middle_name || ""; v.mSur = row.mother_surname || "";
  v.mobile = asSeg(SEG.mobile, mobileDigits(row.mobile_number || row.contact_number));
  v.ownMobile = row.own_mobile_number === false ? "No" : row.mobile_number ? "Yes" : "";
  v.ownerName = row.mobile_owner_name || ""; v.ownerRel = row.mobile_owner_relationship || "";
  v.civil = pick(row.civil_status, CIVIL);
  if (isMarried(v) && row.spouse_name) v.spFirst = row.spouse_name;
  v.religion = row.religion && RELIGION.includes(row.religion) ? row.religion : "";
  v.edu = matchOption(row.highest_formal_education, EDUCATION) || "";
  v.idType = row.proof_of_identity || ""; v.idNo = row.id_document_number || "";
  v.icc = row.is_icc_ip ? "Yes" : "No"; v.pwd = row.is_pwd ? "Yes" : "No"; v.fourPs = row.is_4ps_beneficiary ? "Yes" : "No";
  v.org1 = row.association_name || ""; v.org2 = row.organization_2 || ""; v.org3 = row.organization_3 || "";
  v.livelihood = row.is_farmer ? LIVELIHOOD[0] : row.is_farmworker ? LIVELIHOOD[1] : row.is_fisherfolk ? LIVELIHOOD[2] : row.is_agri_youth ? LIVELIHOOD[3] : "";
  const p = v.parcels[0];
  const [fb, ...fc] = (row.farm_location || "").split(",");
  p.brgy = (fb || "").trim(); p.city = fc.join(",").trim();
  p.area = row.farm_size != null ? String(row.farm_size) : "";
  p.ad = row.within_ancestral_domain ? "Yes" : "No"; p.arb = row.agrarian_reform_beneficiary ? "Yes" : "No";
  p.proof = row.proof_of_land_ownership || ""; p.tenure = TENURE.includes(row.ownership_tenure_type) ? row.ownership_tenure_type : "";
  p.loFirst = row.land_owner_name || ""; p.tiller = row.rotational_tiller_name || "";
  const ft = Object.entries(FARM_TYPE_LABEL).find(([, label]) => label === row.farm_type)?.[0] || "";
  const crops = row.crops?.length ? row.crops : row.commodity ? [row.commodity] : [];
  crops.slice(0, CROP_ROWS).forEach((c, i) => {
    p.rows[i] = { crop: i === 0 ? row.cropping_schedule || "" : "", comm: c, size: i === 0 && row.commodity_size != null ? String(row.commodity_size) : "", heads: i === 0 ? row.no_of_heads_trees || "" : "", type: ft, org: row.organic_agriculture_practitioner ? "Y" : "N" };
  });
  v.printedName = [row.first_name, row.middle_name, row.surname, row.extension_name].filter(Boolean).join(" ");
  v.signature = row.consent_given ? v.printedName : "";
  v.signDate = row.consent_date || todayISO();
  return v;
}
