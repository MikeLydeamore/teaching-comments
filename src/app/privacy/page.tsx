import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <article className="mx-auto max-w-3xl rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Privacy notice
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
          Quick Write Tool prototype
        </h1>
        <p className="mt-4 leading-7 text-slate-700">
          This prototype collects short pieces of student writing, optional
          drawings, and an optional display name so teaching staff can
          understand what the class is thinking during a learning activity.
          Students can leave the name field blank and submit as Anonymous.
        </p>

        <section className="mt-6 space-y-5 text-sm leading-6 text-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">What is collected</h2>
            <p className="mt-2">
              We store the writing or drawing you submit, the session code, an
              optional display name, a timestamp, and teacher moderation markers
              such as starred, flagged, or hidden. The prototype may also
              create ordinary technical logs through its hosting provider.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-950">What is not requested</h2>
            <p className="mt-2">
              The student form does not ask for your student ID, email address,
              or login details. Please avoid including student IDs or sensitive
              identifying information about yourself or other people in your
              response or drawing.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-950">Who can see responses</h2>
            <p className="mt-2">
              Teaching staff with the teacher PIN can see submitted responses.
              A teacher may choose to discuss or display selected responses
              during class.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-950">How responses are used</h2>
            <p className="mt-2">
              Responses are used for formative teaching feedback and class
              discussion. They should not be used for research, publication, or
              formal assessment without the relevant university approval,
              consent, and ethics processes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-950">Retention</h2>
            <p className="mt-2">
              For the prototype, data should be deleted when it is no longer
              needed for testing or teaching review. A hosted pilot should set a
              clear retention period, such as deleting activity data after 30
              days or at the end of semester.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-950">No AI processing</h2>
            <p className="mt-2">
              This version does not send writing or drawings to an AI service.
              If AI feedback is added later, this notice should be updated
              before it is used with students.
            </p>
          </div>
        </section>

        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          This is a prototype notice, not final institutional legal advice. A
          real class pilot should align with the relevant university privacy,
          data governance, and ethics requirements.
        </div>

        <Link
          className="mt-6 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
          href="/"
        >
          Back to prototype
        </Link>
      </article>
    </main>
  );
}
