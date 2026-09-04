import { useChaos } from "./ChaosContext.jsx";

const COLORS = ["#f0567a", "#f5a94e", "#f5e04e", "#35d399", "#5b8def"];

export default function LivesHud() {
  const { lives, maxLives } = useChaos();

  return (
    <div className="lives-hud" title={`${lives} / ${maxLives} lives`}>
      {Array.from({ length: maxLives }).map((_, i) => {
        const filled = i < lives;
        return (
          <span
            key={i}
            className={`life-heart ${filled ? "life-heart-filled" : "life-heart-empty"}`}
            style={filled ? { color: COLORS[i % COLORS.length] } : undefined}
          >
            ♥
          </span>
        );
      })}
    </div>
  );
}
