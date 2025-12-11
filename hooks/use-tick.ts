"use client";

import { useEffect, useSyncExternalStore } from "react";

// Module-level singleton ticker to avoid multiple intervals
let tickCount = 0;
const subscribers = new Set<() => void>();
let intervalStarted = false;

function startInterval() {
  if (intervalStarted) return;
  intervalStarted = true;
  setInterval(() => {
    tickCount += 1;
    subscribers.forEach((cb) => cb());
  }, 1000);
}

function subscribe(callback: () => void) {
  startInterval();
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot() {
  return tickCount;
}

function getServerSnapshot() {
  return 0;
}

/**
 * useTick returns a number that updates once per second.
 * All consumers share a single setInterval.
 */
export function useTick(): number {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Force client-only
  useEffect(() => {
    /* Empty */
  }, []);
  return value;
}
