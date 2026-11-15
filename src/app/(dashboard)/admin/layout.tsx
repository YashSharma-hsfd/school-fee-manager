import { activeSchool } from "@/lib/school";
import { WorkspaceHeader } from "@/components/workspace-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, school, membership } = await activeSchool();
  return <><WorkspaceHeader school={school} member={membership} userName={user.name} />{children}</>;
}
