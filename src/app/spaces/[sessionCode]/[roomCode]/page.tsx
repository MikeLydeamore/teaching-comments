import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionInSpace, getTeacherSpace } from "@/lib/qwt-store";
import { studentConsentCookieName } from "@/lib/student-consent-cookie";
import { studentNameCookieName } from "@/lib/student-name-cookie";
import { StudentSubmit } from "../StudentSubmit";

export default async function StudentSpacePage({
  params,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
}) {
  await connection();
  const { roomCode, sessionCode: spaceCode } = await params;
  const [session, space] = await Promise.all([
    getSessionInSpace(spaceCode, roomCode),
    getTeacherSpace(spaceCode),
  ]);

  if (!session) {
    return (
      <StudentSessionUnavailable
        message="We could not find that Ed.ie session in this space."
        sessionCode={`${spaceCode}/${roomCode}`}
      />
    );
  }

  if (!session.isOpen) {
    return (
      <StudentSessionUnavailable
        message="This Ed.ie session is closed."
        sessionCode={`${spaceCode}/${session.code}`}
      />
    );
  }

  const cookieStore = await cookies();

  if (
    cookieStore.get(studentConsentCookieName(session.code))?.value !== "accepted"
  ) {
    redirect(
      `/join?space=${encodeURIComponent(spaceCode)}&session=${encodeURIComponent(session.code)}`,
    );
  }

  const studentName =
    cookieStore.get(studentNameCookieName(session.code))?.value ?? "";

  return (
    <StudentSubmit
      initialStudentName={studentName}
      prompt={session.prompt}
      sessionCode={session.code}
      spaceCode={spaceCode}
      spaceName={space?.name ?? spaceCode}
      timerDurationSeconds={session.timerDurationSeconds}
      timerEndsAt={session.timerEndsAt}
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
          Ed.ie
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
