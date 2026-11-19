"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Playback for a rolling die: `p` glides toward `target` (both counted in
 * rolls, 0 … path length), one roll per `perRoll` milliseconds.
 */
export function useRollPlayer(perRoll = 700) {
  const [p, setP] = useState(0);
  const [target, setTarget] = useState(0);
  const pRef = useRef(0);

  useEffect(() => {
    if (pRef.current === target) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const step = (now - last) / perRoll;
      last = now;
      const cur = pRef.current;
      const next = cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
      pRef.current = next;
      setP(next);
      if (next !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, perRoll]);

  /** Go to `v` at once, without rolling. */
  const jump = useCallback((v: number) => {
    pRef.current = v;
    setP(v);
    setTarget(v);
  }, []);

  return { p, target, setTarget, jump, playing: p !== target };
}
