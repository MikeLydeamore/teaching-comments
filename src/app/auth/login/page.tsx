import Link from "next/link";
import { OAuthSignInButtons } from "./OAuthSignInButtons";

function safeReturnTo(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/host";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <div className="w-full max-w-md">
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-teal-800"
          href="/"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
          Back to Ed.ie
        </Link>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
          <div className="h-1 bg-teal-600" />
          <div className="p-7 sm:p-8">
            <div className="inline-flex h-11 items-center justify-center rounded-md bg-teal-50 px-3 font-semibold text-teal-800 ring-1 ring-teal-200">
              Ed.ie
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
              Teacher sign-in
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sign in to reach your Ed.ie spaces and live sessions.
            </p>
            <OAuthSignInButtons returnTo={returnTo} />
          </div>
        </section>
      </div>
    </main>
  );
}
