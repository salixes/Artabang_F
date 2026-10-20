// Works out WHAT device / browser / system the user is on, from the browser itself.
// (The server separately records the real IP address and the raw user-agent.)

export function parseUserAgent(ua = "") {
  // ---- browser (order matters: Edge/Opera/Samsung also say "Chrome") ----
  let browser = "Unknown browser";
  const v = (re) => (ua.match(re) || [])[1];
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = `Edge ${v(/Edg(?:e|A|iOS)?\/(\d+)/) || ""}`;
  else if (/OPR\/|Opera/.test(ua)) browser = `Opera ${v(/OPR\/(\d+)/) || ""}`;
  else if (/SamsungBrowser\//.test(ua)) browser = `Samsung Internet ${v(/SamsungBrowser\/(\d+)/) || ""}`;
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = `Firefox ${v(/(?:Firefox|FxiOS)\/(\d+)/) || ""}`;
  else if (/Chrome\/|CriOS\//.test(ua)) browser = `Chrome ${v(/(?:Chrome|CriOS)\/(\d+)/) || ""}`;
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = `Safari ${v(/Version\/(\d+)/) || ""}`;
  else if (/MSIE |Trident\//.test(ua)) browser = "Internet Explorer";
  browser = browser.trim();

  // ---- operating system ----
  let os = "Unknown system";
  if (/Windows NT 10\.0/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(ua)) os = "Windows 8.1";
  else if (/Windows NT 6\.1/.test(ua)) os = "Windows 7";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) {
    const ver = v(/Android (\d+(?:\.\d+)?)/);
    const model = (ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|[;)])/) || [])[1];
    os = `Android${ver ? ` ${ver}` : ""}${model && !/^(wv|K|Mobile)$/i.test(model.trim()) ? ` (${model.trim()})` : ""}`;
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    const ver = (v(/OS (\d+)[_\d]*/) || "");
    os = `${/iPad/.test(ua) ? "iPadOS" : "iOS"}${ver ? ` ${ver}` : ""}`;
  } else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux|X11/.test(ua)) os = "Linux";

  // ---- device type ----
  let device_type = "Desktop";
  if (/iPad|Tablet|PlayBook|Silk/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device_type = "Tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/.test(ua)) device_type = "Mobile";

  return { browser, os, device_type };
}

let cached = null;
export function getDeviceInfo() {
  if (cached) return cached;
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const parsed = parseUserAgent(nav.userAgent || "");
  // iPadOS 13+ pretends to be a Mac; touch support gives it away
  if (parsed.os === "macOS" && nav.maxTouchPoints > 1) { parsed.os = "iPadOS"; parsed.device_type = "Tablet"; }
  // Client Hints say "mobile" even when the UA string is vague
  if (nav.userAgentData?.mobile === true && parsed.device_type === "Desktop") parsed.device_type = "Mobile";
  const scr = typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "";
  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) { /* ignore */ }
  const baseOs = parsed.os.replace(/\s*\(.*\)$/, "");   // keep the phone model out of the device fingerprint
  cached = {
    ...parsed, screen: scr, language: nav.language || "", timezone,
    device_key: `${parsed.browser.replace(/\s*\d+$/, "")}|${baseOs}|${parsed.device_type}`,
  };
  return cached;
}
