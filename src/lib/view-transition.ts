import { flushSync } from "react-dom";

let activeTransition: ViewTransition | null = null;

export function runViewTransition(update: () => void) {
  if (
    typeof document === "undefined" ||
    document.visibilityState !== "visible" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !document.startViewTransition
  ) {
    update();
    return;
  }

  activeTransition?.skipTransition();

  try {
    const transition = document.startViewTransition(() => {
      flushSync(update);
    });
    activeTransition = transition;

    // Skipped transitions reject `ready` by design. The DOM update still runs,
    // so an interruption or visibility change only removes the animation.
    void transition.ready.catch(() => {});
    void transition.finished.then(
      () => {
        if (activeTransition === transition) activeTransition = null;
      },
      () => {
        if (activeTransition === transition) activeTransition = null;
      },
    );
  } catch {
    activeTransition = null;
    update();
  }
}
