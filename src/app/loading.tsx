export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <div
        aria-live="polite"
        className="inline-flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
      >
        <span
          aria-hidden="true"
          className="size-4 rounded-full border-2 border-teal-700 border-r-transparent animate-spin"
        />
        Loading Ed.ie...
      </div>
    </main>
  );
}
