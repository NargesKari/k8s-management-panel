import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const ChaosCtx = createContext(null);
const STORAGE_KEY = "kari-chaos-disabled-until";
const MAX_LIVES = 5;
const LOCK_MS = 60 * 1000;

export function ChaosProvider({ children }) {
  // 30-minute "calm mode" earned by solving the sudoku
  const [disabledUntil, setDisabledUntil] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : 0;
  });
  const [now, setNow] = useState(Date.now());

  // Whether the sudoku modal is currently open (pauses spawning so you can focus)
  const [sudokuOpen, setSudokuOpen] = useState(false);

  // Lives / lock-screen mini-game
  const [lives, setLives] = useState(MAX_LIVES);
  const [locked, setLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const unlockTimer = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const chaosActive = now >= disabledUntil;
  const remainingMs = Math.max(0, disabledUntil - now);
  const lockRemainingMs = Math.max(0, lockUntil - now);

  const disableChaos = useCallback((minutes) => {
    const until = Date.now() + minutes * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
    setDisabledUntil(until);
  }, []);

  const lockScreen = useCallback(() => {
    clearTimeout(unlockTimer.current);
    setLocked(true);
    setLives(0);
    const until = Date.now() + LOCK_MS;
    setLockUntil(until);
    unlockTimer.current = setTimeout(() => {
      setLocked(false);
      setLives(1);
    }, LOCK_MS);
  }, []);

  const addLife = useCallback(() => {
    setLives((l) => Math.min(MAX_LIVES, l + 1));
  }, []);

  const loseLife = useCallback(
    (amount = 1) => {
      setLives((l) => {
        const next = Math.max(0, l - amount);
        if (next === 0 && l > 0) {
          setTimeout(() => lockScreen(), 0);
        }
        return next;
      });
    },
    [lockScreen]
  );

  useEffect(() => () => clearTimeout(unlockTimer.current), []);

  const spawnAllowed = chaosActive && !sudokuOpen && !locked;

  return (
    <ChaosCtx.Provider
      value={{
        chaosActive,
        disableChaos,
        remainingMs,
        sudokuOpen,
        setSudokuOpen,
        spawnAllowed,
        lives,
        maxLives: MAX_LIVES,
        addLife,
        loseLife,
        locked,
        lockRemainingMs,
        lockScreen,
      }}
    >
      {children}
    </ChaosCtx.Provider>
  );
}

export function useChaos() {
  return useContext(ChaosCtx);
}
