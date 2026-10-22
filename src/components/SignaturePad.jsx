import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./signature.css";

/**
 * SignaturePad — the person who fills in a form signs it here.
 *   Draw   : finger, stylus or mouse
 *   Type   : type the name, it is turned into a handwriting-style signature
 *   Upload : photo / scan of a signature on paper (white background is removed)
 * The signature is kept as a small transparent PNG (data URL) inside the form's saved
 * values, so it shows up again when the form is viewed or printed. Older records that
 * only have a typed name still display (as handwriting text).
 */
const INK = "#10246b";
const SCRIPT = '"Segoe Script","Brush Script MT","Snell Roundhand","Lucida Handwriting",cursive';
const OUT_W = 480, OUT_H = 160;

export const isImageSig = (v) => typeof v === "string" && v.startsWith("data:image");

// crop the empty space around the ink and fit it into a small, even-sized PNG
function finish(src) {
  const ctx = src.getContext("2d");
  const { width: w, height: h } = src;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return "";
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const pad = 6, scale = Math.min((OUT_W - pad * 2) / cw, (OUT_H - pad * 2) / ch, 1.6);
  const out = document.createElement("canvas");
  out.width = Math.round(cw * scale) + pad * 2; out.height = Math.round(ch * scale) + pad * 2;
  const o = out.getContext("2d");
  o.imageSmoothingQuality = "high";
  o.drawImage(src, x0, y0, cw, ch, pad, pad, cw * scale, ch * scale);
  return out.toDataURL("image/png");
}

function typedToCanvas(text) {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 300;
  const g = c.getContext("2d");
  g.fillStyle = INK; g.textBaseline = "middle";
  let size = 130;
  g.font = `${size}px ${SCRIPT}`;
  while (g.measureText(text).width > 1120 && size > 30) { size -= 6; g.font = `${size}px ${SCRIPT}`; }
  g.fillText(text, 40, 150);
  return c;
}

function imageToCanvas(img) {
  const c = document.createElement("canvas");
  const s = Math.min(1, 900 / img.width);
  c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, c.width, c.height);
  // make near-white paper transparent, keep the ink
  const im = g.getImageData(0, 0, c.width, c.height), p = im.data;
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    if (lum > 205) p[i + 3] = 0;
    else { p[i] = 16; p[i + 1] = 36; p[i + 2] = 107; p[i + 3] = Math.min(255, (205 - lum) * 3); }
  }
  g.putImageData(im, 0, 0);
  return c;
}

