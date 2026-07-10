import { isDefaultAdminPin } from "@/lib/teacher-auth";
import { TeacherSessionChooser } from "./TeacherSessionChooser";

export default async function TeacherHome({
  searchParams,
}: {
  searchParams: Promise<{
    space?: string;
    spaceAuth?: string;
    spaceCreate?: string;
  }>;
}) {
  const query = await searchParams;

  return (
    <TeacherSessionChooser
      createStatus={query.spaceCreate ?? ""}
      initialSpaceCode={query.space ?? ""}
      spaceStatus={query.spaceAuth ?? ""}
      usesDefaultAdminPin={isDefaultAdminPin()}
    />
  );
}
