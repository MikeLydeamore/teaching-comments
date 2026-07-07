import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { listSessions } from "@/lib/qwt-store";
import { TeacherSessionChooser } from "./TeacherSessionChooser";

export default async function TeacherHome({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; session?: string }>;
}) {
  const query = await searchParams;
  const authenticated = await isTeacherAuthenticated();
  const sessions = authenticated ? await listSessions() : [];

  return (
    <TeacherSessionChooser
      authFailed={query.auth === "failed"}
      initialSessionCode={query.session ?? "demo-lecture"}
      isAuthenticated={authenticated}
      sessions={sessions}
      usesDefaultPin={isDefaultTeacherPin()}
    />
  );
}
