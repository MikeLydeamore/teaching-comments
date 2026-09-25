import { UsernameSetupGate } from "@/components/UsernameSetupGate";
import { getCurrentTeacher } from "@/lib/auth-server";
import { getPersonalOrganization } from "@/lib/edie-store";

export const dynamic = "force-dynamic";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teacher = await getCurrentTeacher();

  if (teacher) {
    const organization = teacher.username
      ? await getPersonalOrganization(teacher.id)
      : null;

    if (!teacher.username || !organization) {
      return (
        <UsernameSetupGate
          name={teacher.name}
          displayUsername={teacher.displayUsername}
        />
      );
    }
  }

  return children;
}
