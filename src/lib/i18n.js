// Language support for the farmer screens: English, Filipino (Tagalog) and Bisaya (Cebuano).
// The English text itself is the key: tr("My Profile") -> "Aking Profile" in Filipino.
// Anything without a translation simply stays in English, so nothing ever breaks.
import { FIL, CEB } from "./i18n-strings";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fil", label: "Filipino (Tagalog)" },
  { code: "ceb", label: "Bisaya (Cebuano)" },
];

const TABLES = { fil: FIL, ceb: CEB };
const clean = (s) => s.replace(/[ \t\r\n]+/g, " ").replace(/^ | $/g, "");
let current = "en";

export const getLanguage = () => current;
export const setLanguage = (code) => { current = TABLES[code] ? code : "en"; };

export function tr(text) {
  if (current === "en" || typeof text !== "string") return text;
  const table = TABLES[current];
  return table[text] ?? table[clean(text)] ?? text;
}
