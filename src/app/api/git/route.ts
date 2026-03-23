/**
 * Git Dashboard API
 * GET /api/git - List all repos with status
 * POST /api/git - { repo, action } actions: status, pull, log, diff
 */
import { NextRequest, NextResponse } from "next/server";

import { isValidGitAction, validatePath } from "@/lib/safe-exec";
import { getGitRepos, getGitWorkspacePath, normalizeGitRepoPath, runGitAction, type GitAction } from "@/operations/git-ops";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const statuses = await getGitRepos();
    return NextResponse.json({ repos: statuses, total: statuses.length });
  } catch (error) {
    console.error("[git] Error:", error);
    return NextResponse.json({ error: "Failed to get repos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo, action } = body as { repo?: unknown; action?: unknown };
    const normalizedRepo = normalizeGitRepoPath(repo);

    if (!normalizedRepo) {
      return NextResponse.json({ error: "Invalid repo path" }, { status: 400 });
    }

    if (typeof action !== "string" || !isValidGitAction(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!validatePath(normalizedRepo, getGitWorkspacePath())) {
      return NextResponse.json({ error: "Invalid repo path" }, { status: 400 });
    }

    const output = runGitAction(normalizedRepo, action as GitAction);
    return NextResponse.json({ success: true, output, repo: normalizedRepo, action });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
