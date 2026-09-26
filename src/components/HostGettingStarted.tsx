"use client";

type ChecklistItem = {
  complete: boolean;
  label: string;
};

export function HostGettingStarted({
  items,
  onDismiss,
  onStartTour,
}: {
  items: ChecklistItem[];
  onDismiss: () => void;
  onStartTour: () => void;
}) {
  const completeCount = items.filter((item) => item.complete).length;
  const percent = Math.round((completeCount / items.length) * 100);

  return (
    <section
      aria-labelledby="getting-started-title"
      className="rounded-md border border-teal-200 bg-white p-4 shadow-sm"
      data-tour="getting-started"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
            First session
          </p>
          <h2 className="mt-1 font-semibold text-slate-950" id="getting-started-title">
            Getting started
          </h2>
        </div>
        <button
          aria-label="Hide getting started checklist"
          className="flex size-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          type="button"
          onClick={onDismiss}
        >
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-600 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">
        {completeCount} of {items.length} complete
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li className="flex items-center gap-2 text-sm text-slate-700" key={item.label}>
            <span
              aria-hidden="true"
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.complete
                  ? "bg-teal-600 text-white"
                  : "border border-slate-300 bg-white text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={item.complete ? "text-slate-500 line-through" : ""}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <button
        className="mt-4 text-sm font-semibold text-teal-700 underline decoration-teal-300 underline-offset-4 hover:text-teal-900"
        type="button"
        onClick={onStartTour}
      >
        Take the dashboard tour
      </button>
    </section>
  );
}
