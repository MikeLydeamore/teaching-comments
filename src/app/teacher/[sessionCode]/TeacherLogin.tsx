import { loginTeacher } from "../actions";

type TeacherLoginProps = {
  authFailed: boolean;
  sessionCode: string;
  usesDefaultPin: boolean;
};

export function TeacherLogin({
  authFailed,
  sessionCode,
  usesDefaultPin,
}: TeacherLoginProps) {
  const next = `/teacher/${sessionCode}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Teacher PIN
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          Unlock dashboard
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This keeps student submissions out of public view while preserving
          login-free student access.
        </p>
        {usesDefaultPin ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Local prototype PIN is <strong>teach123</strong>.
          </p>
        ) : null}
        <form action={loginTeacher} className="mt-5">
          <input name="next" type="hidden" value={next} />
          <label className="text-sm font-semibold text-slate-700" htmlFor="pin">
            PIN
          </label>
          <input
            autoFocus
            className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            id="pin"
            name="pin"
            type="password"
          />
          <button
            className="mt-4 h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
            type="submit"
          >
            Unlock teacher view
          </button>
        </form>
        {authFailed ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            That PIN did not work.
          </p>
        ) : null}
      </section>
    </main>
  );
}
