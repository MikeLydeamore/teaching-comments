import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { getCurrentTeacher } from "@/lib/auth-server";
import { loginRedirectPath } from "@/lib/teacher-session-auth";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect(loginRedirectPath("/host/profile"));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <AccountMenu user={teacher} />
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 pr-14 text-sm font-semibold text-slate-500 sm:pr-0">
          <Link className="hover:text-teal-800" href="/host">
            Your spaces
          </Link>
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              d="m9 18 6-6-6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-slate-700">Profile</span>
        </nav>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <header className="border-b border-slate-200 pb-4">
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
              Profile
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Choose how your account appears to other hosts in Ed.ie.
            </p>
          </header>

          <div>
            <ProfileForm displayName={teacher.name} />

            <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[7rem_minmax(0,1fr)_7rem]">
              <label
                className="col-span-2 text-sm font-semibold text-slate-700 sm:col-span-1"
                htmlFor="sign-in-email"
              >
                Sign-in email
              </label>
              <div className="relative min-w-0">
                <input
                  aria-readonly="true"
                  className="h-10 w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-3 pr-9 text-sm text-slate-500 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  id="sign-in-email"
                  readOnly
                  type="email"
                  value={teacher.email}
                />
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0 1 19.5 12.75v6A2.25 2.25 0 0 1 17.25 21H6.75a2.25 2.25 0 0 1-2.25-2.25v-6a2.25 2.25 0 0 1 2.25-2.25Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="flex h-10 items-center">
                <span className="group relative inline-flex">
                  <button
                    aria-describedby="sign-in-email-help"
                    aria-label="About your sign-in email"
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-500 outline-none transition hover:border-teal-500 hover:text-teal-800 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                    type="button"
                  >
                    ?
                  </button>
                  <span
                    className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-64 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
                    id="sign-in-email-help"
                    role="tooltip"
                  >
                    Managed by your sign-in method and cannot be changed here.
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
