import { flushSync } from "react-dom";

export function runViewTransition(update: () => void) {
  if (
    typeof document === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !document.startViewTransition
  ) {
    update();
    return;
  }

  document.startViewTransition(() => {
    flushSync(update);
  });
}
