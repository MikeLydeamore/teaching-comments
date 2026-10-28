"use client";

import { useSyncExternalStore } from "react";

function subscribeToHydration() {
  return () => {};
}

export function useHasHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}
