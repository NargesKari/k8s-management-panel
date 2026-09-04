import { useState } from "react";
import { useChaos } from "./ChaosContext.jsx";
import SudokuModal from "./SudokuModal.jsx";

function formatRemaining(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChaosButton() {
  const { chaosActive, remainingMs } = useChaos();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="chaos-fab" onClick={() => setOpen(true)} title="Emergency chaos stop">
        {chaosActive ? "🛑 make it stop" : `😌 calm for ${formatRemaining(remainingMs)}`}
      </button>
      <SudokuModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
