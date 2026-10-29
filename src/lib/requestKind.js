// "New Request" vs "Renewal" for assistance records — the same idea the Crop Insurance page uses:
// the first request a farmer makes for a kind of assistance is a New Request; every later
// request for the same kind of assistance is a Renewal.
export const NEW_REQUEST = "New Request";
export const RENEWAL = "Renewal";
export const REQUEST_KINDS = [NEW_REQUEST, RENEWAL];

export function markRenewals(rows) {
  const ordered = [...rows].sort((a, b) => new Date(a.requested_at) - new Date(b.requested_at) || String(a.id).localeCompare(String(b.id)));
  const seen = new Set();
  const kind = new Map();
  ordered.forEach((r) => {
    const k = `${r.farmer_id}|${r.assistance_type}`;
    kind.set(r.id, seen.has(k) ? RENEWAL : NEW_REQUEST);
    seen.add(k);
  });
  return rows.map((r) => ({ ...r, request_kind: kind.get(r.id) }));
}
