import { useEffect, useRef, useState } from "react";
import { useChaos } from "./ChaosContext.jsx";
import CreatureSvg from "./CreatureSvg.jsx";

const EDGES = ["top", "bottom", "left", "right"];

function randomSpawn() {
  const edge = EDGES[Math.floor(Math.random() * EDGES.length)];
  const along = 10 + Math.random() * 80; // % along that edge, avoid corners
  return { edge, along };
}

export default function Creature() {
  const { chaosActive } = useChaos();
  const [visible, setVisible] = useState(false);
  const [spawn, setSpawn] = useState(randomSpawn);
  const timers = useRef([]);

  useEffect(() => {
    if (!chaosActive) {
      setVisible(false);
      return;
    }
    let cancelled = false;

    const scheduleNext = () => {
      const delay = 7000 + Math.random() * 6000; // every ~7-13s
      const t = setTimeout(() => {
        if (cancelled) return;
        setSpawn(randomSpawn());
        setVisible(true);
        const t2 = setTimeout(() => {
          if (!cancelled) setVisible(false);
        }, 2400);
        timers.current.push(t2);
        scheduleNext();
      }, delay);
      timers.current.push(t);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [chaosActive]);

  if (!chaosActive) return null;

  const posStyle =
    spawn.edge === "top" || spawn.edge === "bottom"
      ? { left: `${spawn.along}%` }
      : { top: `${spawn.along}%` };

  return (
    <div
      className={`creature creature-${spawn.edge} ${visible ? "creature-visible" : ""}`}
      style={posStyle}
      aria-hidden="true"
    >
      <CreatureSvg />
    </div>
  );
}
