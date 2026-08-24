import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { getCurrentTeacher } from "@/lib/auth-server";
import { listPendingSpaceInvitationsForUser } from "@/lib/edie-store";
import { loginRedirectPath } from "@/lib/teacher-session-auth";
import {
  acceptSpaceInvitation,
  declineSpaceInvitation,
} from "../actions";

export const dynamic = "force-dynamic";

const invitationMessages: Record<string, string> = {
  accepted: "Invitation accepted. The hosted space is now available in Your spaces.",
  declined: "Invitation declined.",
  unavailable: "That invitation is no longer available.",
};

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect(loginRedirectPath("/host/invitations"));
  }

  const [invitations, query] = await Promise.all([
    listPendingSpaceInvitationsForUser(teacher.email),
    searchParams,
  ]);
  const message = query.invitation
    ? invitationMessages[query.invitation] ?? ""
    : "";
  const succeeded = query.invitation === "accepted" || query.invitation === "declined";

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <AccountMenu user={teacher} />
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 pr-14 text-sm font-semibold text-slate-500 sm:pr-0">
          <Link className="hover:text-teal-800" href="/host">
            Your spaces
          </Link>
          <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-slate-700">Invitations</span>
        </nav>

        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                Ed.ie hosts
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
                Invitations
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Choose whether to join hosted spaces shared with your account.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
              {invitations.length} pending
            </span>
          </div>
        </header>

        {message ? (
          <p
            className={`mt-4 rounded-md border px-4 py-3 text-sm font-medium ${
              succeeded
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
            role="status"
          >
            {message}
          </p>
        ) : null}

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Pending invites</h2>
          {invitations.length ? (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {invitations.map((invitation) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                  key={invitation.code}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">
                        {invitation.name}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600 ring-1 ring-slate-200">
                        {invitation.role}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      You have been invited to co-host this space.
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {invitation.code}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={declineSpaceInvitation}>
                      <input name="spaceCode" type="hidden" value={invitation.code} />
                      <PendingSubmitButton
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
                        pendingChildren="Declining..."
                      >
                        Decline
                      </PendingSubmitButton>
                    </form>
                    <form action={acceptSpaceInvitation}>
                      <input name="spaceCode" type="hidden" value={invitation.code} />
                      <PendingSubmitButton
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                        pendingChildren="Accepting..."
                      >
                        Accept
                      </PendingSubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <h3 className="font-semibold text-slate-950">No pending invites</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                New invitations to co-host a space will appear here.
              </p>
              <Link className="mt-4 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900" href="/host">
                Back to Your spaces
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
