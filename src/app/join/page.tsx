import Link from "next/link";
import { joinSession } from "./actions";

const messages = {
  closed: "That Ed.ie session is closed.",
  missing: "Enter the session code from your teacher.",
  "space-missing": "Enter the teaching space code from your teacher.",
  "name-too-long": "Names must be 80 characters or fewer.",
  "not-found": "We could not find that Ed.ie session.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; session?: string; space?: string }>;
}) {
  const query = await searchParams;
  const error = query.error && query.error in messages
    ? messages[query.error as keyof typeof messages]
    : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Ed.ie
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          Join a session
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter the space code and session code your teacher shared. Session
          lists are not public, which keeps class activities harder to spam.
        </p>

        <form action={joinSession} className="mt-5">
          <label className="text-sm font-semibold text-slate-700" htmlFor="spaceCode">
            Space code
          </label>
          <input
            autoFocus
            className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            defaultValue={query.space ?? ""}
            id="spaceCode"
            name="spaceCode"
            placeholder="stats-101"
          />
          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="sessionCode">
            Session code
          </label>
          <input
            className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            defaultValue={query.session ?? ""}
            id="sessionCode"
            name="sessionCode"
            placeholder="week-1"
          />
          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="studentName">
            Name
          </label>
          <input
            autoComplete="name"
            className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            id="studentName"
            maxLength={80}
            name="studentName"
            placeholder="Anonymous"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Optional. Leave blank to submit as Anonymous.
          </p>
          <button
            className="mt-4 h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
            type="submit"
          >
            Join session
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        ) : null}

        <div className="mt-5 border-t border-slate-200 pt-4">
          <Link className="text-sm font-semibold text-teal-700 underline" href="/privacy">
            Read the privacy notice
          </Link>
        </div>
      </section>
    </main>
  );
}
