import Link from "next/link";
import { InlineCodeText } from "@/components/InlineCodeText";
import { PendingLink } from "@/components/PendingLink";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { enterTeacherSession } from "./actions";
import type { Session, TeacherSpace } from "@/lib/edie-store";

type TeacherSpaceDashboardProps = {
  initialSessionCode: string;
  sessions: Session[];
  space: TeacherSpace;
};

export function TeacherSpaceDashboard({
  initialSessionCode,
  sessions,
  space,
}: TeacherSpaceDashboardProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link className="hover:text-teal-800" href="/host">
            Your spaces
          </Link>
          <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-slate-700">{space.name}</span>
        </nav>
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                Hosted Space
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
                {space.name}
              </h1>
              <p className="mt-2 text-sm text-slate-500">{space.code}</p>
            </div>
            <div>
              <Link
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                href={`/host/${space.code}/settings`}
              >
                Manage access
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Open a session</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter a session code to open its live dashboard. If the code does
            not exist yet, Ed.ie will create it in this space.
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
                placeholder="enter-or-create-code"
              />
            </div>
            <div className="flex items-end">
              <PendingSubmitButton
                className="h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 md:w-auto"
                pendingChildren="Opening session..."
              >
                Open session
              </PendingSubmitButton>
            </div>
          </form>
        </section>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Existing sessions</h2>
            <Link
              className="text-sm font-semibold text-teal-700 underline"
              href="/host"
            >
              Switch space
            </Link>
          </div>
          {sessions.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sessions.map((session) => (
                <PendingLink
                  className="rounded-md border border-slate-200 p-4 transition hover:border-teal-500 hover:bg-teal-50"
                  href={`/host/${space.code}/${session.code}`}
                  key={session.code}
                  pendingStatusText="Opening session..."
                  statusClassName="mt-3 block text-sm font-semibold text-teal-700"
                  statusText="Open session"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">
                      {session.title}
                    </p>
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                        session.isOpen
                          ? "bg-teal-100 text-teal-900"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {session.isOpen ? "Session open" : "Session closed"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{session.code}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    <InlineCodeText>{session.prompt}</InlineCodeText>
                  </p>
                </PendingLink>
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
