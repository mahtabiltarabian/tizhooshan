"use client";

// Offline support: registers the service worker (out/sw.js, written by
// scripts/build-sw.mjs), offers a new version when one is ready, and on the
// home page says whether the app is ready to work with no internet.

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./OfflineSupport.module.css";

const ENABLED = process.env.NODE_ENV === "production";

/** The browser's install prompt (Chrome, Edge, Android); not in TS's DOM types. */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// One shared store: the waiting new version, the install prompt, readiness.
const state: { waiting: ServiceWorker | null; install: InstallPrompt | null; ready: boolean } = {
  waiting: null,
  install: null,
  ready: false,
};
let snapshot = { ...state };
const listeners = new Set<() => void>();
function set(patch: Partial<typeof state>) {
  Object.assign(state, patch);
  snapshot = { ...state };
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const SERVER = { ...state };
const useOffline = () => useSyncExternalStore(subscribe, () => snapshot, () => SERVER);

let started = false;
let updating = false;

function start() {
  if (started || !ENABLED || !("serviceWorker" in navigator)) return;
  started = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    set({ install: e as InstallPrompt });
  });
  window.addEventListener("appinstalled", () => set({ install: null }));

  // Reload once the new version takes over, but only when the user asked:
  // the very first install also changes the controller.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updating) window.location.reload();
  });

  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((reg) => {
      const offer = (w: ServiceWorker | null) => {
        if (w && navigator.serviceWorker.controller) set({ waiting: w });
      };
      offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed") offer(w);
        });
      });
    })
    .catch(() => {});

  // "ready" settles once a version is active, i.e. every file is stored.
  navigator.serviceWorker.ready.then(() => set({ ready: true }));
}

/** In the root layout: registers the worker and offers updates. */
export function OfflineSupport() {
  const { waiting } = useOffline();
  const [later, setLater] = useState(false);
  useEffect(start, []);

  if (!waiting || later) return null;
  return (
    <div className={styles.update} role="status">
      <span>نسخه تازه برنامه آماده است.</span>
      <button
        className={styles.primary}
        onClick={() => {
          updating = true;
          waiting.postMessage("skipWaiting");
        }}
      >
        به‌روزرسانی
      </button>
      <button onClick={() => setLater(true)}>بعداً</button>
    </div>
  );
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const noop = () => () => {};
const useDevice = () =>
  useSyncExternalStore(
    noop,
    () => (isStandalone() ? "app" : isIos() ? "ios" : "web"),
    () => "web",
  );

/** On the home page: offline readiness and a way to install the app. */
export function OfflineStatus() {
  const { ready, install } = useOffline();
  const device = useDevice();
  if (!ENABLED) return null;

  return (
    <p className={styles.status}>
      <span>{ready ? "✓ آماده برای کار بدون اینترنت" : "… در حال آماده‌سازی برای کار بدون اینترنت"}</span>
      {install && device === "web" && (
        <button
          className={styles.install}
          onClick={async () => {
            await install.prompt();
            await install.userChoice;
            set({ install: null });
          }}
        >
          نصب روی این دستگاه
        </button>
      )}
      {device === "ios" && <span className={styles.hint}>برای نصب: در Safari دکمه «اشتراک‌گذاری» و بعد «Add to Home Screen».</span>}
    </p>
  );
}
