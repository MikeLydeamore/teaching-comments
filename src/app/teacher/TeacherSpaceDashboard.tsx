import Link from "next/link";
import { enterTeacherSession, logoutTeacher } from "./actions";
import type { Session, TeacherSpace } from "@/lib/qwt-store";

type TeacherSpaceDashboardProps = {
  authFailed: boolean;
  initialSessionCode: string;
  sessions: Session[];
  space: TeacherSpace;
};

export function TeacherSpaceDashboard({
  authFailed,
  initialSessionCode,
  sessions,
  space,
}: TeacherSpaceDashboardProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                Teaching space
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
                {space.name}
              </h1>
              <p className="mt-2 text-sm text-slate-500">{space.code}</p>
            </div>
            <form action={logoutTeacher}>
              <input name="next" type="hidden" value="/teacher" />
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
                type="submit"
              >
                Lock
              </button>
            </form>
          </div>
        </header>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Open a session</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter a session code to open its live dashboard. If the code does
            not exist yet, the prototype will create it in this space.
          </p>
          <form
            action={enterTeacherSession}
            className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]"
          >
            <input name="spaceCode" type="hidden" value={space.code} />
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="sessionCode">
                Session code
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                defaultValue={initialSessionCode}
                id="sessionCode"
                name="sessionCode"
                placeholder="week-1"
              />
            </div>
            <div className="flex items-end">
              <button
                className="h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 md:w-auto"
                type="submit"
              >
                Open dashboard
              </button>
            </div>
          </form>
          {authFailed ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              Unlock this space before opening a session.
            </p>
          ) : null}
        </section>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Existing sessions</h2>
            <Link
              className="text-sm font-semibold text-teal-700 underline"
              href="/teacher"
            >
              Switch space
            </Link>
          </div>
          {sessions.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sessions.map((session) => (
                <Link
                  className="rounded-md border border-slate-200 p-4 transition hover:border-teal-500 hover:bg-teal-50"
                  href={`/teacher/${space.code}/${session.code}`}
                  key={session.code}
                >
                  <p className="font-semibold text-slate-950">{session.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{session.code}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    {session.prompt}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No sessions in this space yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
