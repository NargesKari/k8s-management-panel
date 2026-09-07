import { Lock } from "lucide-react";
import { useChaos } from "./ChaosContext.jsx";

export default function LockOverlay() {
  const { locked, lockRemainingMs } = useChaos();
  if (!locked) return null;

  const seconds = Math.ceil(lockRemainingMs / 1000);

  return (
    <div className="lock-overlay">
      <div className="lock-content">
        <div className="lock-icon">
          <Lock size={46} strokeWidth={1.5} />
        </div>
        <div className="lock-title">Screen locked</div>
        <div className="lock-desc">Out of lives — unlocking in {seconds}s</div>
      </div>
    </div>
  );
}
