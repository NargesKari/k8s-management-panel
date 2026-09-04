import { useChaos } from "./ChaosContext.jsx";

export default function LockOverlay() {
  const { locked, lockRemainingMs } = useChaos();
  if (!locked) return null;

  const seconds = Math.ceil(lockRemainingMs / 1000);

  return (
    <div className="lock-overlay">
      <div className="lock-content">
        <div className="lock-icon">🔒</div>
        <div className="lock-title">Screen locked</div>
        <div className="lock-desc">You ran out of lives. Unlocking in {seconds}s...</div>
      </div>
    </div>
  );
}
