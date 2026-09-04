import { useEffect, useRef, useState } from "react";
import { useChaos } from "./ChaosContext.jsx";

const CROSS_DURATION_MS = 5000;
const INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function SkeletonSvg() {
  return (
    <svg viewBox="0 0 60 100" width="100%" height="100%">
      <circle cx="30" cy="16" r="13" fill="#f4f2ea" stroke="#c9c6ba" strokeWidth="2" />
      <circle cx="25" cy="14" r="2.5" fill="#1c2230" />
      <circle cx="35" cy="14" r="2.5" fill="#1c2230" />
      <path d="M25 22 Q30 26 35 22" stroke="#1c2230" strokeWidth="1.5" fill="none" />
      <rect x="26" y="28" width="8" height="6" fill="#f4f2ea" />
      <path
        d="M16 36 h28 M18 44 h24 M18 52 h24 M20 60 h20"
        stroke="#f4f2ea"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <rect x="20" y="34" width="20" height="30" rx="4" fill="none" stroke="#c9c6ba" strokeWidth="2" />
      {/* arms */}
      <path d="M20 40 L4 54" stroke="#f4f2ea" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 40 L56 54" stroke="#f4f2ea" strokeWidth="4" strokeLinecap="round" />
      {/* legs */}
      <path d="M26 64 L18 96" stroke="#f4f2ea" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M34 64 L42 96" stroke="#f4f2ea" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Skeleton() {
  const { spawnAllowed, lockScreen } = useChaos();
  const [run, setRun] = useState(null); // { fromLeft, topPct } | null
  const timers = useRef([]);

  useEffect(() => {
    if (!spawnAllowed) {
      setRun(null);
      return;
    }
    let cancelled = false;

    const scheduleNext = () => {
      const t = setTimeout(() => {
        if (cancelled) return;
        setRun({ fromLeft: Math.random() < 0.5, topPct: 15 + Math.random() * 60 });
        const t2 = setTimeout(() => {
          if (!cancelled) setRun(null);
        }, CROSS_DURATION_MS);
        timers.current.push(t2);
        scheduleNext();
      }, INTERVAL_MS);
      timers.current.push(t);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [spawnAllowed]);

  if (!spawnAllowed || !run) return null;

  return (
    <button
      className={`skeleton-walker ${run.fromLeft ? "skeleton-from-left" : "skeleton-from-right"}`}
      style={{ top: `${run.topPct}%` }}
      onClick={lockScreen}
      aria-label="dangerous skeleton, do not click"
    >
      <SkeletonSvg />
    </button>
  );
}
