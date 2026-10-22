import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./pcic-paper.css";
import { Seg } from "./RsbsaPaper.jsx";
import SignatureField from "./SignaturePad.jsx";
import "./formErrors.css";
import {
  PCIC_SEG, CROPS, APP_TYPES, CATEGORIES, SEXES, CIVILS, PAYMENTS, PLANTING, LAND, TENURE, PREMIUM, LOT_COUNT,
  applyDeps, isHvc, isRenewal, isBorrowing, payIndex,
} from "../lib/pcicForm";

const LOGO = "/pcic-logo.png";
const SHEET_PX = 8.5 * 96; // long bond is 8.5in wide
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// B. Farm Information rows: [label, kind, field, options|class, renewal-skips-this-row]
const ROWS = [
  ["B.1. Farm Location/LSP", "h", null, "", true],
  ["a. No. & Street / Sitio", "t", "street", "sub", true],
  ["b. Barangay", "t", "brgy", "sub", true],
  ["c. Municipality/City", "t", "city", "sub", true],
  ["d. Province", "t", "prov", "sub", true],
  ["B.2. Boundaries", "h", null, "", true],
  ["a. North", "t", "north", "sub", true],
  ["b. East", "t", "east", "sub", true],
  ["c. South", "t", "south", "sub", true],
  ["d. West", "t", "west", "sub", true],
  [<>B.3. GeoRef ID (DA-RSBSA) or <u>Farm ID (PCIC)</u> (in case lot was already georeferenced no need to accomplish B.1 &amp; B.2)</>, "t", "geo", "tall", true],
  ["B.4. Variety", "t", "variety"],
  ["B.5. Planting Method", "r", "plant", PLANTING],
  ["B.6. Date of Sowing", "d", "sow"],
  ["B.7. Date of Planting", "d", "planting"],
  ["B.8. Date of Harvest", "d", "harvest"],
  ["B.9. Number of Trees/Hills (for HVC only)", "n", "trees"],
  ["B.10. Land Category", "r", "land", LAND],
  ["B.11. Tenurial Status", "r", "tenure", TENURE],
];

/**
 * PCIC Application for Crop Insurance (Individual Application), RC-UPI-01 Rev. 2025/Sep —
 * one long bond sheet (8.5in x 13in).
 *
 * values / setValues(updater) – see lib/pcicForm.js. Omit setValues + pass readOnly to view/print.
 */
