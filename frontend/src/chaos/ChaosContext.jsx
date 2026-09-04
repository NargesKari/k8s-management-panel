import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ChaosCtx = createContext(null);
const STORAGE_KEY = "kari-chaos-disabled-until";

export function ChaosProvider({ children }) {
  const [disabledUntil, setDisabledUntil] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : 0;
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const chaosActive = now >= disabledUntil;
  const remainingMs = Math.max(0, disabledUntil - now);

  const disableChaos = useCallback((minutes) => {
    const until = Date.now() + minutes * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
    setDisabledUntil(until);
  }, []);

  return (
    <ChaosCtx.Provider value={{ chaosActive, disableChaos, remainingMs }}>
      {children}
    </ChaosCtx.Provider>
  );
}

export function useChaos() {
  return useContext(ChaosCtx);
}
