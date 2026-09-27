import { UsernameSetupGate } from "@/components/UsernameSetupGate";
import { getCurrentTeacher } from "@/lib/auth-server";
import { validateEntitlementConfiguration } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  validateEntitlementConfiguration();
  const teacher = await getCurrentTeacher();

  if (teacher && !teacher.username) {
    return <UsernameSetupGate name={teacher.name} />;
  }

  return children;
}
