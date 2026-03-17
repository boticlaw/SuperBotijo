import { promises as fs } from "fs";
import path from "path";

import { OPENCLAW_DIR } from "@/lib/paths";

const DEFAULT_WORKSPACE_ID = "workspace";
const WORKSPACE_PREFIX = "workspace-";
const WORKSPACE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const LEGACY_WORKSPACE_ALIASES: Record<string, string> = {
  openclaw: ".",
  superbotijo: "workspace/superbotijo",
};

export interface WorkspaceEntry {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

export interface ResolvedWorkspacePath {
  workspaceId: string;
  workspacePath: string;
  relativePath: string;
  fullPath: string;
}

function isWithinPath(parentPath: string, targetPath: string): boolean {
  const relative = path.relative(parentPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectoryPath(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function getRealPath(filePath: string): Promise<string | null> {
  try {
    return await fs.realpath(filePath);
  } catch {
    return null;
  }
}

async function getAgentInfo(workspacePath: string): Promise<{ name: string; emoji: string } | null> {
  const identityPath = path.join(workspacePath, "IDENTITY.md");

  if (!(await pathExists(identityPath))) {
    return null;
  }

  try {
    const content = await fs.readFile(identityPath, "utf-8");
    const nameMatch = content.match(/- \*\*Name:\*\* (.+)/);
    const emojiMatch = content.match(/- \*\*Emoji:\*\* (.+)/);
    const emojiText = emojiMatch ? emojiMatch[1].trim() : "";

    return {
      name: nameMatch ? nameMatch[1].trim() : "",
      emoji: emojiText ? emojiText.split(" ")[0] : "📁",
    };
  } catch {
    return null;
  }
}

function toWorkspaceLabel(workspaceId: string): string {
  if (workspaceId === DEFAULT_WORKSPACE_ID) {
    return "Workspace Principal";
  }

  if (workspaceId.startsWith(WORKSPACE_PREFIX)) {
    const agentId = workspaceId.slice(WORKSPACE_PREFIX.length);
    if (!agentId) {
      return workspaceId;
    }
    return agentId.charAt(0).toUpperCase() + agentId.slice(1);
  }

  return workspaceId.charAt(0).toUpperCase() + workspaceId.slice(1);
}

function parseAllowlistFromEnv(): Record<string, string> {
  const raw = process.env.FILES_WORKSPACE_ALLOWLIST;
  if (!raw) {
    return {};
  }

  const entries = raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const parsed: Record<string, string> = {};

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const id = entry.slice(0, separatorIndex).trim();
    const relative = entry.slice(separatorIndex + 1).trim();

    if (!WORKSPACE_ID_PATTERN.test(id) || !relative || path.isAbsolute(relative)) {
      continue;
    }

    const normalized = path.normalize(relative);
    if (normalized.startsWith("..")) {
      continue;
    }

    parsed[id] = normalized;
  }

  return parsed;
}

async function getDynamicWorkspaceMap(): Promise<Record<string, string>> {
  const workspaceMap: Record<string, string> = {};

  const mainWorkspacePath = path.join(OPENCLAW_DIR, DEFAULT_WORKSPACE_ID);
  if (await pathExists(mainWorkspacePath)) {
    workspaceMap[DEFAULT_WORKSPACE_ID] = mainWorkspacePath;
  }

  try {
    const entries = await fs.readdir(OPENCLAW_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (!entry.name.startsWith(WORKSPACE_PREFIX)) {
        continue;
      }

      workspaceMap[entry.name] = path.join(OPENCLAW_DIR, entry.name);
    }
  } catch {
    return workspaceMap;
  }

  return workspaceMap;
}

async function resolveWorkspaceBasePath(workspaceId?: string): Promise<{ workspaceId: string; workspacePath: string } | null> {
  const requestedWorkspaceId = (workspaceId || DEFAULT_WORKSPACE_ID).trim();

  if (!WORKSPACE_ID_PATTERN.test(requestedWorkspaceId)) {
    return null;
  }

  const dynamicMap = await getDynamicWorkspaceMap();
  const allowlistMap = {
    ...LEGACY_WORKSPACE_ALIASES,
    ...parseAllowlistFromEnv(),
  };

  const candidate = dynamicMap[requestedWorkspaceId]
    || (allowlistMap[requestedWorkspaceId] ? path.join(OPENCLAW_DIR, allowlistMap[requestedWorkspaceId]) : null);

  if (!candidate || !(await isDirectoryPath(candidate))) {
    return null;
  }

  const [openclawRealPath, workspaceRealPath] = await Promise.all([
    getRealPath(OPENCLAW_DIR),
    getRealPath(candidate),
  ]);

  if (!openclawRealPath || !workspaceRealPath || !isWithinPath(openclawRealPath, workspaceRealPath)) {
    return null;
  }

  return {
    workspaceId: requestedWorkspaceId,
    workspacePath: workspaceRealPath,
  };
}

async function findNearestExistingPath(filePath: string): Promise<string | null> {
  let currentPath = filePath;

  while (true) {
    if (await pathExists(currentPath)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

function normalizeRelativePath(relativePath: string): string | null {
  if (path.isAbsolute(relativePath)) {
    return null;
  }

  const normalized = path.normalize(relativePath);
  if (normalized.startsWith("..")) {
    return null;
  }

  if (normalized === ".") {
    return "";
  }

  return normalized;
}

export async function listAvailableWorkspaces(): Promise<WorkspaceEntry[]> {
  const dynamicMap = await getDynamicWorkspaceMap();
  const configuredAllowlist = parseAllowlistFromEnv();
  const allWorkspaces: Record<string, string> = { ...dynamicMap };

  for (const [id, relativePath] of Object.entries(configuredAllowlist)) {
    if (allWorkspaces[id]) {
      continue;
    }

    const absolutePath = path.join(OPENCLAW_DIR, relativePath);
    if (await isDirectoryPath(absolutePath)) {
      allWorkspaces[id] = absolutePath;
    }
  }

  const workspaceEntries = Object.entries(allWorkspaces);
  const workspaces: WorkspaceEntry[] = [];

  for (const [id, workspacePath] of workspaceEntries) {
    const agentInfo = await getAgentInfo(workspacePath);

    workspaces.push({
      id,
      name: toWorkspaceLabel(id),
      emoji: agentInfo?.emoji || (id === DEFAULT_WORKSPACE_ID ? "🫙" : "🤖"),
      path: workspacePath,
      agentName: agentInfo?.name || (id === DEFAULT_WORKSPACE_ID ? "SuperBotijo" : undefined),
    });
  }

  workspaces.sort((first, second) => {
    if (first.id === DEFAULT_WORKSPACE_ID) {
      return -1;
    }

    if (second.id === DEFAULT_WORKSPACE_ID) {
      return 1;
    }

    return first.name.localeCompare(second.name);
  });

  return workspaces;
}

export async function resolveWorkspacePath(workspaceId: string | undefined, relativePath: string): Promise<ResolvedWorkspacePath | null> {
  const resolvedWorkspace = await resolveWorkspaceBasePath(workspaceId);
  if (!resolvedWorkspace) {
    return null;
  }

  const normalizedRelativePath = normalizeRelativePath(relativePath || "");
  if (normalizedRelativePath === null) {
    return null;
  }

  const fullPath = path.resolve(resolvedWorkspace.workspacePath, normalizedRelativePath);
  if (!isWithinPath(resolvedWorkspace.workspacePath, fullPath)) {
    return null;
  }

  const nearestExistingPath = await findNearestExistingPath(fullPath);
  if (!nearestExistingPath) {
    return null;
  }

  const nearestRealPath = await getRealPath(nearestExistingPath);
  if (!nearestRealPath || !isWithinPath(resolvedWorkspace.workspacePath, nearestRealPath)) {
    return null;
  }

  return {
    workspaceId: resolvedWorkspace.workspaceId,
    workspacePath: resolvedWorkspace.workspacePath,
    relativePath: normalizedRelativePath,
    fullPath,
  };
}

export async function resolveWorkspaceDirectory(workspaceId?: string): Promise<{ workspaceId: string; workspacePath: string } | null> {
  return resolveWorkspaceBasePath(workspaceId);
}
