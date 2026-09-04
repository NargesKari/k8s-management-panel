import { useEffect, useRef, useState } from "react";
import { useChaos } from "./ChaosContext.jsx";
import CreatureSvg from "./CreatureSvg.jsx";

// Spawn somewhere safely inside the viewport (not at the very edges, so it
// never ends up partially or fully off-screen), avoiding the top bar and
// the bottom-right corner where the chaos button lives.
function randomSpawn() {
  const top = 18 + Math.random() * 55; // 18% - 73% of viewport height
  const left = 8 + Math.random() * 74; // 8% - 82% of viewport width
  const variant = Math.random() < 0.3 ? "purple" : "green";
  return { top, left, variant };
}

export default function Creature() {
  const { spawnAllowed, addLife, loseLife } = useChaos();
  const [visible, setVisible] = useState(false);
  const [spawn, setSpawn] = useState(randomSpawn);
  const timers = useRef([]);
  const clickedRef = useRef(false);

  useEffect(() => {
    if (!spawnAllowed) {
      setVisible(false);
      return;
    }
    let cancelled = false;

    const scheduleNext = () => {
      const delay = 7000 + Math.random() * 6000; // every ~7-13s
      const t = setTimeout(() => {
        if (cancelled) return;
        clickedRef.current = false;
        const newSpawn = randomSpawn();
        setSpawn(newSpawn);
        setVisible(true);
        const t2 = setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          // Missing a green (friendly) creature costs a life. Missing the
          // purple one is free - it's only bad if you hit it.
          if (!clickedRef.current && newSpawn.variant === "green") {
            loseLife(1);
          }
          scheduleNext();
        }, 2600);
        timers.current.push(t2);
      }, delay);
      timers.current.push(t);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [spawnAllowed]);

  if (!spawnAllowed) return null;

  const handleClick = () => {
    if (clickedRef.current) return;
    clickedRef.current = true;
    setVisible(false);
    if (spawn.variant === "green") {
      addLife();
    } else {
      loseLife(1);
    }
  };

  return (
    <button
      className={`creature ${visible ? "creature-visible" : ""}`}
      style={{ top: `${spawn.top}%`, left: `${spawn.left}%` }}
      onClick={handleClick}
      aria-label={spawn.variant === "green" ? "friendly creature" : "dangerous creature"}
    >
      <CreatureSvg variant={spawn.variant} />
    </button>
  );
}
