import { todayISO } from "./rsbsaForm";

// An "Assistance Announcement" type -> the assistance_records type it creates.
// (The database trigger applies the same mapping, so the client can't get it wrong.)
export const recordTypeFor = (t) => (t === "Cash Assistance" ? "Cash Aid" : t);

// Applications are open until the end of the deadline day (no deadline = always open).
export const isApplicationOpen = (a) => !a.deadline || a.deadline >= todayISO();

export const fmtDate = (d) => new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

// Where clicking a notification should take the user.
export function notificationPath(n, role) {
  if (n.category === "announcement") return `/${role}/announcements`;
  if (n.category === "assistance") return `/${role}/eligibility`;      // farmer: see eligibility + apply
  if (n.category === "application") return `/${role}/assistance`;      // admin: Assistance Management
  if (n.category === "crop_verification") return `/${role}/crops`;      // admin: Crop Verification
  if (n.category === "crop") return `/${role}/crops`;                   // farmer: result of their crop registration
  return null;
}
