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
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link className="hover:text-teal-800" href="/host">
            Your spaces
          </Link>
          <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
          <Link className="hover:text-teal-800" href={`/host/${space.code}`}>
            {space.name}
          </Link>
          <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-slate-700">Manage access</span>
        </nav>
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                {space.name}
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
                Manage access
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Members sign in with Google or GitHub using the exact email below.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>
        </header>

        {!isOwner ? (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-1.5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12V16.5Z" />
            </svg>
            <div>
              <p className="font-semibold">View-only access</p>
              <p className="mt-0.5 leading-6">Only space owners can invite, remove, or change members.</p>
            </div>
          </div>
        ) : (
          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-200">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 11.25-6.5M18 14.25v6m3-3h-6" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Invite a co-host</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Grant access by email and choose what they can manage.</p>
              </div>
            </div>
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

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Members</h2>
              <p className="mt-1 text-sm text-slate-500">People with access to this space.</p>
            </div>
          </div>
          {members.length ? (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {members.map((member) => {
                const profile = profiles.get(member.email.toLowerCase());
                const displayName = profile?.name ?? member.email;

                return (
                  <li className="flex flex-wrap items-center justify-between gap-4 py-4" key={member.email}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-sm font-bold text-teal-800 ring-1 ring-teal-200">
                        {profile?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            src={profile.image}
                          />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {displayName}
                          {member.email === teacher.email ? (
                            <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
                              you
                            </span>
                          ) : null}
                          {!profile ? (
                            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                              invite pending
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                          {profile ? (
                            <span className="truncate">{member.email}</span>
                          ) : null}
                          {profile ? <span aria-hidden>·</span> : null}
                          <span className="shrink-0 font-semibold capitalize text-slate-600">
                            {member.role}
                          </span>
                        </div>
                      </div>
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
                );
              })}
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
