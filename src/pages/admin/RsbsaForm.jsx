import React from "react";

function Cell({ label, value, span = 1 }) {
  return (
    <div className="rsbsa-cell" style={{ gridColumn: `span ${span}` }}>
      <span className="rsbsa-cell-label">{label}</span>
      <span className="rsbsa-cell-value">{value || "—"}</span>
    </div>
  );
}

function CheckRow({ label, checked }) {
  return (
    <div className="rsbsa-print-check">
      <span className="rsbsa-box">{checked ? "☑" : "☐"}</span> {label}
    </div>
  );
}

export default function RsbsaForm({ farmer: f, onBack }) {
  const fullName = [f.surname, f.first_name, f.middle_name].filter(Boolean).join(", ") || f.full_name;
  const generatedAt = new Date().toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="rsbsa-print-wrap">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <button className="btn-ghost" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back to Farmer Profiling</button>
        <button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print"></i> Print</button>
      </div>

      <div className="rsbsa-print-page">
        <div className="rsbsa-print-header">
          <div>
            <h1>REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE</h1>
            <p>RSBSA Enrollment Form &mdash; generated from AgriTabang on {generatedAt}</p>
          </div>
          <div className="rsbsa-photo-box">2x2 PICTURE</div>
        </div>

        {/* PART 1 */}
        <h2 className="rsbsa-part-title">PART 1: PERSONAL INFORMATION</h2>
        <div className="rsbsa-print-grid cols-4">
          <Cell label="SURNAME" value={f.surname} />
          <Cell label="FIRST NAME" value={f.first_name} />
          <Cell label="MIDDLE NAME" value={f.middle_name} />
          <Cell label="EXTENSION NAME" value={f.extension_name} />
          <Cell label="SEX" value={f.sex} />
          <Cell label="DATE OF BIRTH" value={f.date_of_birth} />
          <Cell label="PLACE OF BIRTH" value={f.place_of_birth} />
          <Cell label="MOBILE NUMBER" value={f.mobile_number} />
          <Cell label="MOTHER'S MAIDEN NAME" value={f.mothers_maiden_name} span={2} />
          <Cell label="CIVIL STATUS" value={f.civil_status} />
          <Cell label="NAME OF SPOUSE" value={f.spouse_name} span={2} />
          <Cell label="RELIGION" value={f.religion} span={2} />
        </div>

        <h3 className="rsbsa-subhead-print">Permanent Address</h3>
        <div className="rsbsa-print-grid cols-3">
          <Cell label="HOUSE NO./PUROK" value={f.house_no_purok} />
          <Cell label="STREET/SITIO/SUBDIVISION" value={f.street_sitio_subdivision} />
          <Cell label="BARANGAY" value={f.barangay} />
        </div>
        <div className="rsbsa-print-grid cols-3">
          <Cell label="CITY/MUNICIPALITY" value={f.city_municipality} />
          <Cell label="PROVINCE" value={f.province} />
          <Cell label="REGION" value={f.region} />
        </div>

        <div className="rsbsa-print-grid cols-4">
          <Cell label="HIGHEST FORMAL EDUCATION" value={f.highest_formal_education} />
          <Cell label="SUBMITTED PROOF OF IDENTITY" value={f.proof_of_identity} />
          <Cell label="ID/DOCUMENT NUMBER" value={f.id_document_number} />
          <Cell label="RSBSA NUMBER" value={f.rsbsa_number} />
        </div>

        <div className="rsbsa-print-checks">
          <CheckRow label="Part of ICC/IP?" checked={f.is_icc_ip} />
          <CheckRow label="Person with Disability (PWD)?" checked={f.is_pwd} />
          <CheckRow label="4Ps Beneficiary?" checked={f.is_4ps_beneficiary} />
        </div>

        <div className="rsbsa-print-grid cols-2">
          <Cell label="MEMBERSHIP IN FARMERS/FISHERFOLK/IRRIGATORS ASSOCIATION" value={f.association_name || "None"} />
          <Cell label="TOTAL FARM SIZE ON FILE" value={f.farm_size ? `${f.farm_size} ha` : "—"} />
        </div>

        {/* PART 2 */}
        <h2 className="rsbsa-part-title">PART 2: LIVELIHOOD PROFILE</h2>
        <div className="rsbsa-print-checks four-col">
          <CheckRow label="FARMER" checked={f.is_farmer} />
          <CheckRow label="FARM WORKER" checked={f.is_farmworker} />
          <CheckRow label="FISHER" checked={f.is_fisherfolk} />
          <CheckRow label="AGRI-YOUTH" checked={f.is_agri_youth} />
        </div>

        {/* PART 3 */}
        <h2 className="rsbsa-part-title">PART 3: FARM PARCEL INFORMATION</h2>
        <div className="rsbsa-print-grid cols-3">
          <Cell label="FARM LOCATION" value={f.farm_location} />
          <Cell label="TOTAL PARCEL AREA (HA)" value={f.farm_size} />
          <Cell label="FARM TYPE" value={f.farm_type} />
        </div>
        <div className="rsbsa-print-checks">
          <CheckRow label="Within Ancestral Domain?" checked={f.within_ancestral_domain} />
          <CheckRow label="Agrarian Reform Beneficiary (ARB)?" checked={f.agrarian_reform_beneficiary} />
          <CheckRow label="Organic Agriculture?" checked={f.organic_agriculture_practitioner} />
        </div>
        <div className="rsbsa-print-grid cols-2">
          <Cell label="TYPE OF OWNERSHIP/TENURE" value={f.ownership_tenure_type} />
          <Cell label="NAME OF LAND OWNER (IF NOT REGISTERED OWNER)" value={f.land_owner_name} />
        </div>
        <div className="rsbsa-print-grid cols-4">
          <Cell label="CROPPING SCHEDULE" value={f.cropping_schedule} />
          <Cell label="COMMODITY" value={f.commodity || (f.crops || []).join(", ")} />
          <Cell label="SIZE (HA)" value={f.commodity_size} />
          <Cell label="NO. OF HEADS/TREES" value={f.no_of_heads_trees} />
        </div>

        {/* PART 4 */}
        <h2 className="rsbsa-part-title">PART 4: CONSENT FORM AND DATA PRIVACY NOTICE</h2>
        <p className="rsbsa-consent-text">
          I hereby declare that all information indicated in this form are true, correct, and complete, and that they may be used
          by the Department of Agriculture for the purposes of registration to the RSBSA and other legitimate purposes the
          Department may deem necessary. I am fully aware and I will not hold the Department liable for any misdeclaration or
          intentional omission made herein pursuant to applicable laws and regulations.
        </p>
        <p className="rsbsa-consent-text">
          Furthermore, I hereby give consent to the Department of Agriculture to conduct validation activities on my declared
          farm parcels through the RSBSA Georeferencing activity.
        </p>
        <p className="rsbsa-consent-text"><i>Consent status on file:</i> {f.consent_given ? `Recorded — signed ${f.consent_date}` : "Not yet recorded — to be signed on this printed copy."}</p>

        <div className="rsbsa-signature-row">
          <div><div className="rsbsa-sig-line">{f.consent_given ? f.consent_date : ""}</div><span>DATE</span></div>
          <div><div className="rsbsa-sig-line">{fullName}</div><span>PRINTED NAME OF REGISTRANT</span></div>
          <div><div className="rsbsa-sig-line">&nbsp;</div><span>SIGNATURE/THUMBMARK</span></div>
        </div>

        <div className="rsbsa-verify-row">
          <div><div className="rsbsa-sig-line">&nbsp;</div><span>Barangay Agricultural Technologist (BAT)/Municipal Agriculture Office (MAO)</span></div>
          <div><div className="rsbsa-sig-line">&nbsp;</div><span>City/Municipal Agriculture Council (C/MAFC) Chairperson</span></div>
          <div><div className="rsbsa-sig-line">&nbsp;</div><span>City/Municipal Agriculture Office (C/MAO)/Provincial Agriculture Office</span></div>
        </div>

        <p className="rsbsa-privacy-notice">
          <b>DATA PRIVACY NOTICE.</b> The Department of Agriculture (DA) commits to uphold your rights to privacy as a data subject under the
          Data Privacy Act of 2012 (DPA). In this regard, the DA shall diligently implement control and measures relating to the collection,
          storage, disclosure, and disposal of personal information collected through this Form shall be used for purposes of registering,
          processing and validating related interventions. Your information is retained for the duration necessary to fulfill the aforesaid
          purposes, unless otherwise required by law. If you have any right to access, correct, and object to the processing of your personal
          data, you have the right to file a complaint with the NPC for violation of your rights.
        </p>

        <p className="rsbsa-footer-note">THIS OFFICIAL RSBSA ENROLLMENT FORM IS NOT FOR SALE</p>
      </div>
    </section>
  );
}
