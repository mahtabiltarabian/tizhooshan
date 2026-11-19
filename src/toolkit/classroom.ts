"use client";

// Classroom mode: full screen and larger text and touch targets, for a
// projector or smart board. Shared by every tool through one tiny store.

import { useSyncExternalStore } from "react";

const EVENT = "tizhooshan:classroom";

const isOn = () => document.documentElement.dataset.classroom === "on";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  document.addEventListener("fullscreenchange", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    document.removeEventListener("fullscreenchange", callback);
  };
}

export function setClassroom(on: boolean) {
  document.documentElement.dataset.classroom = on ? "on" : "off";
  // Full screen is a bonus: some boards and webviews refuse it.
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  window.dispatchEvent(new Event(EVENT));
}

export function useClassroom(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isOn, () => false);
  return [on, setClassroom];
}
