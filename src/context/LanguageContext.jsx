import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { LANGUAGES, setLanguage } from "../lib/i18n";

const KEY = "agritabang-lang";
const Ctx = createContext({ lang: "en", chooseLanguage: () => {}, languages: LANGUAGES });
export const useLanguage = () => useContext(Ctx);

// The language menu is for farmers. Other roles always see English.
export function LanguageProvider({ children }) {
  const { role } = useAuth();
  const [saved, setSaved] = useState(() => { try { return localStorage.getItem(KEY) || "en"; } catch (_) { return "en"; } });
  const lang = role === "farmer" && LANGUAGES.some((l) => l.code === saved) ? saved : "en";

  setLanguage(lang); // before the screens below render, so every tr() reads the right language
  useEffect(() => { document.documentElement.lang = lang === "fil" ? "fil" : lang === "ceb" ? "ceb" : "en"; }, [lang]);

  const value = useMemo(() => ({
    lang, languages: LANGUAGES,
    chooseLanguage: (code) => { try { localStorage.setItem(KEY, code); } catch (_) { /* private mode */ } setSaved(code); },
  }), [lang]);

  // key = language: changing it redraws every screen once in the new language
  return <Ctx.Provider value={value}><React.Fragment key={lang}>{children}</React.Fragment></Ctx.Provider>;
}
