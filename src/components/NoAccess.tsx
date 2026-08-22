import Link from "next/link";

export function NoAccess() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Ed.ie
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          No access to this space
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          You are signed in, but this space has not been shared with your
          account. Ask the space owner to add you from the space settings.
        </p>
        <Link
          className="mt-5 inline-block h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold leading-[2.75rem] text-white transition hover:bg-slate-700"
          href="/host"
        >
          Your spaces
        </Link>
      </section>
    </main>
  );
}