export default function PcicPaper({ values: v, setValues, errors = {}, readOnly = false }) {
  const wrap = useRef(null);
  const [zoom, setZoom] = useState(1);

  // shrink the 8.5in sheet to fit narrow screens (printing always resets to 100%)
  useEffect(() => {
    if (!wrap.current) return undefined;
    const fit = () => setZoom(Math.min(1, (wrap.current.clientWidth - 4) / SHEET_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  // The form is taller than one long bond sheet at 100%, so (like the original's print code)
  // it is scaled to fit exactly one sheet — measured, not guessed, so nothing is ever cut off.
  const pageRef = useRef(null);
  const fitRef = useRef(null);
  useLayoutEffect(() => {
    const page = pageRef.current, el = fitRef.current;
    if (!page || !el) return undefined;
    const run = () => {
      let z = 1;
      el.style.zoom = z;
      for (let i = 0; i < 4; i += 1) {
        const scale = page.getBoundingClientRect().height / page.offsetHeight || 1; // sheet zoom on small screens
        const avail = page.clientHeight * 0.99; // small safety margin
        const h = el.getBoundingClientRect().height / scale;
        if (!h) break;
        z = Math.min(1, Math.floor(z * (avail / h) * 1000) / 1000);
        el.style.zoom = z;
      }
    };
    run();
    document.fonts?.ready?.then(run);
    return undefined;
  }, [readOnly]);

  const ro = readOnly;
  const bad = (k) => !!errors[k];
  const patch = (p) => setValues((prev) => applyDeps({ ...prev, ...p }));
  const setLot = (i, p) => setValues((prev) => {
    const lots = prev.lots.map((l, n) => (n === i ? { ...l, ...p } : l));
    const next = { ...prev, lots };
    if ("area" in p) { // total area follows the sum of the lots, as on the original form
      const sum = lots.reduce((a, l) => a + (parseFloat(l.area) || 0), 0);
      if (sum > 0) next.totalArea = String(+sum.toFixed(2));
    }
    return applyDeps(next);
  });

  const t = (key, cls = "ul", o = {}) => (
    <input className={`${cls}${bad(key) ? " bad" : ""}`} value={v[key] ?? ""} onChange={(e) => patch({ [key]: e.target.value })}
      disabled={ro || o.disabled} autoComplete="off" style={o.style} placeholder={o.placeholder} type={o.type} step={o.step} min={o.min} name={key} />
  );
  const dt = (key, style) => (
    <input type="date" className={`${bad(key) ? "bad " : ""}${v[key] ? "" : "empty"}`} value={v[key] ?? ""} onChange={(e) => patch({ [key]: e.target.value })} disabled={ro} style={style} name={key} />
  );
  const rg = (key, options, o = {}) => (
    <span className={`rg ${o.cls || ""}${bad(key) ? " bad" : ""}`} style={o.style}>
      {options.map((x) => (
        <label key={x}><input type="radio" name={key} value={x} checked={v[key] === x} disabled={ro} onChange={() => patch({ [key]: x })} />{x}</label>
      ))}
    </span>
  );
  const cb = (key, label, o = {}) => (
    <label className="ck" style={o.style}>
      <input type="checkbox" name={key} checked={!!v[key]} disabled={ro || o.disabled} className={bad(key) ? "bad" : ""} onChange={(e) => patch({ [key]: e.target.checked })} />{label}
    </label>
  );

  const hvc = isHvc(v), ren = isRenewal(v), bor = isBorrowing(v), pi = payIndex(v);
  const acct = (i, placeholder) => (
    <input className={`ul${bad(`acct${i}`) ? " bad" : ""}`} style={{ border: 0, height: "100%" }} value={v[`acct${i}`]} placeholder={ro ? "" : placeholder}
      onChange={(e) => patch({ [`acct${i}`]: e.target.value })} disabled={ro || pi !== i} autoComplete="off" />
  );

  /* ---- B. Farm information table cell ---- */
  const cell = (row, L) => {
    const [, kind, field, extra, rn] = row;
    const off = ro || (ren && rn);
    if (kind === "h") return <td className="in" key={L} />;
    const lot = v.lots[L];
    const ekey = `lot${L}${cap(field)}`;
    if (kind === "r") {
      return (
        <td className="in" key={L}>
          <div className={`rg par${bad(ekey) ? " bad" : ""}`}>
            {extra.map((x) => (
              <label key={x}><input type="radio" name={`l${L + 1}${field}`} value={x} checked={lot[field] === x} disabled={off} onChange={() => setLot(L, { [field]: x })} />{x}</label>
            ))}
          </div>
        </td>
      );
    }
    const type = kind === "d" ? "date" : kind === "n" ? "number" : "text";
    return (
      <td className="in" key={L}>
        <input type={type} className={`${bad(ekey) ? "bad " : ""}${type === "date" && !lot[field] ? "empty" : ""}`} value={lot[field] ?? ""} onChange={(e) => setLot(L, { [field]: e.target.value })}
          disabled={off} autoComplete="off" min={kind === "n" ? 0 : undefined} />
      </td>
    );
  };

  return (
    <div className={`pp${ro ? " readonly" : ""}`} ref={wrap}>
      {/* long bond paper: 8.5in x 13in, no margins — only while this form is on screen */}
      <style>{"@page{size:8.5in 13in;margin:0}"}</style>

      <div className="pp-zoom" style={{ zoom }}>
        <div className="pp-sheet">
          <div className="page" ref={pageRef}>
           <div className="pfit" ref={fitRef}>
            <div className="rc">RC-UPI-01<br />Rev. 2025/Sep</div>
            <div className="lh"><img className="plogo" src={LOGO} alt="PCIC logo" />
              <div><div className="t1">Republic of the Philippines</div><div className="t2">PHILIPPINE CROP INSURANCE CORPORATION</div>
                <div className="t3">Regional Office No. {t("regional", "ul i", { style: { width: 50 } })}</div></div></div>
            <div className="ttl"><b>APPLICATION FOR CROP INSURANCE</b><small>(Individual Application)</small></div>
            <div className="kind">Kindly fill out all entries and tick all boxes (&#10003;) as appropriate</div>

            <div className="bx">
              <div className="g ctr" style={{ gridTemplateColumns: "23fr 18fr 12.5fr 35.5fr 11fr", fontWeight: "bold", fontSize: 10.5, lineHeight: 1.05 }}>
                <div className="cl">CROP<br /><span style={{ fontWeight: "normal" }}>(Choose only one)</span></div>
                <div className="cl" style={{ paddingTop: 6 }}>APPLICATION TYPE</div>
                <div className="cl">TOTAL AREA<br /><span style={{ fontWeight: "normal" }}>(in hectares)</span></div>
                <div className="cl" style={{ paddingTop: 6 }}>FARMER CATEGORY</div>
                <div className="cl">DATE OF<br />APPLICATION</div></div>
              <div className="g bt" style={{ gridTemplateColumns: "23fr 18fr 12.5fr 35.5fr 11fr", minHeight: 70 }}>
                <div className="cl">{rg("crop", CROPS, { cls: "col" })}{t("hvc", "ul", { disabled: !hvc, style: { marginTop: 3 } })}</div>
                <div className="cl">{rg("appType", APP_TYPES, { cls: "col" })}</div>
                <div className="cl" style={{ display: "flex", alignItems: "flex-end" }}>{t("totalArea", "ul", { type: "number", step: "0.01", min: "0", style: { textAlign: "center" } })}</div>
                <div className="cl">{rg("category", CATEGORIES, { cls: "col" })}<div>&nbsp;&nbsp;&nbsp;&nbsp;Lender: {t("lender", "ul i", { disabled: !bor, style: { width: "75%" } })}</div></div>
                <div className="cl" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>{dt("appDate")}<span className="cap" style={{ textAlign: "right" }}>(mm/dd/yyyy)</span></div></div>

              <div className="sec">A. BASIC FARMER INFORMATION</div>
              <div className="g" style={{ gridTemplateColumns: "75% 25%" }}>
                <div className="cl" style={{ paddingBottom: 1 }}><b>A.1 Name</b>
                  <div className="g" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "0 14px", marginTop: 8 }}>
                    <label>{t("lName")}<span className="cap">Last Name</span></label><label>{t("fName")}<span className="cap">First Name</span></label>
                    <label>{t("mName")}<span className="cap">Middle Name</span></label><label>{t("suffix")}<span className="cap">Suffix (Jr.,Sr., III)</span></label></div></div>
                <div className="cl"><b>A.2 Contact Number</b>
                  <Seg pattern={PCIC_SEG.contact} value={v.contact} onChange={(val) => patch({ contact: val })} disabled={ro} bad={bad("contact")} style={{ marginTop: 4, height: 22 }} /></div>
              </div>
              <div className="g bt" style={{ gridTemplateColumns: "75% 25%" }}>
                <div className="cl"><b>A.3 Address</b>
                  <div className="g" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "0 8px", marginTop: 8 }}>
                    <label>{t("street")}<span className="cap">No. &amp; Street/Sitio</span></label><label>{t("brgy")}<span className="cap">Barangay</span></label>
                    <label>{t("city")}<span className="cap">Municipality/City</span></label><label>{t("prov")}<span className="cap">Province</span></label></div></div>
                <div className="cl" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}><div><b>A.4 Date of Birth</b></div>{dt("dob")}<span className="cap" style={{ textAlign: "right" }}>(mm/dd/yyyy)</span></div></div>
              <div className="g bt" style={{ gridTemplateColumns: "24% 76%" }}>
                <div className="cl"><b>A.5 Sex</b>{rg("sex", SEXES, { style: { marginTop: 4, paddingLeft: 8 } })}</div>
                <div className="cl"><b>A.6 Are you part of a special sector? Please tick (&#10003;) as many as necessary</b>
                  <div className="rg" style={{ marginTop: 4, gap: "2px 12px" }}>
                    {cb("sPWD", "PWD")}{cb("sSenior", "Senior Citizen")}{cb("sYouth", <>Youth (18 &ndash; 30 y/o)</>)}
                    {cb("sIP", <>Indigenous People <span className="s">&nbsp;(please indicate tribe)</span></>)}
                    {t("tribe", "ul", { disabled: !v.sIP, style: { width: 110 } })}</div></div></div>
              <div className="bt cl" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b>A.7 Civil Status</b>
                {rg("civil", CIVILS, { style: { gap: "2px 28px" } })}<i>(If married,</i> Name of Spouse {t("spouse", "ul i", { disabled: v.civil !== "Married", style: { width: 210 } })} <i>)</i></div>
              <div className="sec" style={{ background: "#fff", borderTop: "1px solid #000" }}>A.8 Name of Legal Beneficiary (In case of death benefit, as applicable)</div>
              <div className="g bt" style={{ gridTemplateColumns: "74% 26%" }}>
                <div className="cl"><div className="g" style={{ gridTemplateColumns: "12% 1fr" }}><b style={{ alignSelf: "center" }}>Primary Beneficiary</b>
                  <div><div className="g" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "0 14px", marginTop: 8 }}>
                    <label>{t("bL")}<span className="cap">Last Name</span></label><label>{t("bF")}<span className="cap">First Name</span></label>
                    <label>{t("bM")}<span className="cap">Middle Name</span></label><label>{t("bS")}<span className="cap">Suffix (Jr.,Sr., III)</span></label></div></div></div></div>
                <div className="cl">Relationship to Applicant {t("bRel", "ul i", { style: { width: 80 } })}<br />Birthdate {dt("bBirth", { width: 100, display: "inline-block" })}</div></div>
              <div className="g bt" style={{ gridTemplateColumns: "74% 26%" }}>
                <div className="cl"><div className="g" style={{ gridTemplateColumns: "12% 1fr" }}><div style={{ alignSelf: "center" }}><b>Guardian</b><br /><i style={{ fontSize: 7.5 }}>(if beneficiary is a minor)</i></div>
                  <div><div className="g" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "0 14px", marginTop: 8 }}>
                    <label>{t("gL")}<span className="cap">Last Name</span></label><label>{t("gF")}<span className="cap">First Name</span></label>
                    <label>{t("gM")}<span className="cap">Middle Name</span></label><label>{t("gS")}<span className="cap">Suffix (Jr., Sr., III)</span></label></div></div></div></div>
                <div className="cl">Relationship to Applicant {t("gRel", "ul i", { style: { width: 80 } })}<br />Birthdate {dt("gBirth", { width: 100, display: "inline-block" })}</div></div>

              <div className="sec" style={{ background: "#fff" }}>A.9 &nbsp;In the event of claim, what is your preferred method of receiving indemnity payment? (Kindly indicate account number as applicable)</div>
              <div className={`g bt${bad("pay") ? " bad" : ""}`} style={{ gridTemplateColumns: "16fr 28fr 27fr 29fr" }}>
                <div className="cl"><label className="ck"><input type="radio" name="pay" value="LandBank or DBP" checked={v.pay === "LandBank or DBP"} disabled={ro} onChange={() => patch({ pay: "LandBank or DBP" })} />LandBank or DBP</label></div>
                <div className="cl">{acct(1, "Account no.")}</div>
                <div className="cl"><label className="ck"><input type="radio" name="pay" value="Palawan Express" checked={v.pay === "Palawan Express"} disabled={ro} onChange={() => patch({ pay: "Palawan Express" })} />Palawan Express</label></div>
                <div className="cl">{acct(2, "Account / reference no.")}</div></div>
              <div className="g bt" style={{ gridTemplateColumns: "16fr 28fr 27fr 29fr" }}>
                <div className="cl"><label className="ck"><input type="radio" name="pay" value="GCash" checked={v.pay === "GCash"} disabled={ro} onChange={() => patch({ pay: "GCash" })} />GCash</label></div>
                <div className="cl">{acct(3, "Mobile / account no.")}</div>
                <div className="cl"><label className="ck"><input type="radio" name="pay" value="Others" checked={v.pay === "Others"} disabled={ro} onChange={() => patch({ pay: "Others" })} />Others <span className="s">(Please Specify)</span></label>{t("payOther", "ul i", { disabled: v.pay !== "Others", style: { width: 80 } })}</div>
                <div className="cl">{acct(4, "Account no.")}</div></div>
            </div>

            <div className="bx bxb">
              <div className="sec"><b>B. FARM INFORMATION</b> [Use separate sheet/s of application paper if more than three (3) lots] [If Application Type is for renewal fill up only B.4 to B.12]</div>
              <table className="fm"><colgroup><col width="23%" /><col width="26%" /><col width="25%" /><col width="26%" /></colgroup>
                <tbody>
                  <tr><th>Particulars</th>{Array.from({ length: LOT_COUNT }, (_, L) => (
                    <th key={L}>Lot {L + 1} <input className={`ul i${bad(`lot${L}Area`) ? " bad" : ""}`} type="number" step="0.01" min="0" value={v.lots[L].area}
                      onChange={(e) => setLot(L, { area: e.target.value })} disabled={ro} style={{ width: 60, textAlign: "center" }} /> ha.</th>
                  ))}</tr>
                  {ROWS.map((row, k) => {
                    const [lab, , , extra, rn] = row;
                    return (
                      <tr key={k} className={`${rn ? "rn" : ""} ${extra === "tall" ? "tall" : ""}${!ro && ren && rn ? " dim" : ""}`}>
                        <td className={`lb ${extra === "sub" ? "sub" : ""}`}>{lab}</td>
                        {Array.from({ length: LOT_COUNT }, (_, L) => cell(row, L))}
                      </tr>
                    );
                  })}
                  <tr><td className="lb">B.12. Desired Amount of Cover</td>
                    <td className="in" colSpan={3} style={{ textAlign: "center" }}><span>(PhP)</span>{" "}
                      <input type="number" min="0" className={bad("cover") ? "bad" : ""} value={v.cover} onChange={(e) => patch({ cover: e.target.value })} disabled={ro}
                        style={{ width: "60%", display: "inline-block", textAlign: "center", borderBottom: "1px solid #000", height: 18 }} /></td></tr>
                </tbody></table>

              <div className="sec" style={{ fontWeight: "bold" }}>C. &nbsp;CERTIFICATION AND DATA PRIVACY CONSENT STATEMENT (Kindly check the boxes if you agree)</div>
              <div className="cons"><div className="cl" style={{ borderLeft: 0 }}>
                <p>{cb("cert1", "I hereby certify that the foregoing answers and statements are complete, true and correct. If the application is approved, the insurance shall be deemed based upon the statements contained herein. I further agree that PCIC reserves the right to reject and/or void the insurance if found that there is fraud/concealment/misrepresentation on this statement material to the risk.", { style: { alignItems: "flex-start", whiteSpace: "normal" } })}</p>
                <p>{cb("cert2", "By submitting this application, I hereby consent to the collection, use, processing, and disclosure of my sensitive personal data in accordance with the Data Privacy Act of 2012.", { style: { alignItems: "flex-start", whiteSpace: "normal" } })}</p>
                <p><b><u>Deed of Assignment</u> for borrowing farmers</b> <i>(if applicable)</i></p>
                <p className={!ro && !bor ? "dim" : ""}>{cb("cert3", "I hereby assign all or part of my rights, title, and interest in this insurance coverage to the Assignee (Lender) stated above. This assignment includes any indemnities that may become payable under the terms of the policy. I acknowledge that this assignment is made in accordance with the terms and conditions of the insurance policy and is subject to the approval of the insurance provider.", { disabled: !bor, style: { alignItems: "flex-start", whiteSpace: "normal" } })}</p></div>
                <div className="cl ctr" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 6 }}>
                  <SignatureField underline readOnly={ro} bad={bad("sign")} image={v.signImage} typed={v.sign} name={[v.fName, v.mName, v.lName, v.suffix].filter(Boolean).join(" ")} onChange={(img) => patch({ signImage: img, sign: "", signedAt: img ? new Date().toISOString() : "" })} />Signature or Thumb Mark over Printed Name<br /><b>Farmer &ndash; Applicant</b>
                  <div style={{ marginTop: 12, textAlign: "left" }}>Date {dt("signDate", { width: 110, display: "inline-block" })}<br /><i style={{ paddingLeft: 70 }}>(mm/dd/yyyy)</i></div></div></div>

              <div className="sec">D. &nbsp;COVERAGE (FOR PCIC USE ONLY)</div>
              <div className="sec" style={{ paddingLeft: 16, background: "#f6f6f6" }}><b>D.1</b> <b><u>Source of Premium</u></b></div>
              <div className="g bt" style={{ gridTemplateColumns: "1fr 1fr", fontWeight: "bold" }}>
                <div className="cl" style={{ padding: "5px 8px" }}><label className="ck"><input type="radio" name="prem" value={PREMIUM[0]} checked={v.prem === PREMIUM[0]} disabled={ro} onChange={() => patch({ prem: PREMIUM[0] })} />Non-<u>Subsidized/Regular</u></label></div>
                <div className="cl" style={{ padding: "5px 8px", display: "flex", alignItems: "center" }}><label className="ck" style={{ flex: "none" }}><input type="radio" name="prem" value={PREMIUM[1]} checked={v.prem === PREMIUM[1]} disabled={ro} onChange={() => patch({ prem: PREMIUM[1] })} />Subsidized/<u>CFITF</u> &ndash; NCFRs No.&nbsp;</label>{t("ncfr", "ul", { style: { fontWeight: "bold" } })}</div></div>
              <div className="g bt" style={{ gridTemplateColumns: "1fr 1fr", fontWeight: "bold" }}>
                <div className="cl" style={{ padding: "5px 8px", display: "flex", alignItems: "center" }}><label className="ck" style={{ flex: "none" }}><input type="radio" name="prem" value={PREMIUM[2]} checked={v.prem === PREMIUM[2]} disabled={ro} onChange={() => patch({ prem: PREMIUM[2] })} />Subsidized/RSBSA &ndash; Ref. No.&nbsp;</label>{t("rsbsaRef", "ul")}</div>
                <div className="cl" style={{ padding: "5px 8px", display: "flex", alignItems: "center" }}><label className="ck" style={{ flex: "none" }}><input type="radio" name="prem" value={PREMIUM[3]} checked={v.prem === PREMIUM[3]} disabled={ro} onChange={() => patch({ prem: PREMIUM[3] })} />Others:&nbsp;</label>{t("premOther", "ul")}</div></div>
            </div>
           </div>
          </div>
        </div>
      </div>
    </div>
  );
}
