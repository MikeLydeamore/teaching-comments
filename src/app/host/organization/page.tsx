import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { getCurrentTeacher } from "@/lib/auth-server";
import { findUserProfilesById } from "@/lib/auth-users";
import { entitlementsForOrganization } from "@/lib/entitlements";
import {
  getOrganizationMemberRole,
  getPersonalOrganization,
  listOrganizationMembers,
  listSpaceInvitations,
  listSpaceMembers,
  listTeacherSpacesForOrganization,
} from "@/lib/edie-store";
import { loginRedirectPath } from "@/lib/teacher-session-auth";
import { removeOrganizationSeat } from "./actions";

export const dynamic = "force-dynamic";

const memberMessages: Record<string, string> = {
  removed: "The member was removed from the organisation and their seat is now available.",
  protected: "Organisation owners and sole space owners cannot be removed. Assign another space owner first.",
  unavailable: "The member could not be removed. Please try again.",
};

function limitLabel(limit: number | null) {
  return limit === null ? "Unlimited" : String(limit);
}

function usageLabel(used: number, limit: number | null, singular: string) {
  const noun = used === 1 ? singular : `${singular}s`;
  return limit === null ? `${used} ${noun} · unlimited` : `${used} of ${limit} ${noun}`;
}

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect(loginRedirectPath("/host/organization"));

  const organization = await getPersonalOrganization(teacher.id);
  if (!organization) redirect("/host");

  const viewerRole = await getOrganizationMemberRole(organization.id, teacher.id);
  if (viewerRole !== "owner") redirect("/host");

  const [members, spaces, entitlements, query] = await Promise.all([
    listOrganizationMembers(organization.id),
    listTeacherSpacesForOrganization(organization.id),
    entitlementsForOrganization(organization.id),
    searchParams,
  ]);
  const [spaceMemberships, spaceInvitations, profileResult] = await Promise.all([
    Promise.all(spaces.map((space) => listSpaceMembers(space.code))),
    Promise.all(spaces.map((space) => listSpaceInvitations(space.code))),
    findUserProfilesById(members.map((member) => member.userId)),
  ]);
  const assignments = new Map<string, typeof spaces>();
  for (const [index, space] of spaces.entries()) {
    for (const member of spaceMemberships[index]) {
      const current = assignments.get(member.userId) ?? [];
      current.push(space);
      assignments.set(member.userId, current);
    }
  }
  const pendingInvitations = spaceInvitations.reduce(
    (total, invitations) => total + invitations.length,
    0,
  );
  const planLabel = entitlements.plan === "community"
    ? "Community"
    : entitlements.plan === "pro"
      ? "Pro"
      : "Free";
  const message = query.member ? memberMessages[query.member] ?? "" : "";
  const succeeded = query.member === "removed";

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <AccountMenu user={teacher} />
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 pr-14 text-sm font-semibold text-slate-500 sm:pr-0">
          <Link className="hover:text-teal-800" href="/host">Your spaces</Link>
          <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-slate-700">Organisation</span>
        </nav>

        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Organisation settings</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{organization.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Review your plan, capacity, members, and their hosted-space access.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${
              entitlements.plan === "free"
                ? "bg-amber-50 text-amber-900 ring-amber-200"
                : "bg-teal-50 text-teal-800 ring-teal-200"
            }`}>
              {planLabel}
            </span>
          </div>
        </header>

        {message ? (
          <p className={`mt-4 rounded-md border px-4 py-3 text-sm font-medium ${
            succeeded
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`} role="status">
            {message}
          </p>
        ) : null}

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">Hosted spaces</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {spaces.length}
              <span className="ml-2 text-base font-medium text-slate-500">/ {limitLabel(entitlements.limits.ownedSpaces)}</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {usageLabel(spaces.length, entitlements.limits.ownedSpaces, "space")}
            </p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">Teacher seats</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {members.length}
              <span className="ml-2 text-base font-medium text-slate-500">/ {limitLabel(entitlements.limits.teacherSeats)}</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {usageLabel(members.length, entitlements.limits.teacherSeats, "seat")}
              {pendingInvitations ? ` · ${pendingInvitations} pending invitations do not use seats` : ""}
            </p>
          </article>
        </section>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Organisation members</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Removing a member revokes access to every space in this organisation and releases their seat.
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-500">{members.length} active</span>
          </div>

          {!profileResult.ok ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900" role="alert">
              Member profiles are temporarily unavailable. Access assignments are still shown safely.
            </p>
          ) : null}

          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {members.map((member) => {
              const profile = profileResult.profiles.get(member.userId);
              const displayName = profile?.name?.trim() || profile?.displayUsername || "Ed.ie member";
              const memberSpaces = assignments.get(member.userId) ?? [];
              const isSelf = member.userId === teacher.id;

              return (
                <li className="flex flex-wrap items-center justify-between gap-4 py-4" key={member.userId}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-sm font-bold text-teal-800 ring-1 ring-teal-200">
                      {profile?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="h-full w-full object-cover" src={profile.image} />
                      ) : displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-slate-950">
                          {displayName}
                        </p>
                        {isSelf ? <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">you</span> : null}
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600 ring-1 ring-slate-200">{member.role}</span>
                      </div>
                      {profile?.displayUsername ? <p className="mt-1 text-xs text-slate-500">@{profile.displayUsername}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {memberSpaces.length ? memberSpaces.map((space) => (
                          <Link className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:text-teal-800" href={`/host/${space.code}`} key={space.code}>
                            {space.name}
                          </Link>
                        )) : <span className="text-xs text-slate-500">No space assignments</span>}
                      </div>
                    </div>
                  </div>
                  {member.role !== "owner" ? (
                    <form action={removeOrganizationSeat}>
                      <input name="accountId" type="hidden" value={member.userId} />
                      <PendingSubmitButton
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-400"
                        pendingChildren="Removing..."
                      >
                        Remove from organisation
                      </PendingSubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
