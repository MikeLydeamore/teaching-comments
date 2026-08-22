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
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Teacher sign-in
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          Sign in to Ed.ie
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use your Google or GitHub account to reach your spaces. Students never
          need an account.
        </p>
        <OAuthSignInButtons returnTo={returnTo} />
      </section>
    </main>
  );
}
