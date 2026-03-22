import { getGitRepos, RepoStatus } from "@/operations/git-ops";
import GitClient from "./GitClient";

export const dynamic = "force-dynamic";

export default async function GitPage() {
  let initialRepos: RepoStatus[] = [];
  try {
    initialRepos = await getGitRepos();
  } catch (error) {
    console.error("Failed to fetch initial git repos:", error);
  }

  return <GitClient initialRepos={initialRepos} />;
}
