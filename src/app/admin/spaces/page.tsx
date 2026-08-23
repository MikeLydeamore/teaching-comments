import Link from "next/link";
import { redirect } from "next/navigation";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { AccountMenu } from "@/components/AccountMenu";
import { getCurrentTeacher, isAdminAuthenticated, isAdminTeacher } from "@/lib/auth-server";
import { listSpaceMembers, listTeacherSpaces } from "@/lib/edie-store";
import { loginRedirectPath } from "@/lib/teacher-session-auth";
import {
  claimTeacherSpace,
  createTeachingSpace,
  transferSpaceOwnership,
} from "./actions";

type AdminSpacesPageProps = {
  searchParams: Promise<{
    space?: string;
    spaceCreate?: string;
    claim?: string;
    transfer?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const createMessages: Record<string, string> = {
  created: "Space created.",
  exists: "That space code already exists.",
  invalid: "Check the space name and code.",
  missing: "Enter a space code.",
  forbidden: "Only allow-listed admins can manage spaces here.",
};

const claimMessages: Record<string, string> = {
  ok: "You are now the owner of that space.",
  claimed: "That space already has an owner. Use transfer instead.",
  forbidden: "Only allow-listed admins can claim spaces.",
  "not-found": "That space could not be found.",
};

const transferMessages: Record<string, string> = {
  ok: "Ownership transferred. Previous owners are now editors.",
  invalid: "Enter a valid email address to transfer to.",
  forbidden: "Only allow-listed admins can transfer spaces.",
  "not-found": "That space could not be found.",
};

export default async function AdminSpacesPage({ searchParams }: AdminSpacesPageProps) {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect(loginRedirectPath("/admin/spaces"));
  }

  const query = await searchParams;
  const isAdmin = isAdminTeacher(teacher) && (await isAdminAuthenticated());
  const spaces = isAdmin ? await listTeacherSpaces() : [];
  const ownersBySpace = new Map<string, string[]>();
  const memberCounts = new Map<string, number>();
  const ownerless = new Set<string>();

  if (isAdmin) {
    for (const space of spaces) {
      const members = await listSpaceMembers(space.code);
      memberCounts.set(space.code, members.length);
      const ownerEmails = members
        .filter((member) => member.role === "owner")
        .map((member) => member.email);
      ownersBySpace.set(space.code, ownerEmails);

      if (!ownerEmails.length) {
        ownerless.add(space.code);
      }
    }
  }

  const createMessage = query.spaceCreate
    ? createMessages[query.spaceCreate] ?? ""
    : "";
  const createSucceeded = query.spaceCreate === "created";
  const claimMessage = query.claim ? claimMessages[query.claim] ?? "" : "";
  const claimSucceeded = query.claim === "ok";
  const transferMessage = query.transfer
    ? transferMessages[query.transfer] ?? ""
    : "";
  const transferSucceeded = query.transfer === "ok";

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <AccountMenu user={teacher} />
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <span className="text-slate-700">Admin</span>
        </nav>
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                Ed.ie admin
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
                Manage spaces
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Create hosted spaces, assign owners, and review access from one place.
              </p>
            </div>
            {isAdmin ? (
              <span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-teal-200">
                {spaces.length} {spaces.length === 1 ? "space" : "spaces"}
              </span>
            ) : null}
          </div>
        </header>

        {!isAdmin ? (
          <section className="mt-5 flex items-start gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0 1 19.5 12.75v6A2.25 2.25 0 0 1 17.25 21H6.75a2.25 2.25 0 0 1-2.25-2.25v-6a2.25 2.25 0 0 1 2.25-2.25Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-amber-950">Admin access required</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                You are signed in as <strong>{teacher.email}</strong>, which is not on
                the admin allow-list. Ask the operator to add this email to
                <code className="mx-1 rounded bg-amber-100 px-1">ADMIN_EMAILS</code>.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-200">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M5.25 21V5.25A2.25 2.25 0 0 1 7.5 3h9a2.25 2.25 0 0 1 2.25 2.25V21M9 7.5h6M9 11.25h6M12 15v3m1.5-1.5h-3" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Create a space</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Set up a new hosted space and optionally assign its first owner.</p>
                </div>
              </div>
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
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="ownerEmail">
                    Owner email (optional)
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    The person this space belongs to. They get access as soon as
                    they sign in with this email. Leave blank to own it yourself.
                  </p>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                    id="ownerEmail"
                    name="ownerEmail"
                    placeholder="teacher@school.edu"
                    type="email"
                  />
                </div>
                <div className="md:col-span-2">
                  <PendingSubmitButton
                    className="h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                    pendingChildren="Creating..."
                  >
                    Create space
                  </PendingSubmitButton>
                </div>
              </form>
              {createMessage ? (
                <p
                  className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                    createSucceeded
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {createMessage}
                </p>
              ) : null}
            </section>

            <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Current spaces</h2>
                  <p className="mt-1 text-sm text-slate-500">Ownership and membership across Ed.ie.</p>
                </div>
              </div>
              {spaces.length ? (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-3 pl-4 pr-4 font-semibold">Name</th>
                        <th className="py-2 pr-4 font-semibold">Code</th>
                        <th className="py-2 pr-4 font-semibold">Created</th>
                        <th className="py-2 pr-4 font-semibold">Members</th>
                        <th className="py-2 pr-4 font-semibold">Owner</th>
                        <th className="py-2 pr-4 font-semibold">Host link</th>
                        <th className="py-2 font-semibold">Transfer / claim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spaces.map((space) => {
                        const owners = ownersBySpace.get(space.code) ?? [];

                        return (
                          <tr className="border-b border-slate-100 align-top transition hover:bg-slate-50 last:border-0" key={space.code}>
                            <td className="py-4 pl-4 pr-4 font-semibold text-slate-950">
                              {space.name}
                            </td>
                            <td className="py-4 pr-4 font-mono text-slate-700">
                              <span className="rounded bg-slate-100 px-2 py-1 text-xs">{space.code}</span>
                            </td>
                            <td className="py-4 pr-4 text-slate-600">
                              {dateFormatter.format(new Date(space.createdAt))}
                            </td>
                            <td className="py-4 pr-4 text-slate-600">
                              {memberCounts.get(space.code) ?? 0}
                            </td>
                            <td className="py-4 pr-4 text-xs text-slate-600">
                              {owners.length ? (
                                owners.map((email) => (
                                  <span className="block break-all" key={email}>
                                    {email}
                                  </span>
                                ))
                              ) : (
                                <span className="font-semibold text-amber-700">
                                  Unowned
                                </span>
                              )}
                            </td>
                            <td className="py-4 pr-4">
                              <Link
                                className="font-semibold text-teal-700 hover:text-teal-900"
                                href={`/host/${space.code}`}
                              >
                                Open
                              </Link>
                            </td>
                            <td className="py-4 pr-4">
                              {ownerless.has(space.code) ? (
                                <form action={claimTeacherSpace}>
                                  <input name="spaceCode" type="hidden" value={space.code} />
                                  <PendingSubmitButton
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                                    pendingChildren="Claiming..."
                                  >
                                    Claim as owner
                                  </PendingSubmitButton>
                                </form>
                              ) : (
                                <form action={transferSpaceOwnership} className="flex flex-wrap items-center gap-2">
                                  <input name="spaceCode" type="hidden" value={space.code} />
                                  <label className="sr-only" htmlFor={`transfer-${space.code}`}>
                                    New owner for {space.name}
                                  </label>
                                  <input
                                    className="h-8 w-44 rounded-md border border-slate-300 px-2 text-xs text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                    id={`transfer-${space.code}`}
                                    name="ownerEmail"
                                    placeholder="new-owner@email"
                                    type="email"
                                  />
                                  <PendingSubmitButton
                                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                                    pendingChildren="Transferring..."
                                  >
                                    Transfer
                                  </PendingSubmitButton>
                                </form>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                    Transferring makes the new email the single owner; previous
                    owners keep access as editors.
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  No spaces have been created yet.
                </p>
              )}
              {claimMessage ? (
                <p
                  className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                    claimSucceeded
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {claimMessage}
                </p>
              ) : null}
              {transferMessage ? (
                <p
                  className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                    transferSucceeded
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {transferMessage}
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
