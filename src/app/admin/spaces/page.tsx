import Link from "next/link";
import { listTeacherSpaces } from "@/lib/qwt-store";
import { isAdminAuthenticated, isDefaultAdminPin } from "@/lib/teacher-auth";
import { createTeachingSpace } from "@/app/teacher/actions";
import { resetTeacherSpacePin, unlockAdminSpaces } from "./actions";

type AdminSpacesPageProps = {
  searchParams: Promise<{
    space?: string;
    pinReset?: string;
    spaceCreate?: string;
    spacesAuth?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminSpacesPage({
  searchParams,
}: AdminSpacesPageProps) {
  const query = await searchParams;
  const canViewSpaces = await isAdminAuthenticated();
  const spaces = canViewSpaces ? await listTeacherSpaces() : [];
  const createMessage =
    {
      "admin-failed": "That admin PIN did not work.",
      created: query.space
        ? `Space "${query.space}" was created. Email the teacher this space code and the space PIN you chose.`
        : "Space created. Email the teacher the space code and the space PIN you chose.",
      exists: "That space code already exists.",
      invalid: "Check the space name, code, and PIN.",
      missing: "Enter a space code.",
    }[query.spaceCreate ?? ""] ?? "";
  const isSuccess = query.spaceCreate === "created";
  const spacesAuthFailed = query.spacesAuth === "failed";
  const pinResetMessage =
    {
      invalid: "Use a new space PIN between 4 and 120 characters.",
      missing: "Choose a space before resetting a PIN.",
      "not-found": "We could not find that teaching space.",
      updated: query.space
        ? `PIN reset for "${query.space}". Send the new PIN to that teacher.`
        : "PIN reset. Send the new PIN to that teacher.",
    }[query.pinReset ?? ""] ?? "";
  const pinResetSucceeded = query.pinReset === "updated";

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Admin setup
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Create a teaching space
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Use this page to create a space for a subject, teacher, or cohort.
            Teachers use the space code and space PIN on the regular teacher
            page.
          </p>
        </header>

        {isDefaultAdminPin() ? (
          <aside className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Local prototype admin PIN is <strong>teach123</strong>. Set
            <code className="mx-1 rounded bg-amber-100 px-1">ADMIN_PIN</code>
            before deploying. If it is not set, the app falls back to
            <code className="mx-1 rounded bg-amber-100 px-1">TEACHER_PIN</code>.
          </aside>
        ) : null}

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">New space</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The space PIN is what the teacher will use day to day. The admin
            PIN is only for creating the space.
          </p>
          <form action={createTeachingSpace} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="new-space-code">
                Space code
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                defaultValue={query.space ?? ""}
                id="new-space-code"
                name="spaceCode"
                placeholder="stats-101"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="spaceName">
                Space name
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                id="spaceName"
                name="spaceName"
                placeholder="STAT101 Semester 2"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="spacePin">
                Space PIN
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                id="spacePin"
                name="spacePin"
                type="password"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="adminPin">
                Admin PIN
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                id="adminPin"
                name="adminPin"
                type="password"
              />
            </div>
            <div className="md:col-span-2">
              <button
                className="h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                type="submit"
              >
                Create space
              </button>
            </div>
          </form>
          {createMessage ? (
            <p
              className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                isSuccess
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {createMessage}
            </p>
          ) : null}
        </section>

        <p className="mt-4 text-sm text-slate-600">
          Teachers should use{" "}
          <Link className="font-semibold text-teal-700 hover:text-teal-900" href="/teacher">
            the teacher page
          </Link>{" "}
          once their space exists.
        </p>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Current spaces
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Space PINs are not shown. Share the code and the PIN you chose
                with the teacher for that space.
              </p>
            </div>
            {canViewSpaces ? (
              <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                {spaces.length} {spaces.length === 1 ? "space" : "spaces"}
              </span>
            ) : null}
          </div>

          {canViewSpaces ? (
            spaces.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 font-semibold">Name</th>
                      <th className="py-2 pr-4 font-semibold">Code</th>
                      <th className="py-2 pr-4 font-semibold">Created</th>
                      <th className="py-2 font-semibold">Teacher link</th>
                      <th className="py-2 pl-4 font-semibold">Reset PIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spaces.map((space) => (
                      <tr className="border-b border-slate-100 last:border-0" key={space.code}>
                        <td className="py-3 pr-4 font-semibold text-slate-950">
                          {space.name}
                        </td>
                        <td className="py-3 pr-4 font-mono text-slate-700">
                          {space.code}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {dateFormatter.format(new Date(space.createdAt))}
                        </td>
                        <td className="py-3">
                          <Link
                            className="font-semibold text-teal-700 hover:text-teal-900"
                            href={`/teacher/${space.code}`}
                          >
                            Open
                          </Link>
                        </td>
                        <td className="py-3 pl-4">
                          <form
                            action={resetTeacherSpacePin}
                            className="flex min-w-64 flex-wrap gap-2"
                          >
                            <input name="spaceCode" type="hidden" value={space.code} />
                            <label className="sr-only" htmlFor={`new-pin-${space.code}`}>
                              New PIN for {space.name}
                            </label>
                            <input
                              className="h-9 min-w-36 flex-1 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                              id={`new-pin-${space.code}`}
                              name="newPin"
                              placeholder="New PIN"
                              type="password"
                            />
                            <button
                              className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                              type="submit"
                            >
                              Reset
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No spaces have been created yet.
              </p>
            )
          ) : (
            <form action={unlockAdminSpaces} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="spacesAdminPin">
                  Admin PIN
                </label>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  id="spacesAdminPin"
                  name="adminPin"
                  type="password"
                />
              </div>
              <div className="flex items-end">
                <button
                  className="h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                  type="submit"
                >
                  Show spaces
                </button>
              </div>
              {spacesAuthFailed ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 sm:col-span-2">
                  That admin PIN did not work.
                </p>
              ) : null}
            </form>
          )}
          {pinResetMessage ? (
            <p
              className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                pinResetSucceeded
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {pinResetMessage}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