function SignDialog({ initialName, onClose, onSave }) {
  const [tab, setTab] = useState("draw");
  const [typed, setTyped] = useState(initialName || "");
  const [upload, setUpload] = useState(null); // canvas
  const [uploadUrl, setUploadUrl] = useState("");
  const [inked, setInked] = useState(false);
  const cv = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);

  // set up the drawing canvas at the screen's pixel density
  useEffect(() => {
    if (tab !== "draw" || !cv.current) return;
    const c = cv.current, r = c.getBoundingClientRect(), dpr = Math.max(1, window.devicePixelRatio || 1);
    if (!c.dataset.ready) { c.width = r.width * dpr; c.height = r.height * dpr; c.dataset.ready = "1"; }
    const g = c.getContext("2d");
    g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = INK; g.lineWidth = 2.6 * dpr;
  }, [tab]);

  const pos = (e) => {
    const c = cv.current, r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const down = (e) => { e.preventDefault(); cv.current.setPointerCapture?.(e.pointerId); drawing.current = true; last.current = pos(e); setInked(true);
    const g = cv.current.getContext("2d"); g.beginPath(); g.arc(last.current.x, last.current.y, g.lineWidth / 2, 0, 7); g.fillStyle = INK; g.fill(); };
  const move = (e) => {
    if (!drawing.current) return; e.preventDefault();
    const g = cv.current.getContext("2d"), p = pos(e);
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke(); last.current = p;
  };
  const up = () => { drawing.current = false; };
  const clearDraw = () => { const c = cv.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setInked(false); };

  function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { const c = imageToCanvas(img); setUpload(c); setUploadUrl(finish(c)); URL.revokeObjectURL(url); };
    img.src = url;
  }

  const typedUrl = typed.trim() ? finish(typedToCanvas(typed.trim())) : "";
  const canUse = tab === "draw" ? inked : tab === "type" ? !!typed.trim() : !!uploadUrl;
  const use = () => {
    const url = tab === "draw" ? finish(cv.current) : tab === "type" ? typedUrl : uploadUrl;
    if (url) onSave(url);
  };

  return createPortal(
    <div className="sig-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sig-dialog" role="dialog" aria-label="Add your signature">
        <div className="sig-head"><h3><i className="fa-solid fa-signature"></i> Add your signature</h3><button type="button" className="sig-x" onClick={onClose} aria-label="Close">&times;</button></div>
        <div className="sig-tabs">
          {[["draw", "fa-pen-nib", "Draw"], ["type", "fa-keyboard", "Type"], ["upload", "fa-image", "Upload"]].map(([k, ic, l]) => (
            <button type="button" key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><i className={`fa-solid ${ic}`}></i> {l}</button>
          ))}
        </div>

        {tab === "draw" && (
          <>
            <canvas ref={cv} className="sig-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
            <p className="sig-tip">Sign inside the box using your finger, stylus or mouse.</p>
          </>
        )}
        {tab === "type" && (
          <>
            <input className="sig-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full name" autoFocus />
            <div className="sig-preview">{typed.trim() ? <span style={{ fontFamily: SCRIPT, color: INK }}>{typed}</span> : <em>Your signature will look like this</em>}</div>
          </>
        )}
        {tab === "upload" && (
          <>
            <label className="sig-drop">
              <input type="file" accept="image/*" onChange={onFile} hidden />
              {uploadUrl ? <img src={uploadUrl} alt="Signature preview" /> : <span><i className="fa-solid fa-cloud-arrow-up"></i> Choose a photo or scan of your signature</span>}
            </label>
            <p className="sig-tip">Sign on plain white paper, take a clear photo, and upload it. The white background is removed automatically.</p>
          </>
        )}

        <p className="sig-legal"><i className="fa-solid fa-circle-info"></i> By signing, you confirm this is your own signature and that you filled in this form yourself.</p>
        <div className="sig-actions">
          {tab === "draw" && <button type="button" className="sig-btn" onClick={clearDraw}>Clear</button>}
          {tab === "upload" && uploadUrl && <button type="button" className="sig-btn" onClick={() => { setUpload(null); setUploadUrl(""); }}>Remove</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="sig-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="sig-btn pri" disabled={!canUse} onClick={use}>Use this signature</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SignaturePad({ value, onChange, readOnly = false, bad = false, printedName = "", height = 44, line = true }) {
  const [open, setOpen] = useState(false);
  const img = isImageSig(value);
  const has = !!(value || "").trim();
  const click = () => { if (!readOnly) setOpen(true); };
  return (
    <>
      <div
        className={`sig-box${bad ? " bad" : ""}${readOnly ? " ro" : ""}${line ? " line" : ""}`}
        style={{ height }} onClick={click}
        role={readOnly ? undefined : "button"} tabIndex={readOnly ? undefined : 0}
        onKeyDown={(e) => { if (!readOnly && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); } }}
        title={readOnly ? undefined : "Click to sign"}
      >
        {img ? <img src={value} alt="Signature" />
          : has ? <span className="sig-text" style={{ fontFamily: SCRIPT }}>{value}</span>
          : !readOnly && <span className="sig-ph"><i className="fa-solid fa-signature"></i> Click here to sign</span>}
        {!readOnly && has && <button type="button" className="sig-redo" onClick={(e) => { e.stopPropagation(); setOpen(true); }} title="Sign again"><i className="fa-solid fa-pen"></i></button>}
      </div>
      {open && <SignDialog initialName={printedName} onClose={() => setOpen(false)} onSave={(url) => { onChange(url); setOpen(false); }} />}
    </>
  );
}
