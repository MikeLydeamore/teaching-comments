import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSession } from "@/lib/qwt-store";
import { studentNameCookieName } from "@/lib/student-name-cookie";
import { StudentSubmit } from "./StudentSubmit";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  await connection();
  const { sessionCode } = await params;
  const session = await getSession(sessionCode);

  if (!session) {
    return (
      <StudentSessionUnavailable
        message="We could not find that quick write session."
        sessionCode={sessionCode}
      />
    );
  }

  if (!session.isOpen) {
    return (
      <StudentSessionUnavailable
        message="This quick write session is closed."
        sessionCode={session.code}
      />
    );
  }

  const cookieStore = await cookies();
  const studentName =
    cookieStore.get(studentNameCookieName(session.code))?.value ?? "";

  return (
    <StudentSubmit
      initialStudentName={studentName}
      prompt={session.prompt}
      sessionCode={session.code}
    />
  );
}

function StudentSessionUnavailable({
  message,
  sessionCode,
}: {
  message: string;
  sessionCode: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          Quick Write
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          Session unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Entered code: <span className="font-semibold">{sessionCode}</span>
        </p>
        <Link
          className="mt-5 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          href="/join"
        >
          Try another code
        </Link>
      </section>
    </main>
  );
}
