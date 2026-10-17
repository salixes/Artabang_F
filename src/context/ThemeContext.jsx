import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const KEY = "agritabang-theme"; // "dark" | "light"
const ThemeContext = createContext({ dark: false, toggleTheme: () => {}, setDark: () => {} });

const readSaved = () => {
  try { return localStorage.getItem(KEY) === "dark"; } catch (_) { return false; }
};

// One theme for every role (admin, farmer, president), remembered on this device.
export function ThemeProvider({ children }) {
  const [dark, setDarkState] = useState(readSaved);

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch (_) { /* private mode */ }
  }, [dark]);

  const setDark = useCallback((v) => setDarkState(!!v), []);
  const toggleTheme = useCallback(() => setDarkState((d) => !d), []);

  return <ThemeContext.Provider value={{ dark, setDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
