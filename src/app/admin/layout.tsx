import { UsernameSetupGate } from "@/components/UsernameSetupGate";
import { getCurrentTeacher } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const teacher = await getCurrentTeacher();

  if (teacher && !teacher.username) {
    return <UsernameSetupGate name={teacher.name} />;
  }

  return children;
}
