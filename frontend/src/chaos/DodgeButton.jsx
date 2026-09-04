import { useEffect, useRef, useState, useCallback } from "react";
import { useChaos } from "./ChaosContext.jsx";

const RANGE_X = 120;
const RANGE_Y = 46;
const TRIGGER_DISTANCE = 110;
const COOLDOWN_MS = 380;

// A button that randomly relocates itself whenever the pointer gets close.
// Because the new position is fully random (not "away from the pointer"),
// it will occasionally land right under the cursor - which is the only
// moment it's actually clickable.
export default function DodgeButton({ children, className = "", onClick, ...rest }) {
  const { chaosActive } = useChaos();
  const wrapperRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const lastJumpRef = useRef(0);

  const jump = useCallback(() => {
    const now = Date.now();
    if (now - lastJumpRef.current < COOLDOWN_MS) return;
    lastJumpRef.current = now;
    setOffset({
      x: (Math.random() * 2 - 1) * RANGE_X,
      y: (Math.random() * 2 - 1) * RANGE_Y,
    });
  }, []);

  useEffect(() => {
    if (!chaosActive) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    function handleMove(e) {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist < TRIGGER_DISTANCE) jump();
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [chaosActive, jump]);

  return (
    <span
      ref={wrapperRef}
      className="dodge-wrapper"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <button className={className} onClick={onClick} {...rest}>
        {children}
      </button>
    </span>
  );
}
