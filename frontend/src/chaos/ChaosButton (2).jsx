import { useState } from "react";
import { Ban, Coffee } from "lucide-react";
import { useChaos } from "./ChaosContext.jsx";
import SudokuModal from "./SudokuModal.jsx";

function formatRemaining(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChaosButton() {
  const { chaosActive, remainingMs, setSudokuOpen } = useChaos();
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    setSudokuOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setSudokuOpen(false);
  };

  return (
    <>
      <button className="chaos-fab" onClick={show} title="Emergency chaos stop">
        {chaosActive ? (
          <>
            <Ban size={14} /> make it stop
          </>
        ) : (
          <>
            <Coffee size={14} /> calm {formatRemaining(remainingMs)}
          </>
        )}
      </button>
      <SudokuModal open={open} onClose={hide} />
    </>
  );
}
