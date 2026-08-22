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
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Ed.ie admin
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Manage spaces
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Admin access is granted by email allow-list
            (<code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code>).
            Spaces cost money, so only admins create them here.
          </p>
        </header>

        {!isAdmin ? (
          <section className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-950">Not an admin</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              You are signed in as <strong>{teacher.email}</strong>, which is not on
              the admin allow-list. Ask the operator to add this email to
              <code className="mx-1 rounded bg-amber-100 px-1">ADMIN_EMAILS</code>.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">New space</h2>
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

            <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Current spaces</h2>
              {spaces.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-4 font-semibold">Name</th>
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
                          <tr className="border-b border-slate-100 align-top last:border-0" key={space.code}>
                            <td className="py-3 pr-4 font-semibold text-slate-950">
                              {space.name}
                            </td>
                            <td className="py-3 pr-4 font-mono text-slate-700">
                              {space.code}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {dateFormatter.format(new Date(space.createdAt))}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {memberCounts.get(space.code) ?? 0}
                            </td>
                            <td className="py-3 pr-4 text-xs text-slate-600">
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
                            <td className="py-3 pr-4">
                              <Link
                                className="font-semibold text-teal-700 hover:text-teal-900"
                                href={`/host/${space.code}`}
                              >
                                Open
                              </Link>
                            </td>
                            <td className="py-3">
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
                  <p className="mt-3 text-xs text-slate-500">
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
