import { useEffect, useState } from "react";

/** Configurable timeouts (ms). Override per deployment with VITE_RESULT_TIMEOUT_MS / VITE_IDLE_TIMEOUT_MS. */
export const KIOSK = {
  resultTimeoutMs: Number(import.meta.env["VITE_RESULT_TIMEOUT_MS"] ?? 60_000),
  idleTimeoutMs: Number(import.meta.env["VITE_IDLE_TIMEOUT_MS"] ?? 120_000),
};

/** Calls onTimeout after `ms` without pointer/touch/key activity. ms <= 0 disables. */
export function useIdleReset(ms: number, onTimeout: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled || ms <= 0) return;
    let t = window.setTimeout(onTimeout, ms);
    const reset = () => {
      clearTimeout(t);
      t = window.setTimeout(onTimeout, ms);
    };
    const evs = ["pointerdown", "touchstart", "keydown"] as const;
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [ms, onTimeout, enabled]);
}

const DEV_KEY = "zuitar.devmode";

/** Development mode: toggled with ?dev=1 / ?dev=0 or long-press on the ZUITAR logo. Off by default. */
export function useDevMode(): [boolean, (v: boolean) => void] {
  const [dev, setDev] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("dev");
    if (q === "1" || q === "0") localStorage.setItem(DEV_KEY, q);
    setDev(localStorage.getItem(DEV_KEY) === "1");
  }, []);
  const set = (v: boolean) => {
    localStorage.setItem(DEV_KEY, v ? "1" : "0");
    setDev(v);
  };
  return [dev, set];
}
