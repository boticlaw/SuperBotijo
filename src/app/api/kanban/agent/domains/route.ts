/**
 * Task Domains API
 * 
 * Returns list of unique domains from existing tasks in the database.
 * Used for UI filters in the Kanban board.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentOrSessionAuth } from "@/lib/auth-helpers";
import { listTasks } from "@/lib/kanban-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/kanban/agent/domains
 * Returns list of unique domains from tasks in the database
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAgentOrSessionAuth(request);
  if (!authResult.authorized) {
    return authResult.error;
  }

  try {
    // Get all tasks and extract unique domains
    const tasks = listTasks();
    
    const domainSet = new Set<string>();
    for (const task of tasks) {
      if (task.domain) {
        domainSet.add(task.domain);
      }
    }
    
    // Convert to array with display names, sorted alphabetically
    const domains = Array.from(domainSet)
      .sort((a, b) => a.localeCompare(b))
      .map((domain) => ({
        id: domain,
        name: getDomainDisplayName(domain),
      }));
    
    // Add "unassigned" option for filtering tasks without domain
    domains.unshift({ id: "unassigned", name: "Sin dominio" });
    
    return NextResponse.json({ domains });
  } catch (error) {
    console.error("[agent-domains] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task domains" },
      { status: 500 }
    );
  }
}

/**
 * Get display name for domain
 */
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
