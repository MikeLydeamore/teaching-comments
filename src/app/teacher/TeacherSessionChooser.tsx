import Link from "next/link";
import { enterTeacherSession, logoutTeacher } from "./actions";
import type { Session } from "@/lib/qwt-store";

type TeacherSessionChooserProps = {
  isAuthenticated: boolean;
  sessions: Session[];
  authFailed: boolean;
  initialSessionCode: string;
  usesDefaultPin: boolean;
};

export function TeacherSessionChooser({
  isAuthenticated,
  sessions,
  authFailed,
  initialSessionCode,
  usesDefaultPin,
}: TeacherSessionChooserProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Teacher access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Select a quick write session
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Enter a session code to open its live dashboard. If the code does
            not exist yet, the prototype will create it when you open it.
          </p>
        </header>

        {usesDefaultPin ? (
          <aside className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Local prototype PIN is <strong>teach123</strong>. Set
            <code className="mx-1 rounded bg-amber-100 px-1">TEACHER_PIN</code>
            before deploying.
          </aside>
        ) : null}

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <form action={enterTeacherSession} className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="sessionCode">
                Session code
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                defaultValue={initialSessionCode}
                id="sessionCode"
                name="sessionCode"
                placeholder="demo-lecture"
              />
            </div>
            {!isAuthenticated ? (
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="pin">
                  Teacher PIN
                </label>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  id="pin"
                  name="pin"
                  type="password"
                />
              </div>
            ) : (
              <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
                <p className="font-semibold">PIN unlocked</p>
                <p>Teacher dashboard access is active.</p>
              </div>
            )}
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
              That PIN did not work.
            </p>
          ) : null}
        </section>

        {isAuthenticated ? (
          <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Existing sessions</h2>
              <form action={logoutTeacher}>
                <input name="next" type="hidden" value="/teacher" />
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
                  type="submit"
                >
                  Lock teacher view
                </button>
              </form>
            </div>
            {sessions.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {sessions.map((session) => (
                  <Link
                    className="rounded-md border border-slate-200 p-4 transition hover:border-teal-500 hover:bg-teal-50"
                    href={`/teacher/${session.code}`}
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
              <p className="mt-3 text-sm text-slate-500">No sessions yet.</p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
