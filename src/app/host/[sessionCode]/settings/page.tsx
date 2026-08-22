import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { getCurrentTeacher, getSpaceRoleForUser } from "@/lib/auth-server";
import { findUserProfilesByEmail } from "@/lib/auth-users";
import { getTeacherSpace, listSpaceMembers } from "@/lib/edie-store";
import { normalizeSpaceEmail } from "@/lib/edie-store-model";
import { loginRedirectPath } from "@/lib/teacher-session-auth";
import {
  changeSpaceMemberRole,
  evictSpaceMember,
  inviteSpaceMember,
} from "./actions";

const memberMessages: Record<string, string> = {
  added: "Member invited. They get access as soon as they sign in with that email.",
  removed: "Member removed.",
  exists: "That person is already a member of this space.",
  invalid: "Enter a valid email address.",
};

export default async function SpaceSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ member?: string; email?: string }>;
}) {
  const { sessionCode: spaceCodeParam } = await params;
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect(loginRedirectPath(`/host/${spaceCodeParam}/settings`));
  }

  const space = await getTeacherSpace(spaceCodeParam);
  const role = space ? await getSpaceRoleForUser(space.code) : null;

  if (!space || !role) {
    redirect("/host");
  }

  const query = await searchParams;
  const members = await listSpaceMembers(space.code);
  const profiles = await findUserProfilesByEmail(members.map((member) => member.email));
  const isOwner = role === "owner";
  const message = query.member ? memberMessages[query.member] ?? "" : "";
  const succeeded = query.member === "added" || query.member === "removed";

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <AccountMenu user={teacher}>
        <div className="border-t border-slate-100 px-2 py-3">
          <Link
            className="block rounded-md px-2 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            href={`/host/${space.code}`}
          >
            Back to {space.name}
          </Link>
        </div>
      </AccountMenu>
      <div className="mx-auto max-w-4xl">
        <nav className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Link className="hover:text-teal-800" href="/host">
            Your spaces
          </Link>
          <span aria-hidden>/</span>
          <Link className="hover:text-teal-800" href={`/host/${space.code}`}>
            {space.name}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-slate-700">Manage access</span>
        </nav>
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            {space.name}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Manage access
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Members sign in with Google or GitHub using the exact email below.
          </p>
        </header>

        {!isOwner ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            Only space owners can manage members.
          </p>
        ) : (
          <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Invite a co-host</h2>
            <form action={inviteSpaceMember} className="mt-4 grid gap-4 md:grid-cols-[1fr_160px_auto]">
              <input name="spaceCode" type="hidden" value={space.code} />
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="member-email">
                  Email
                </label>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  defaultValue={query.email ? normalizeSpaceEmail(query.email) : ""}
                  id="member-email"
                  name="email"
                  placeholder="colleague@school.edu"
                  type="email"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="member-role">
                  Role
                </label>
                <select
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  defaultValue="editor"
                  id="member-role"
                  name="role"
                >
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="flex items-end">
                <PendingSubmitButton
                  className="h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                  pendingChildren="Inviting..."
                >
                  Add member
                </PendingSubmitButton>
              </div>
            </form>
            {message ? (
              <p
                className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                  succeeded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {message}
              </p>
            ) : null}
          </section>
        )}

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Members</h2>
          {members.length ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {members.map((member) => (
                <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={member.email}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {profiles.get(member.email.toLowerCase())?.name ?? member.email}
                      {member.email === teacher.email ? (
                        <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-xs font-semibold text-teal-800">
                          you
                        </span>
                      ) : null}
                      {!profiles.has(member.email.toLowerCase()) ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                          invite pending
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {profiles.get(member.email.toLowerCase()) ? `${member.email} · ` : ""}
                      {member.role}
                    </p>
                  </div>
                  {isOwner && member.email !== teacher.email ? (
                    <div className="flex items-center gap-2">
                      <form action={changeSpaceMemberRole}>
                        <input name="spaceCode" type="hidden" value={space.code} />
                        <input name="email" type="hidden" value={member.email} />
                        <input
                          name="role"
                          type="hidden"
                          value={member.role === "owner" ? "editor" : "owner"}
                        />
                        <PendingSubmitButton
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                          pendingChildren="Saving..."
                        >
                          Make {member.role === "owner" ? "editor" : "owner"}
                        </PendingSubmitButton>
                      </form>
                      <form action={evictSpaceMember}>
                        <input name="spaceCode" type="hidden" value={space.code} />
                        <input name="email" type="hidden" value={member.email} />
                        <PendingSubmitButton
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-400"
                          pendingChildren="Removing..."
                        >
                          Remove
                        </PendingSubmitButton>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              This space has no members yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
