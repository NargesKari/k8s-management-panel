import { Heart } from "lucide-react";
import { useChaos } from "./ChaosContext.jsx";

const COLORS = ["#ff5c7a", "#ffb547", "#f5e04e", "#3ddc97", "#4fd6e0"];

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
            <Heart size={26} fill={filled ? "currentColor" : "none"} strokeWidth={filled ? 1.5 : 2} />
          </span>
        );
      })}
    </div>
  );
}
