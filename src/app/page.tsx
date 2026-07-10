import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Quick Write Tool
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Real-time formative writing feedback
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            A first prototype for collecting anonymous student writing during a
            lecture and giving teachers a live, sortable view of the room.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-500 hover:shadow-md"
            href="/join"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Student view
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              Join with a code
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Opens a student join page where a teaching space and session code
              unlock the writing box.
            </p>
          </Link>

          <Link
            className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-500 hover:shadow-md"
            href="/teacher"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Teacher view
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              Select a session
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Unlock a teaching space, choose a session, and watch responses
              live.
            </p>
          </Link>
        </section>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Prototype notes</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This first slice uses local file storage so we can test the classroom
            workflow with no paid services. The storage layer is isolated so
            Supabase can replace it when we are ready to host a shared pilot.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
              href="/teacher"
            >
              Open teacher space
            </Link>
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
              href="/privacy"
            >
              Privacy notice
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
