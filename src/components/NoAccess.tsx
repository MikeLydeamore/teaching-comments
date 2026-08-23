import Link from "next/link";

export function NoAccess() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-md">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 0h10.5A2.25 2.25 0 0 1 19.5 12.75v6A2.25 2.25 0 0 1 17.25 21H6.75a2.25 2.25 0 0 1-2.25-2.25v-6a2.25 2.25 0 0 1 2.25-2.25Z" />
          </svg>
        </div>
        <p className="mt-5 text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Access restricted
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          No access to this space
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          You are signed in, but this space has not been shared with your
          account. Ask the space owner to add you from the space settings.
        </p>
        <Link
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
          href="/host"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
          Back to your spaces
        </Link>
      </section>
    </main>
  );
}
