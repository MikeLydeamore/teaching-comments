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
      <div className="mx-auto max-w-4xl">
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Ed.ie hosts
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Your spaces
          </h1>
        </header>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Spaces</h2>
          {spaces.length ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {spaces.map((space) => {
                const spaceStats = stats.get(space.code);

                return (
                  <li
                    className="group relative rounded-md border border-slate-200 bg-white transition hover:border-teal-400 hover:shadow-sm"
                    key={space.code}
                  >
                    <Link
                      className="block p-4 after:absolute after:inset-0 after:content-['']"
                      href={`/host/${space.code}`}
                    >
                      <div className="flex items-start justify-between gap-3 pr-8">
                        <h3 className="font-semibold text-slate-950">
                          {space.name}
                        </h3>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                            space.role === "owner"
                              ? "bg-teal-50 text-teal-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {space.role}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {space.code}
                      </p>
                      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
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
                        <span>{relativeTime(spaceStats?.lastActiveAt ?? null)}</span>
                      </p>
                      <p className="mt-3 text-sm font-semibold text-slate-500 transition group-hover:text-teal-700">
                        Enter space →
                      </p>
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
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              You do not have access to any spaces yet. Spaces are created by
              the Ed.ie admin — ask them to create one for you, or to share an
              existing space with your email.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
