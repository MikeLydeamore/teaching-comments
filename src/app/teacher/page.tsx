import { TeacherSessionChooser } from "./TeacherSessionChooser";

export default async function TeacherHome({
  searchParams,
}: {
  searchParams: Promise<{
    space?: string;
    spaceAuth?: string;
  }>;
}) {
  const query = await searchParams;

  return (
    <TeacherSessionChooser
      initialSpaceCode={query.space ?? ""}
      spaceStatus={query.spaceAuth ?? ""}
    />
  );
}
