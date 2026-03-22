import { listAvailableWorkspaces } from "@/lib/files-workspaces";
import MemoryClient, { Workspace } from "./MemoryClient";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const workspacesData = await listAvailableWorkspaces();
  const initialWorkspaces = workspacesData as Workspace[];

  return <MemoryClient initialWorkspaces={initialWorkspaces} />;
}
