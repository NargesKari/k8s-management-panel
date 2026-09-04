import { useState } from "react";
import { useChaos } from "./ChaosContext.jsx";

const SOLUTION = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

const PUZZLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

function makeInitialGrid() {
  return PUZZLE.map((row) => row.map((cell) => (cell === 0 ? "" : String(cell))));
}

export default function SudokuModal({ open, onClose }) {
  const { disableChaos } = useChaos();
  const [grid, setGrid] = useState(makeInitialGrid);
  const [message, setMessage] = useState("");
  const [solved, setSolved] = useState(false);

  if (!open) return null;

  const handleChange = (r, c, value) => {
    if (PUZZLE[r][c] !== 0) return;
    const clean = value.replace(/[^1-9]/g, "").slice(-1);
    const next = grid.map((row) => [...row]);
    next[r][c] = clean;
    setGrid(next);
  };

  const handleCheck = () => {
    const isFull = grid.every((row) => row.every((v) => v !== ""));
    if (!isFull) {
      setMessage("Fill in every cell first.");
      return;
    }
    const isCorrect = grid.every((row, r) => row.every((v, c) => Number(v) === SOLUTION[r][c]));
    if (isCorrect) {
      setSolved(true);
      setMessage("Solved! Enjoy 30 minutes of peace.");
      disableChaos(30);
    } else {
      setMessage("Not quite right — keep going.");
    }
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal sudoku-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">🛑 Emergency chaos stop</h3>
        <p className="modal-desc">
          Solve this Sudoku to pause the wandering creature and the runaway buttons for 30
          minutes.
        </p>

        <div className="sudoku-grid">
          {grid.map((row, r) =>
            row.map((val, c) => {
              const given = PUZZLE[r][c] !== 0;
              const classes = [
                "sudoku-cell",
                given ? "sudoku-given" : "",
                c % 3 === 2 && c !== 8 ? "sudoku-border-right" : "",
                r % 3 === 2 && r !== 8 ? "sudoku-border-bottom" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <input
                  key={`${r}-${c}`}
                  className={classes}
                  value={val}
                  disabled={given || solved}
                  onChange={(e) => handleChange(r, c, e.target.value)}
                  inputMode="numeric"
                  maxLength={1}
                />
              );
            })
          )}
        </div>

        {message && (
          <p style={{ color: solved ? "var(--success)" : "var(--danger)", fontSize: 13.5, marginTop: 14 }}>
            {message}
          </p>
        )}

        <div className="modal-actions" style={{ marginTop: 18 }}>
          <button className="btn" onClick={handleClose}>
            {solved ? "Close" : "Give up"}
          </button>
          {!solved && (
            <button className="btn btn-primary" onClick={handleCheck}>
              Check
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
