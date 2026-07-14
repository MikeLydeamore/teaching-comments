import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { enterTeacherSpace } from "./actions";

type TeacherSessionChooserProps = {
  initialSpaceCode: string;
  spaceStatus: string;
};

export function TeacherSessionChooser({
  initialSpaceCode,
  spaceStatus,
}: TeacherSessionChooserProps) {
  const spaceMessage =
    {
      failed: "That space PIN did not work.",
      missing: "Enter a space code.",
      "not-found": "We could not find that space.",
    }[spaceStatus] ?? "";

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Host access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Manage your hosted space
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            A space keeps sessions grouped by subject, person, or
            cohort. Each space has its own host PIN, so you only see the
            rooms for the space you unlock.
          </p>
        </header>

        <section className="mt-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Unlock a space</h2>
          <form action={enterTeacherSpace} className="mt-4 grid gap-4 md:grid-cols-[1fr_220px_auto]">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="spaceCode">
                Space code
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                defaultValue={initialSpaceCode}
                id="spaceCode"
                name="spaceCode"
                placeholder="stats-101"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="pin">
                Space PIN
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                id="pin"
                name="pin"
                type="password"
              />
            </div>
            <div className="flex items-end">
              <PendingSubmitButton
                className="h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 md:w-auto"
                pendingChildren="Opening space..."
              >
                Open space
              </PendingSubmitButton>
            </div>
          </form>
          {spaceMessage ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {spaceMessage}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
