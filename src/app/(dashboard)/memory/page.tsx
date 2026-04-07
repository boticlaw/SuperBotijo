import { listAvailableWorkspaces } from "@/lib/files-workspaces";
import { isLcmAvailable } from "@/lib/lcm-detect";
import MemoryClient, { Workspace } from "./MemoryClient";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const workspacesData = await listAvailableWorkspaces();
  const initialWorkspaces = workspacesData as Workspace[];
  const lcmDetection = isLcmAvailable();

  return (
    <MemoryClient
      initialWorkspaces={initialWorkspaces}
      lcmAvailable={lcmDetection.available}
    />
  );
}
