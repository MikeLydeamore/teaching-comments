import type { PollResult } from "@/lib/poll-results";

export type ChartType = "column" | "pie" | "wordCloud";

type ResultsChartProps = {
  chartType?: ChartType;
  maxCount: number;
  results: PollResult[];
  total: number;
  variant?: "inline" | "large" | "screen";
};

export const chartColors = [
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
  chartType = "column",
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
        {chartType === "wordCloud"
          ? "No countable words in the current view."
          : "No typed responses in the current view."}
      </p>
    );
  }

  if (chartType === "pie") {
    return <PieChart results={results} total={total} variant={variant} />;
  }

  if (chartType === "wordCloud") {
    return <WordCloud results={results} variant={variant} />;
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

function WordCloud({
  results,
  variant = "inline",
}: Pick<ResultsChartProps, "results" | "variant">) {
  const isScreen = variant === "screen";
  const isLarge = variant === "large" || isScreen;
  const maxCount = Math.max(...results.map(([, count]) => count));
  const minSize = isScreen ? 24 : isLarge ? 18 : 14;
  const maxSize = isScreen ? 72 : isLarge ? 48 : 34;

  return (
    <div
      aria-label="Word cloud"
      className={`mt-5 flex flex-wrap items-center justify-center rounded-md border border-slate-200 bg-slate-50 ${
        isScreen ? "min-h-96 gap-x-8 gap-y-5 p-8" : "min-h-56 gap-x-5 gap-y-3 p-5"
      }`}
      role="img"
    >
      {results.map(([word, count], index) => {
        const size = minSize + (count / maxCount) * (maxSize - minSize);

        return (
          <span
            className="font-semibold leading-none"
            key={word}
            style={{
              color: chartColors[index % chartColors.length],
              fontSize: `${size}px`,
            }}
            title={`${word}: ${count}`}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

function PieChart({
  results,
  total,
  variant = "inline",
}: Pick<ResultsChartProps, "results" | "total" | "variant">) {
  const isScreen = variant === "screen";
  const isLarge = variant === "large" || isScreen;
  const segments = results.map(([, count], index) => {
    const previousTotal = results
      .slice(0, index)
      .reduce((sum, [, previousCount]) => sum + previousCount, 0);
    const start = (previousTotal / total) * 360;
    const end = ((previousTotal + count) / total) * 360;

    return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
  });

  return (
    <div
      className={`mt-5 grid items-center gap-5 ${
        isScreen
          ? "lg:grid-cols-[minmax(320px,420px)_1fr]"
          : "md:grid-cols-[minmax(220px,280px)_1fr]"
      }`}
    >
      <div
        aria-label="Pie chart"
        className={`mx-auto rounded-full border border-slate-200 shadow-inner ${
          isScreen ? "size-96" : isLarge ? "size-72" : "size-56"
        }`}
        role="img"
        style={{
          background: `conic-gradient(${segments.join(", ")})`,
        }}
      />
      <div className={`${isScreen ? "space-y-4" : "space-y-3"}`}>
        {results.map(([response, count], index) => {
          const percentage = total ? Math.round((count / total) * 100) : 0;

          return (
            <div
              className={`grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-3 ${
                isScreen ? "text-xl" : "text-sm"
              }`}
              key={response}
            >
              <span
                className="size-4 rounded-sm"
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              />
              <span className="truncate font-medium text-slate-800" title={response}>
                {response}
              </span>
              <span className="font-semibold text-slate-700">
                {count} / {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
