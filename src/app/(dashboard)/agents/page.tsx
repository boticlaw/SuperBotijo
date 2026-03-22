import { getAgents } from "@/operations/agent-ops";
import AgentsClient, { Agent } from "./AgentsClient";

// Ensure this page always fetches fresh data on load
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  // Fetch agents data directly on the server
  const result = await getAgents();
  
  // Cast and fallback to empty array if something fails
  const initialAgents = (result.success && result.data ? result.data : []) as Agent[];

  return <AgentsClient initialAgents={initialAgents} />;
}
