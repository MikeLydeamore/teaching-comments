import { chartColors } from "@/components/ResultsChart";

type ResponseTimeSubmission = {
  createdAt: string;
  id: string;
};

type ResponseTimePlotProps = {
  promptUpdatedAt: string;
  submissions: ResponseTimeSubmission[];
  variant?: "inline" | "screen";
};

function jitterFromId(id: string) {
  let hash = 0;

  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  }

  return 22 + (hash % 57);
}

function formatElapsed(seconds: number) {
  const roundedSeconds = Math.round(seconds);

  if (roundedSeconds < 60) {
    return `${roundedSeconds}s`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function ResponseTimePlot({
  promptUpdatedAt,
  submissions,
  variant = "inline",
}: ResponseTimePlotProps) {
  const promptTime = new Date(promptUpdatedAt).getTime();
  const points = submissions
    .map((submission) => ({
      elapsedSeconds: (new Date(submission.createdAt).getTime() - promptTime) / 1000,
      id: submission.id,
    }))
    .filter((point) => Number.isFinite(point.elapsedSeconds) && point.elapsedSeconds >= 0)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
  const maxSeconds = Math.max(30, ...points.map((point) => point.elapsedSeconds));
  const isScreen = variant === "screen";

  return (
    <section className={`${isScreen ? "mt-10" : "mt-5"} border-t border-slate-200 pt-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`${isScreen ? "text-2xl" : "text-base"} font-semibold text-slate-950`}>
            Response time
          </h3>
          <p className={`${isScreen ? "text-base" : "text-sm"} mt-1 text-slate-500`}>
            Since prompt update
          </p>
        </div>
        <p className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
          {points.length} response{points.length === 1 ? "" : "s"}
        </p>
      </div>

      {points.length ? (
        <div className="mt-4">
          <div
            className={`relative rounded-md border border-slate-200 bg-slate-50 ${
              isScreen ? "h-40" : "h-28"
            }`}
          >
            <span className="absolute inset-x-4 bottom-1 h-px bg-slate-300" />
            {points.map((point, index) => {
              const x = 2 + Math.min(100, (point.elapsedSeconds / maxSeconds) * 100) * 0.96;
              const y = jitterFromId(point.id);

              return (
                <span
                  className={`absolute rounded-full border-2 border-white shadow-sm ${
                    isScreen ? "size-4" : "size-3"
                  }`}
                  key={point.id}
                  style={{
                    backgroundColor: chartColors[index % chartColors.length],
                    left: `calc(${x}% - ${isScreen ? "8px" : "6px"})`,
                    top: `${y}%`,
                  }}
                  title={formatElapsed(point.elapsedSeconds)}
                />
              );
            })}
          </div>
          <div className={`${isScreen ? "text-base" : "text-xs"} mt-2 flex justify-between text-slate-500`}>
            <span>0s</span>
            <span>{formatElapsed(maxSeconds)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
          No responses after the current prompt update.
        </p>
      )}
    </section>
  );
}
