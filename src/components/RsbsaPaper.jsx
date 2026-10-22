import React, { useEffect, useRef, useState } from "react";
import "./rsbsa-paper.css";
import SignatureField from "./SignaturePad.jsx";
import "./formErrors.css";
import {
  SEG, SEX, CIVIL, RELIGION, EDUCATION, YES_NO, LIVELIHOOD, TENURE, FARM_TYPES, PARCEL_COUNT,
  applyDeps, isMarried, isFarmer, isNcr, transactionCode, slotCount,
} from "../lib/rsbsaForm";

const LOGO = "/rsbsa-form-logo.png";
const QR = "/rsbsa-finder-qr.png";
const SHEET_PX = 8.5 * 96; // long bond is 8.5in wide

// "Single (Walang asawa)" -> **Single** <small>(Walang asawa)</small>
const lbl = (o) => {
  const m = o.match(/^([^(]*?)\s*(\(.*\))?$/);
  return <><b>{m[1]}</b>{m[2] ? <> <small>{m[2]}</small></> : null}</>;
};

/* ---------------- digit boxes (PCN / TRN / date of birth / mobile / RSBSA No.) ---------------- */
export function Seg({ pattern, value, onChange, disabled, small, style, bad }) {
  const refs = useRef([]);
  const total = slotCount(pattern);
  const chars = (value || "").padEnd(total, " ").slice(0, total).split("");
  const editable = [...pattern].filter((c) => c !== "-").map((c, k) => (c === "x" ? k : -1)).filter((k) => k >= 0);

  const focusFrom = (k, dir) => {
    const idx = editable.indexOf(k);
    const next = editable[idx + dir];
    if (next !== undefined) refs.current[next]?.focus();
  };
  const put = (k, ch) => {
    const arr = [...chars]; arr[k] = ch || " ";
    onChange(arr.join(""));
  };

  let k = -1;
  return (
    <div className={`seg${small ? " sm" : ""}${bad ? " bad" : ""}`} style={{ gridTemplateColumns: `repeat(${pattern.length},1fr)`, ...style }}>
      {[...pattern].map((c, i) => {
        if (c === "-") return <span className="d" key={i}>&mdash;</span>;
        k += 1;
        const slot = k;
        const fixed = c !== "x";
        return (
          <input
            key={i}
            ref={(el) => { refs.current[slot] = el; }}
            maxLength={1}
            inputMode="numeric"
            value={fixed ? c : chars[slot].trim()}
            readOnly={fixed}
            tabIndex={fixed ? -1 : undefined}
            disabled={disabled && !fixed}
            onChange={(e) => {
              const ch = e.target.value.replace(/\D/g, "").slice(-1);
              put(slot, ch);
              if (ch) focusFrom(slot, 1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !chars[slot].trim()) focusFrom(slot, -1);
            }}
            onPaste={(e) => {
              const digits = e.clipboardData.getData("text").replace(/\D/g, "");
              if (!digits) return;
              e.preventDefault();
              const arr = [...chars];
              let at = editable.indexOf(slot);
              for (const d of digits) { if (at >= editable.length) break; arr[editable[at++]] = d; }
              onChange(arr.join(""));
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- boxed radio answers ("put X on the box") ---------------- */
function RG({ name, options, value, onChange, cls = "", style, bad, disabled, edu }) {
  const Tag = edu ? "div" : "span";
  return (
    <Tag className={`${edu ? "edu" : "rg"} ${cls}${bad ? " bad" : ""}`} style={style}>
      {options.map((o) => (
        <label key={o}>
          <input type="radio" name={name} value={o} checked={value === o} disabled={disabled} onChange={() => onChange(o)} />
          <span>{lbl(o)}</span>
        </label>
      ))}
    </Tag>
  );
}

/**
 * The official RSBSA Enrollment Form, Revised Version 01-2024.
 *   Sheet 1 (long bond):  Part 1 Personal Information + Part 2 Livelihood Profile + client's stub
 *   Sheet 2 (long bond):  Part 3 Farm Parcel Information + Part 4 Consent / Data Privacy
 *
 * values   – the form's answers (see lib/rsbsaForm.js)
 * setValues(updater) – omit together with readOnly for the print/view mode
 */
export default function RsbsaPaper({ values: v, setValues, errors = {}, readOnly = false, photoUrl }) {
  const wrap = useRef(null);
  const [zoom, setZoom] = useState(1);

  // shrink the 8.5in sheets to fit narrow screens (printing always resets to 100%)
  useEffect(() => {
    if (!wrap.current) return undefined;
    const fit = () => setZoom(Math.min(1, (wrap.current.clientWidth - 4) / SHEET_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const patch = (p) => setValues((prev) => applyDeps({ ...prev, ...p }));
  const setParcel = (i, p) => setValues((prev) => ({ ...prev, parcels: prev.parcels.map((x, n) => (n === i ? { ...x, ...p } : x)) }));
  const setRow = (i, r, p) => setValues((prev) => ({
    ...prev,
    parcels: prev.parcels.map((x, n) => (n === i ? { ...x, rows: x.rows.map((row, m) => (m === r ? { ...row, ...p } : row)) } : x)),
  }));

  const bad = (k) => !!errors[k];
  const ro = readOnly;

  // text box bound to values[key]
  const inp = (key, cls, o = {}) => (
    <input
      className={`${cls}${bad(key) ? " bad" : ""}`}
      value={v[key] ?? ""}
      onChange={(e) => patch({ [key]: e.target.value })}
      disabled={ro || o.disabled}
      autoComplete="off"
      style={o.style}
      placeholder={o.placeholder}
    />
  );
  const rg = (key, name, options, o = {}) => (
    <RG name={name} options={options} value={v[key]} onChange={(val) => patch({ [key]: val })} bad={bad(key)} disabled={ro || o.disabled} cls={o.cls} style={o.style} edu={o.edu} />
  );
  const seg = (key, pattern, o = {}) => (
    <Seg pattern={pattern} value={v[key]} onChange={(val) => patch({ [key]: val })} disabled={ro || o.disabled} small={o.small} style={o.style} bad={bad(key)} />
  );

  const married = isMarried(v);
  const farmer = isFarmer(v);
  const ncr = isNcr(v);
  const parcelsOff = ro || !farmer;
  const tc = transactionCode(v);

  /* ---------------- one farm parcel block (Part 3) ---------------- */
  const parcel = (i) => {
    const p = v.parcels[i];
    const n = i + 1;
    const pin = (key, cls, o = {}) => (
      <input
        className={`${cls}${bad(`p${i}${key[0].toUpperCase()}${key.slice(1)}`) ? " bad" : ""}`}
        value={p[key] ?? ""}
        onChange={(e) => setParcel(i, { [key]: e.target.value })}
        disabled={parcelsOff}
        autoComplete="off"
        type={o.type}
        step={o.step}
        min={o.min}
        style={o.style}
      />
    );
    const prg = (key, options, o = {}) => (
      <RG name={`p${n}${o.name}`} options={options} value={p[key]} onChange={(val) => setParcel(i, { [key]: val })} disabled={parcelsOff} cls={o.cls} style={o.style} />
    );
    const rowCells = (r) => {
      const row = p.rows[r];
      const rin = (key, o = {}) => (
        <input value={row[key] ?? ""} onChange={(e) => setRow(i, r, { [key]: e.target.value })} disabled={parcelsOff} type={o.type} step={o.step} min={o.min} autoComplete="off" />
      );
      return (
        <tr key={r}>
          <td>{rin("crop")}</td>
          <td>{rin("comm")}</td>
          <td>{rin("size", { type: "number", step: "0.01", min: "0" })}</td>
          <td>{rin("heads", { type: "number", min: "0" })}</td>
          <td>
            <select value={row.type} onChange={(e) => setRow(i, r, { type: e.target.value })} disabled={parcelsOff}>
              <option value=""></option>{FARM_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </td>
          <td>
            <select value={row.org} onChange={(e) => setRow(i, r, { org: e.target.value })} disabled={parcelsOff}>
              <option value=""></option><option>Y</option><option>N</option>
            </select>
          </td>
        </tr>
      );
    };
    const first4 = [0, 1, 2, 3], last2 = [4, 5];
    return (
      <div key={i}>
        <div className={`pc${!ro && !farmer ? " dim" : ""}`}>
          <div className="pl"><b className="no">{n}</b>
            <div><b>FARM<br />LOCATION:</b> {pin("brgy", "ul", { style: { width: "60%", float: "right" } })}<span className="cap" style={{ clear: "both", textAlign: "right", paddingRight: 25 }}>BARANGAY</span></div>
            {pin("city", "ul")}<span className="cap">CITY/MUNICIPALITY, PROVINCE</span>
            <div className="r"><b>TOTAL PARCEL AREA (Ha):</b>{pin("area", "ul", { type: "number", step: "0.01", min: "0", style: { width: 40 } })} ha</div>
            <div className="r">Within Ancestral Domain (AD) {prg("ad", YES_NO, { name: "AD", cls: "n", style: { gap: 4 } })}</div>
            <div className="r">Agrarian Reform Beneficiary (ARB) {prg("arb", YES_NO, { name: "ARB", cls: "n", style: { gap: 4 } })}</div>
            <div><b>Submitted Proof of Land Ownership<sup>1</sup>/ Farming Agreement<sup>2</sup></b></div>
            <div className="r"><i style={{ fontSize: 6 }}>(Refer to the list below; tingnan ang listahan sa ibaba):</i>{pin("proof", "ul", { style: { width: 40 } })}</div>
            <b>Type of Ownership/Tenure:</b>{prg("tenure", TENURE, { name: "Tenure", cls: "n" })}
            <div className="r" style={{ flexWrap: "nowrap" }}><b style={{ whiteSpace: "nowrap" }}>Name of Land Owner:</b>{pin("loFirst", "ul", { style: { flex: 1, width: "auto", minWidth: 0 } })}{pin("loSur", "ul", { style: { flex: 1, width: "auto", minWidth: 0 } })}{pin("loExt", "ul", { style: { width: 25, minWidth: 0 } })}</div>
            <div className="r" style={{ flexWrap: "nowrap" }}><span style={{ fontSize: 6 }}><b>RSBSA Number</b><br />(system-generated)</span>
              <Seg pattern={SEG.rsbsa} value={p.loNo} onChange={(val) => setParcel(i, { loNo: val })} disabled={parcelsOff} small style={{ flex: 1, height: 12 }} /></div>
          </div>
          <table className="pt">
            <colgroup><col width="23%" /><col width="24%" /><col width="15.4%" /><col width="13%" /><col width="13.6%" /><col width="11%" /></colgroup>
            <tbody>
              {first4.map(rowCells)}
              <tr><td className="ib" colSpan={6}>For intercropping, use the row below</td></tr>
              {last2.map(rowCells)}
            </tbody>
          </table>
        </div>
        <div className={`tl${!ro && !farmer ? " dim" : ""}`}>
          <div className="g" style={{ display: "grid", alignItems: "center" }}><b>ROTATIONAL TILLER:</b></div>
          <div className="g"><b>FULL NAME:</b> {pin("tiller", "ul")}
            <div className="gr" style={{ gridTemplateColumns: "auto 1fr", gap: 4, alignItems: "center", marginTop: 2 }}><b>RSBSA Number (system-generated):</b>
              <Seg pattern={SEG.rsbsa} value={p.tlNo} onChange={(val) => setParcel(i, { tlNo: val })} disabled={parcelsOff} small style={{ height: 12, background: "#fff" }} /></div></div>
          <div className="g"><b>REMARKS:</b></div>
          <div><input className="f" value={p.remarks} onChange={(e) => setParcel(i, { remarks: e.target.value })} disabled={parcelsOff} autoComplete="off" /></div>
        </div>
      </div>
    );
  };

  const stubName = [
    v.firstName, v.noMid ? "" : v.middleName, v.surname, v.noExt ? "" : v.ext,
  ];

  return (
    <div className={`rp${ro ? " readonly" : ""}`} ref={wrap}>
      {/* long bond paper: 8.5in x 13in, no margins — only while this form is on screen */}
      <style>{"@page{size:8.5in 13in;margin:0}"}</style>

      <div className="rp-zoom" style={{ zoom }}>
        {/* ======================= LONG BOND 1 — PART 1 & PART 2 ======================= */}
        <div className="rp-sheet">
          <div className="page grow">
            <div className="rev">REVISED VERSION: 01-2024</div>
            <div className="hdr">
              <div>
                <div className="brand"><img className="logo" src={LOGO} alt="DA / RSBSA logo" /><div><div className="t1">REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE</div><div className="t2">RSBSA Enrollment Form</div></div></div>
                <div className="tcode"><b>TRANSACTION CODE:</b>
                  <div className="tcr"><div><i>With PhilID/<br />ePhilID? PCN:</i></div>{seg("pcn", SEG.pcn)}</div>
                  <div className="tcr"><div><i>No PhilID/<br />ePhilID? TRN:</i></div>{seg("trn", SEG.trn)}</div></div>
              </div>
              <div className="photo"><b>2x2<br />PICTURE</b>PHOTO TAKEN<br />WITHIN 6 MONTHS{photoUrl ? <img src={photoUrl} alt="2x2" /> : null}</div>
            </div>
            <div className="ins blk"><b>INSTRUCTIONS (PANUTO):</b> Write in <b>CAPITAL LETTERS</b>. Put <b>X</b> on the box of your answer. (Magsulat gamit ang <b>MALALAKING LETRA</b>. Lagyan ng <b>X</b> ang kahon ng iyong sagot.)</div>
            <div className="bk">PART 1: PERSONAL INFORMATION</div>

            <div className="pd" style={{ paddingTop: 14 }}><div className="gr" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <label className="ln">{inp("surname", "ul")}<b>SURNAME</b> (APELYIDO)</label>
              <label className="ln">{inp("firstName", "ul")}<b>FIRST NAME</b> (PANGALAN)</label></div></div>
            <div className="gr" style={{ gridTemplateColumns: "1fr 22% 30%", marginTop: 4 }}>
              <div className="pd"><label className="ln">{inp("middleName", "ul", { disabled: v.noMid })}<b>MIDDLE NAME</b> (GITNANG PANGALAN)</label>
                <label className="ln"><input type="checkbox" checked={v.noMid} disabled={ro} onChange={(e) => patch({ noMid: e.target.checked })} /> <i>No Middle Name (Legal na walang gitnang pangalan)</i></label></div>
              <div className="pd"><label className="ln">{inp("ext", "ul", { disabled: v.noExt })}<b>EXTENSION NAME</b></label>
                <label className="ln"><input type="checkbox" checked={v.noExt} disabled={ro} onChange={(e) => patch({ noExt: e.target.checked })} /> <i>No Extension Name</i></label></div>
              <div className="pd vl" style={{ borderTop: "1px solid #000" }}><b>SEX</b> (KASARIAN): {rg("sex", "sex", SEX, { style: { display: "inline-flex", gap: 8, verticalAlign: "middle" } })}</div></div>

            <div className="blk pd"><div className="gr" style={{ gridTemplateColumns: "152fr 160fr 215fr 220fr", gap: "4px 6px" }}>
              <div><b style={{ fontSize: 10 }}>PERMANENT ADDRESS</b><br />(PERMANENTENG TIRAHAN)</div>
              <label className="ln">{inp("pHouse", "gb")}HOUSE/LOT/BLDG NO./PUROK</label>
              <label className="ln">{inp("pStreet", "gb")}STREET/SITIO/SUBDIVISION</label>
              <label className="ln">{inp("pBrgy", "gb")}BARANGAY</label></div>
              <div className="gr" style={{ gridTemplateColumns: "250fr 275fr 220fr", gap: "4px 6px", marginTop: 4 }}>
                <label className="ln">{inp("pCity", "gb")}CITY/MUNICIPALITY</label>
                <label className="ln">{inp("pProv", "gb")}PROVINCE</label>
                <label className="ln">{inp("pRegion", "gb")}REGION</label></div></div>

            <div className={`blk pd${!ro && !ncr ? " dim" : ""}`}><b style={{ fontSize: 11.5 }}>Answer only if declared permanent address is in NCR (Sagutan lamang kung ang permanenteng tirahan ay sa NCR).</b>
              <div className="gr" style={{ gridTemplateColumns: "152fr 160fr 215fr 220fr", gap: "4px 6px", marginTop: 2 }}>
                <div><b style={{ fontSize: 10 }}>PROVINCIAL ADDRESS</b><br />(TIRAHAN SA LABAS NG NCR)</div>
                <label className="ln">{inp("vHouse", "gb", { disabled: !ncr })}HOUSE/LOT/BLDG NO./PUROK</label>
                <label className="ln">{inp("vStreet", "gb", { disabled: !ncr })}STREET/SITIO/SUBDIVISION</label>
                <label className="ln">{inp("vBrgy", "gb", { disabled: !ncr })}BARANGAY</label></div>
              <div className="gr" style={{ gridTemplateColumns: "250fr 275fr 220fr", gap: "4px 6px", marginTop: 4 }}>
                <label className="ln">{inp("vCity", "gb", { disabled: !ncr })}CITY/MUNICIPALITY</label>
                <label className="ln">{inp("vProv", "gb", { disabled: !ncr })}PROVINCE</label>
                <label className="ln">{inp("vRegion", "gb", { disabled: !ncr })}REGION</label></div></div>

            <div className="gr blk" style={{ gridTemplateColumns: "56% 44%" }}>
              <div className="pd"><div className="gr" style={{ gridTemplateColumns: "1fr 1.1fr", gap: "0 12px" }}>
                <div><b>DATE OF BIRTH</b><br />(PETSA NG KAPANGANAKAN){seg("dob", SEG.dob, { small: true, style: { width: 120, marginTop: 5 } })}<span className="cap dobcap"><i>MM</i><i>DD</i><i>YYYY</i></span></div>
                <div><b>PLACE OF BIRTH</b><br />(LUGAR NG KAPANGANAKAN)<label className="ln">{inp("pobCity", "ul")}CITY / MUNICIPALITY</label></div></div>
                <div className="gr" style={{ gridTemplateColumns: "1fr 1.1fr", gap: "0 12px", marginTop: 4 }}><div><b>MOTHER'S MAIDEN NAME</b><br />(PANGALAN NG INA SA PAGKADALAGA)</div><label className="ln">{inp("pobProv", "ul")}PROVINCE/STATE, COUNTRY</label></div>
                <div className="gr" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "0 8px", marginTop: 6 }}>
                  <label className="ln">{inp("mFirst", "ul")}FIRST NAME</label><label className="ln">{inp("mMid", "ul")}MIDDLE NAME</label>
                  <label className="ln">{inp("mSur", "ul")}SURNAME</label><label className="ln">{inp("mExt", "ul")}EXT NAME</label></div></div>
              <div className="pd vl"><b>MOBILE NUMBER</b>{seg("mobile", SEG.mobile, { style: { margin: "3px 0 5px", height: 22 } })}
                DO YOU OWN THE MOBILE NUMBER WRITTEN ABOVE?<br /><i>(Ikaw ba ang nagmamay-ari ng numero sa itaas?)</i> {rg("ownMobile", "ownMobile", YES_NO, { cls: "n", style: { display: "inline-flex", gap: 8, verticalAlign: "middle" } })}
                <div style={{ marginTop: 3 }}>If No, Full Name and relationship with owner of number:</div>
                <div className="gr" style={{ gridTemplateColumns: "1.6fr 1fr", gap: "0 8px", marginTop: 6 }}>
                  <label className="ln">{inp("ownerName", "ul", { disabled: v.ownMobile !== "No" })}<span style={{ color: "#c00" }}>FULL NAME</span></label>
                  <label className="ln">{inp("ownerRel", "ul", { disabled: v.ownMobile !== "No" })}<span style={{ color: "#c00" }}>RELATIONSHIP</span></label></div></div></div>

            <div className="gr blk" style={{ gridTemplateColumns: "56% 44%" }}>
              <div>
                <div className="pd"><b>CIVIL STATUS</b> (Katayuang sibil){rg("civil", "civil", CIVIL, { cls: "big", style: { display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 3 } })}
                  <div style={{ marginTop: 4 }}><b>Name of spouse if married:</b></div>
                  <div className="gr sp" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: "0 8px", marginTop: 4 }}>
                    <label className="ln">{inp("spFirst", "ul", { disabled: !married })}FIRST NAME</label><label className="ln">{inp("spMid", "ul", { disabled: !married })}MIDDLE NAME</label>
                    <label className="ln">{inp("spSur", "ul", { disabled: !married })}SURNAME</label><label className="ln">{inp("spExt", "ul", { disabled: !married })}EXT NAME</label></div>
                  <div className="gr" style={{ gridTemplateColumns: "22% 1fr", gap: 6, alignItems: "center", marginTop: 3 }}><div style={{ fontSize: 8 }}><b>RSBSA Number</b><br />(system-generated)<br /><i>if registered:</i></div>{seg("spNo", SEG.rsbsa, { disabled: !married })}</div></div>
                <div className="pd blk"><b>RELIGION</b> (Relihiyon){rg("religion", "religion", RELIGION, { cls: "big", style: { marginTop: 3, gap: "4px 24px" } })}</div></div>
              <div className="vl">
                <div className="pd"><b>HIGHEST FORMAL EDUCATION</b><br />(PINAKAMATAAS NA ANTAS NG PINAG-ARALAN){rg("edu", "edu", EDUCATION, { edu: true })}</div>
                <div className="pd blk"><b>SUBMITTED VALID PROOF OF IDENTITY</b><br />(ISINUMITENG KATIBAYAN NG PAGKATAO)
                  <div className="gr" style={{ gridTemplateColumns: "auto 1fr", gap: "2px 4px", alignItems: "end", marginTop: 4 }}><span style={{ fontSize: 8 }}><b>ID/Document Type:</b></span>{inp("idType", "ul")}<i style={{ fontSize: 7, gridColumn: "1/3" }}>Refer to the list at the back (Tingnan ang listahan sa likod)</i><span style={{ fontSize: 8 }}><b>ID/Document Number:</b></span>{inp("idNo", "ul")}</div></div></div></div>

            <div className="gr blk" style={{ gridTemplateColumns: "56% 22% 22%" }}>
              <div className="pd"><b>PART OF INDIGENOUS CULTURAL COMMUNITY (ICC) / INDIGENOUS PEOPLES (IPs)</b>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>{rg("icc", "icc", YES_NO, { cls: "big" })}<b style={{ fontSize: 8 }}>If Yes, name of ICC/IP:</b>{inp("iccName", "ul", { disabled: v.icc !== "Yes", style: { flex: 1, width: "auto" } })}</div></div>
              <div className="pd vl"><b>PERSON WITH DISABILITY (PWD)</b>{rg("pwd", "pwd", YES_NO, { cls: "big", style: { marginTop: 4 } })}</div>
              <div className="pd vl"><b>4Ps BENEFICIARY</b><div style={{ fontSize: 6 }}>(DSWD Pantawid Pamilyang Pilipino Program)</div>{rg("fourPs", "fourPs", YES_NO, { cls: "n", style: { marginTop: 4 } })}</div></div>

            <div className="blk pd"><b>MEMBERSHIP IN FARMERS or IRRIGATORS ASSOCIATION / COOPERATIVE / ORGANIZATION: FCA/IA/Organization Names:</b>
              <div className="gr" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 3 }}>
                <div className="mb"><i>1</i>{inp("org1", "gb")}</div><div className="mb"><i>2</i>{inp("org2", "gb")}</div><div className="mb"><i>3</i>{inp("org3", "gb")}</div></div></div>

            <div className="bk">PART 2: LIVELIHOOD PROFILE</div>
            <div className="pd">{rg("livelihood", "livelihood", LIVELIHOOD, { cls: "big", style: { justifyContent: "space-between", gap: "4px 8px" } })}
              <div className="gr" style={{ gridTemplateColumns: "22% 60% 18%", marginTop: 3 }}>
                <div className="note">If you are a FARMER, proceed to PART 3 (Kung ikaw ay MAGSASAKA, sagutan ang PART 3).</div>
                <div className="note">If you are a FARM WORKER or FISHER, kindly request a CERTIFICATION AS FARM WORKER/FISHER from the City/Municipal Agriculture Office (Mag-request ng SERTIPIKASYON BILANG MANGGAGAWA SA SAKAHAN / MANGINGISDA mula sa City/Municipal Agriculture Office).</div>
                <div className="note">If you are an AGRI-YOUTH proceed to PART 4 (Kung ikaw ay AGRI-YOUTH, sagutan ang PART 4).</div></div></div>

            <div className="stub" style={{ marginTop: "auto" }}>
              <div>
                <div className="brand" style={{ padding: 0 }}><img className="logo" style={{ height: 44 }} src={LOGO} alt="DA / RSBSA logo" /><div><div style={{ fontSize: 9.5 }}>REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE</div><b style={{ fontSize: 13 }}>RSBSA Enrollment Stub: Client's Copy</b></div></div>
                <div className="gr" style={{ gridTemplateColumns: "auto 1fr", gap: "0 8px", alignItems: "end", marginTop: 10 }}><b style={{ fontSize: 11, paddingBottom: 10 }}>NAME OF ENROLLEE:</b>
                  <div><div className="stl">{stubName.map((s, i) => <span key={i}>{(s || "").trim()}</span>)}</div>
                    <div className="gr" style={{ gridTemplateColumns: "repeat(4,1fr)", fontSize: 7, textAlign: "center" }}><span>FIRST NAME</span><span>MIDDLE NAME</span><span>SURNAME</span><span>EXT NAME</span></div></div></div>
                <div style={{ marginTop: 6 }}><b style={{ fontSize: 11 }}>TRANSACTION CODE:</b> <b>{tc}</b></div></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div className="rb">Gamitin ang RSBSA Finder upang malaman kung ikaw ay matagumpay nang naka-rehistro sa RSBSA. Gamit ang Internet, puntahan ang website:<b>finder-rsbsa.da.gov.ph</b>Maaari ring i-scan ang QR code sa kanan.</div><img className="qr" src={QR} alt="RSBSA Finder QR code" /></div></div>
            <div className="fine">THIS OFFICIAL RSBSA ENROLLMENT FORM IS NOT FOR SALE</div>
          </div>
        </div>

        {/* ======================= LONG BOND 2 — PART 3 & PART 4 ======================= */}
        <div className="rp-sheet">
          <div className="page">
            <div className="h2"><img className="logo" src={LOGO} alt="DA / RSBSA logo" /><div><div style={{ fontSize: 9 }}>REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE</div><b style={{ fontSize: 13 }}>RSBSA Enrollment Form</b></div></div>
            <div className="bk">PART 3: FARM PARCEL INFORMATION</div>
            <div className="pc" style={{ borderTop: 0 }}><div style={{ background: "#d0d0d0", display: "grid", placeItems: "center", fontWeight: "bold", fontSize: 10, borderBottom: "1px solid #000" }}>FARM PARCEL DESCRIPTION</div>
              <table className="pt"><colgroup><col width="23%" /><col width="24%" /><col width="15.4%" /><col width="13%" /><col width="13.6%" /><col width="11%" /></colgroup>
                <thead><tr><th style={{ height: 34 }}>CROPPING SCHEDULE<br />(Ex: Jan-Mar)</th><th>COMMODITY</th><th>SIZE (HA)</th><th>NO. OF HEADS /TREES</th><th>FARM TYPE<br /><span style={{ fontWeight: "normal", fontStyle: "italic", fontSize: 6 }}>(Refer to the list below; tingnan ang listahan sa ibaba)</span></th><th>Organic Agri? (Y/N)</th></tr></thead></table></div>
            <div>{Array.from({ length: PARCEL_COUNT }, (_, i) => parcel(i))}</div>
            <div className="refs"><div><h4>ACCEPTED PROOF OF IDENTITY (ID/DOCUMENT)</h4><ul><li>Birth Certificate</li><li>PhilID/National ID/E-PhilID</li><li>Passport</li><li>Driver's License</li><li>e-Card / UMID</li><li>SSS ID</li><li>PRC ID</li><li>IBP ID</li><li>NBI Clearance</li><li>Voter's ID</li><li>TIN ID</li><li>Pag-IBIG ID</li><li>Senior Citizen ID</li><li>PWD ID</li><li>Solo Parent ID</li><li>4Ps ID</li><li>Postal ID</li><li>PhilHealth ID</li><li>City/Municipal/Barangay ID</li><li>Employee/School ID</li></ul></div>
              <div><h4>ACCEPTED PROOF OF LAND OWNERSHIP<sup>1</sup> / FARMING AGREEMENT<sup>2</sup> (DOCUMENT)</h4><div style={{ columns: 2, columnGap: 8 }}>(a) Certificate of Land Transfer<br />(b) Emancipation Patent<br />(c) Individual Certificate of Land Ownership Award (CLOA)<br />(d) Collective CLOA<br />(e) Co-ownership CLOA<br />(f) Agricultural sales patent<br />(g) Homestead patent<br />(h) Free Patent<br />(i) Certificate of Title or Regular Title<br />(j) Certificate of Ancestral Domain Title<br />(k) Certificate of Ancestral Land Title<br />(l) Tax Declaration<br />(m) Others (e.g. Barangay Certification, Lease or Tenancy Agreement)</div><span style={{ fontSize: 6.5 }}><sup>1</sup> - for Registered Owners &nbsp; <sup>2</sup> - for Tenants, Lessees, Others</span></div>
              <div><h4>FARM TYPE</h4>1 - Irrigated<br />2 - Rainfed Upland<br />3 - Rainfed Lowland<br />4 - Urban/Peri-Urban<br />N/A - Not Applicable (for fisheries)</div></div>

            <div className="bk" style={{ marginTop: 0, borderTop: "1px solid #fff" }}>PART 4: CONSENT DECLARATION AND DATA PRIVACY POLICY</div>
            <div className="cons">I hereby declare that all information indicated in this form are true, correct and complete, and that they may be used by the Department of Agriculture for the purposes of registration to the RSBSA and other legitimate interests of the Department pursuant to its mandates. I am fully aware that I can be held liable for any misdeclaration or intentional omission made herein pursuant to applicable laws and regulations.<br />&nbsp;&nbsp;&nbsp;&nbsp;Furthermore, I hereby give consent to the Department of Agriculture to conduct validation activities on my declared farm parcels through the RSBSA Georeferencing Activity.</div>
            <div className="sgn">
              <div className="in"><input type="date" className={bad("signDate") ? "bad" : ""} value={v.signDate} onChange={(e) => patch({ signDate: e.target.value })} disabled={ro} /></div>
              <div className="in">{inp("printedName", "")}</div>
              <div className="in"><SignatureField readOnly={ro} bad={bad("signature")} image={v.signImage} typed={v.signature} name={v.printedName} onChange={(img) => patch({ signImage: img, signature: "", signedAt: img ? new Date().toISOString() : "" })} /></div>
              <div className="lb">DATE</div><div className="lb">PRINTED NAME OF REGISTRANT</div><div className="lb">SIGNATURE / THUMBMARK</div></div>
            <div className="pd blk" style={{ background: "#e0e0e0", fontWeight: "bold", fontSize: 9 }}>VERIFIED TRUE AND CORRECT BY:</div>
            <div className="ver"><div><span>SIGNATURE ABOVE PRINTED NAME / DATE</span><b>Barangay Chairperson / ICC/IPs Leader/Elder (IPs)/ C/Mun Veterinarian (Livestock)/ Mill District Officer (Sugarcane)/ C/MARO (ARBs)</b></div><div><span>SIGNATURE ABOVE PRINTED NAME / DATE</span><b>City/Municipal Agri-Fishery Council (C/MAFC) Chairperson</b></div><div><span>SIGNATURE ABOVE PRINTED NAME / DATE</span><b>City/Municipal Agriculturist (C/MA)</b><br /><i>required</i></div><div><span>SIGNATURE ABOVE PRINTED NAME / DATE</span><b>Enumerator (if administered)</b><br /><i>required</i></div></div>
            <div className="bk" style={{ textAlign: "center", background: "#d0d0d0", color: "#000", fontSize: 9, borderTop: "1px solid #000" }}>DATA PRIVACY POLICY NOTICE</div>
            <div className="cons" style={{ fontSize: 8 }}>The collection of personal information is for documentation, planning, reporting, and policy-making in availing of agri-fishery related interventions. Processed data shall only be shared to partner agencies for planning, reporting and other use in accordance with the mandate of the agency. This is in compliance with the Data Sharing Policy of the Department. <u>You have the right to exercise your data subject rights</u> as enumerated under Sec. 16 of the Data Privacy Act of 2012. To do so, please email the Data Protection Officer at <b>dpo@da.gov.ph</b>.</div>
            <div className="ver w" style={{ borderTop: "1px solid #000" }}><div><span>&nbsp;</span><b>Barangay Chairperson / ICC/IPs Leader/Elder (IPs)/ C/Mun Veterinarian (Livestock)/ Mill District Officer (Sugarcane)/ C/MARO (ARBs)</b></div><div><span>&nbsp;</span><b>City/Municipal Agri-Fishery Council (C/MAFC) Chairperson</b></div><div><span>&nbsp;</span><b>City/Municipal Agriculturist (C/MA)</b><br /><i>required</i></div><div><span>&nbsp;</span><b>Enumerator (if administered)</b><br /><i>required</i></div></div>
            <div className="fine" style={{ marginTop: "auto" }}>THIS OFFICIAL RSBSA ENROLLMENT FORM IS NOT FOR SALE</div>
          </div>
        </div>
      </div>
    </div>
  );
}
