import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Ed.ie
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Ask, answer, understand
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Ed.ie is a friendly helper for quick questions, short
            responses, drawings, polls, and live check-ins. It helps participants
            speak up and helps hosts see what is making sense.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-500 hover:shadow-md"
            href="/join"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Participant view
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              Join an Ed.ie session
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter the space and session code from your host to respond,
              draw, ask a question, or vote on questions from the room.
            </p>
          </Link>

          <Link
            className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-500 hover:shadow-md"
            href="/host"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Host view
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              Manage your hosted space
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose a session, update the prompt, show a QR code, and watch
              responses and questions arrive live.
            </p>
          </Link>
        </section>

        <div className="mt-5">
          <Link
            className="text-sm font-semibold text-teal-700 underline"
            href="/privacy"
          >
            Privacy notice
          </Link>
        </div>
      </div>
    </main>
  );
}
