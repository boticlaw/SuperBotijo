import { listAvailableWorkspaces } from "@/lib/files-workspaces";
import FilesClient, { Workspace } from "./FilesClient";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const workspacesData = await listAvailableWorkspaces();
  const initialWorkspaces = workspacesData as Workspace[];

  return <FilesClient initialWorkspaces={initialWorkspaces} />;
}
