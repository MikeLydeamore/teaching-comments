"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type GuidedTourStep = {
  description: string;
  interactiveTarget?: boolean;
  target?: string;
  targets?: string[];
  targetActionLabel?: string;
  title: string;
};

type TargetPosition = {
  height: number;
  left: number;
  top: number;
  width: number;
};

function targetPosition(selector: string): TargetPosition | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    return null;
  }

  const bounds = element.getBoundingClientRect();
  const padding = 6;
  const left = Math.max(8, bounds.left - padding);
  const right = Math.min(window.innerWidth - 8, bounds.right + padding);
  const top = Math.max(8, bounds.top - padding);
  const bottom = Math.min(window.innerHeight - 8, bounds.bottom + padding);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    height: bottom - top,
    left,
    top,
    width: right - left,
  };
}

export function GuidedTour({
  completeLabel = "Finish",
  currentStep,
  onComplete,
  onStepChange,
  onSkip,
  steps,
  tourLabel = "Dashboard tour",
}: {
  completeLabel?: string;
  currentStep: number;
  onComplete: () => void;
  onStepChange: (step: number) => void;
  onSkip: () => void;
  steps: GuidedTourStep[];
  tourLabel?: string;
}) {
  const [dialogHeight, setDialogHeight] = useState(280);
  const [positions, setPositions] = useState<TargetPosition[]>([]);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const dialogRef = useRef<HTMLDivElement>(null);
  const step = steps[currentStep];

  useLayoutEffect(() => {
    if (!step) {
      return;
    }

    const selectors = step.targets ?? (step.target ? [step.target] : []);
    const target = selectors[0]
      ? document.querySelector<HTMLElement>(selectors[0])
      : null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });

    function updatePosition() {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
      setPositions(
        selectors
          .map((selector) => targetPosition(selector))
          .filter((position): position is TargetPosition => position !== null),
      );
    }

    const timer = window.setTimeout(updatePosition, 250);
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [currentStep, step]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    function updateDialogHeight() {
      setDialogHeight(dialog?.offsetHeight ?? 280);
    }

    updateDialogHeight();
    const observer = new ResizeObserver(updateDialogHeight);
    observer.observe(dialog);

    return () => observer.disconnect();
  }, [currentStep]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onSkip();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );

      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentStep, onSkip]);

  if (!step) {
    return null;
  }

  const isLastStep = currentStep === steps.length - 1;
  const position = positions[0] ?? null;
  const targetIsInteractive = Boolean(step.interactiveTarget && positions.length);
  const backdropPath = [
    `M 0 0 H ${viewportWidth} V ${viewportHeight} H 0 Z`,
    ...positions.map(
      (item) =>
        `M ${item.left} ${item.top} H ${item.left + item.width} V ${item.top + item.height} H ${item.left} Z`,
    ),
  ].join(" ");
  const viewportMargin = 16;
  const dialogGap = 16;
  const visibleDialogHeight = Math.min(
    dialogHeight,
    viewportHeight - viewportMargin * 2,
  );
  const centredDialogTop = Math.max(
    viewportMargin,
    (viewportHeight - visibleDialogHeight) / 2,
  );
  let dialogTop = centredDialogTop;

  if (position) {
    const belowTarget = position.top + position.height + dialogGap;
    const aboveTarget = position.top - visibleDialogHeight - dialogGap;

    if (
      belowTarget + visibleDialogHeight <=
      viewportHeight - viewportMargin
    ) {
      dialogTop = belowTarget;
    } else if (aboveTarget >= viewportMargin) {
      dialogTop = aboveTarget;
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]" role="presentation">
      {positions.length ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 size-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
        >
          <path
            className="pointer-events-auto fill-slate-950/60"
            d={backdropPath}
            fillRule="evenodd"
          />
        </svg>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-slate-950/60" />
      )}
      {!targetIsInteractive
        ? positions.map((item, index) => (
            <div
              aria-hidden="true"
              className="pointer-events-auto fixed"
              key={`target-blocker-${index}`}
              style={{
                height: item.height,
                left: item.left,
                top: item.top,
                width: item.width,
              }}
            />
          ))
        : null}
      {positions.map((item, index) => (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-md ring-4 ring-teal-300 transition-all duration-200 motion-reduce:transition-none"
          key={`target-ring-${index}`}
          style={{
            background: "transparent",
            height: item.height,
            left: item.left,
            top: item.top,
            width: item.width,
          }}
        />
      ))}
      <div
        aria-describedby="guided-tour-description"
        aria-labelledby="guided-tour-title"
        aria-modal="true"
        className="pointer-events-auto fixed left-4 right-4 mx-auto max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-2xl focus:outline-none"
        ref={dialogRef}
        role="dialog"
        style={{ top: dialogTop }}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
            {tourLabel} · {currentStep + 1} of {steps.length}
          </p>
          <button
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            type="button"
            onClick={onSkip}
          >
            Skip
          </button>
        </div>
        <h2 className="mt-3 text-xl font-semibold text-slate-950" id="guided-tour-title">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600" id="guided-tour-description">
          {step.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:invisible"
            disabled={currentStep === 0}
            type="button"
            onClick={() => onStepChange(Math.max(0, currentStep - 1))}
          >
            Back
          </button>
          {step.targetActionLabel ? (
            <p className="text-right text-sm font-semibold text-teal-800">
              {step.targetActionLabel}
            </p>
          ) : (
            <button
              className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
              type="button"
              onClick={() => {
                if (isLastStep) {
                  onComplete();
                } else {
                  onStepChange(currentStep + 1);
                }
              }}
            >
              {isLastStep ? completeLabel : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
