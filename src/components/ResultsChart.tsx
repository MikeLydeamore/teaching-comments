import type { PollResult } from "@/lib/poll-results";

type ResultsChartProps = {
  maxCount: number;
  results: PollResult[];
  total: number;
  variant?: "inline" | "large" | "screen";
};

const chartColors = [
  "#0f766e",
  "#2563eb",
  "#b45309",
  "#be123c",
  "#7c3aed",
  "#15803d",
  "#c2410c",
  "#0369a1",
];

export function ResultsChart({
  maxCount,
  results,
  total,
  variant = "inline",
}: ResultsChartProps) {
  const isLarge = variant === "large" || variant === "screen";
  const isScreen = variant === "screen";

  if (!results.length) {
    return (
      <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
        No typed responses in the current view.
      </p>
    );
  }

  return (
    <div className={`${isScreen ? "mt-8 space-y-5" : isLarge ? "mt-5 space-y-4" : "mt-4 space-y-3"}`}>
      {results.map(([response, count], index) => {
        const percentage = total ? Math.round((count / total) * 100) : 0;
        const barColor = chartColors[index % chartColors.length];

        return (
          <div
            className={`grid gap-2 ${
              isScreen
                ? "md:grid-cols-[minmax(220px,360px)_1fr_80px]"
                : isLarge
                  ? "md:grid-cols-[minmax(180px,320px)_1fr_64px]"
                  : "md:grid-cols-[minmax(140px,240px)_1fr_48px]"
            } md:items-center`}
            key={response}
          >
            <p
              className={`truncate font-medium text-slate-800 ${
                isScreen ? "text-2xl" : isLarge ? "text-base" : "text-sm"
              }`}
              title={response}
            >
              {response}
            </p>
            <div
              className={`${isScreen ? "h-16" : isLarge ? "h-12" : "h-8"} overflow-hidden rounded-md bg-slate-100`}
            >
              <div
                className={`flex min-w-8 items-center justify-end rounded-md px-2 font-semibold text-white ${
                  isScreen ? "h-16 text-xl" : isLarge ? "h-12 text-sm" : "h-8 text-xs"
                }`}
                style={{
                  backgroundColor: barColor,
                  width: `${(count / maxCount) * 100}%`,
                }}
              >
                {count}
              </div>
            </div>
            <p
              className={`text-right font-semibold text-slate-700 ${
                isScreen ? "text-2xl" : isLarge ? "text-base" : "text-sm"
              }`}
            >
              {percentage}%
            </p>
          </div>
        );
      })}
    </div>
  );
}
