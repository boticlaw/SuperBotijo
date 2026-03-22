import { getColumns, listTasks } from "@/lib/kanban-db";
import { getOpenClawAgents } from "@/lib/openclaw-agents";
import KanbanClient, { KanbanInitialData } from "./KanbanClient";

export const dynamic = "force-dynamic";

function getDomainDisplayName(domain: string): string {
  const displayNames: Record<string, string> = {
    work: "Trabajo",
    finance: "Finanzas",
    personal: "Personal",
    communication: "Comunicación",
    admin: "Administración",
    general: "General",
  };
  return displayNames[domain.toLowerCase()] || domain;
}

async function getKanbanInitialData(): Promise<KanbanInitialData> {
  const [columns, tasks, agents] = await Promise.all([
    Promise.resolve(getColumns()),
    Promise.resolve(listTasks()),
    Promise.resolve(getOpenClawAgents()),
  ]);

  const configuredAgents = agents.map((agent) => agent.id);

  const domainSet = new Set<string>();
  for (const task of tasks) {
    if (task.domain) {
      domainSet.add(task.domain);
    }
  }

  const domains = Array.from(domainSet)
    .sort((a, b) => a.localeCompare(b))
    .map((domain) => ({
      id: domain,
      name: getDomainDisplayName(domain),
    }));

  domains.unshift({ id: "unassigned", name: "Sin dominio" });

  return {
    columns,
    tasks,
    configuredAgents,
    domains,
  };
}

export default async function KanbanPage() {
  const initialData = await getKanbanInitialData();
  return <KanbanClient initialData={initialData} />;
}
