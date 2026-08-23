import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { SpaceCardMenu } from "@/components/SpaceCardMenu";
import { getCurrentTeacher } from "@/lib/auth-server";
import {
  listSessions,
  listTeacherSpacesForUser,
} from "@/lib/edie-store";
import { loginRedirectPath } from "@/lib/teacher-session-auth";

type SpaceStats = {
  openSessions: number;
  totalSessions: number;
  lastActiveAt: string | null;
};

function relativeTime(iso: string | null): string {
  if (!iso) {
    return "no activity yet";
  }

  const elapsedSeconds = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 1000,
  );

  if (elapsedSeconds < 90) {
    return "active just now";
  }

  const minutes = Math.round(elapsedSeconds / 60);

  if (minutes < 60) {
    return `last active ${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `last active ${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return days === 1 ? "last active yesterday" : `last active ${days}d ago`;
}

export default async function TeacherHomePage() {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect(loginRedirectPath("/host"));
  }

  const spaces = await listTeacherSpacesForUser(teacher.email);
  const stats = new Map<string, SpaceStats>();

  for (const space of spaces) {
    const sessions = await listSessions(space.code);
    const lastActiveAt = sessions
      .map((session) => session.promptUpdatedAt || session.createdAt)
      .sort()
      .at(-1) ?? null;

    stats.set(space.code, {
      openSessions: sessions.filter((session) => session.isOpen).length,
      totalSessions: sessions.length,
      lastActiveAt,
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <AccountMenu user={teacher} />
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <span className="text-slate-700">Your spaces</span>
        </nav>
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                Ed.ie hosts
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
                Your spaces
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Choose a hosted space to run sessions and see live responses.
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-teal-200">
              {spaces.length} {spaces.length === 1 ? "space" : "spaces"}
            </span>
          </div>
        </header>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Hosted spaces</h2>
              <p className="mt-0.5 text-sm text-slate-500">Spaces shared with your account.</p>
            </div>
          </div>
          {spaces.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {spaces.map((space) => {
                const spaceStats = stats.get(space.code);

                return (
                  <li
                    className="group relative overflow-visible rounded-md border border-slate-200 bg-white transition hover:border-teal-400 hover:shadow-sm"
                    key={space.code}
                  >
                    <Link
                      className="block p-5 after:absolute after:inset-0 after:content-['']"
                      href={`/host/${space.code}`}
                    >
                      <div className="flex items-start justify-between gap-3 pr-8">
                        <h3 className="font-semibold text-slate-950">
                          {space.name}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] ring-1 ${
                            space.role === "owner"
                              ? "bg-teal-50 text-teal-800 ring-teal-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {space.role}
                        </span>
                      </div>
                      <p className="mt-2 inline-flex rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                        {space.code}
                      </p>
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
                          <span>
                            {(spaceStats?.openSessions ?? 0) > 0 ? (
                              <>
                                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                {spaceStats?.openSessions} open{" "}
                                {spaceStats?.openSessions === 1
                                  ? "session"
                                  : "sessions"}
                              </>
                            ) : (
                              `${spaceStats?.totalSessions ?? 0} ${
                                spaceStats?.totalSessions === 1
                                  ? "session"
                                  : "sessions"
                              }`
                            )}
                          </span>
                          <span aria-hidden>·</span>
                          <span>
                            {relativeTime(spaceStats?.lastActiveAt ?? null)}
                          </span>
                        </p>
                        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                          Enter space
                          <svg aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                          </svg>
                        </p>
                      </div>
                    </Link>
                    <SpaceCardMenu
                      spaceCode={space.code}
                      spaceName={space.name}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M5.25 21V5.25A2.25 2.25 0 0 1 7.5 3h9a2.25 2.25 0 0 1 2.25 2.25V21M9 7.5h.008v.008H9V7.5Zm0 3.75h.008v.008H9v-.008Zm0 3.75h.008v.008H9V15Zm3-7.5h.008v.008H12V7.5Zm0 3.75h.008v.008H12v-.008Zm0 3.75h.008v.008H12V15Zm3-7.5h.008v.008H15V7.5Zm0 3.75h.008v.008H15v-.008Zm0 3.75h.008v.008H15V15Z" />
                </svg>
              </div>
              <h3 className="mt-4 font-semibold text-slate-950">No spaces yet</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                Ask an Ed.ie admin to create a space for you, or ask a space
                owner to share an existing one with your email.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
