import { schoolAccess } from "@/lib/school";
import { WorkspaceHeader } from "@/components/workspace-header";

export default async function SchoolLayout({ children, params }: { children: React.ReactNode; params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const { school, membership, user } = await schoolAccess(schoolId);
  return <><WorkspaceHeader school={school} member={membership} userName={user.name} />{children}</>;
}
