import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, icon }
  const timer = useRef(null);

  const showToast = useCallback((message, icon = "fa-circle-check") => {
    setToast({ message, icon });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast ${toast ? "" : "hidden"}`}>
        {toast && (
          <span>
            <i className={`fa-solid ${toast.icon}`} style={{ marginRight: 8 }}></i>
            {toast.message}
          </span>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
