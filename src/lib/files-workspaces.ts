import { promises as fs } from "fs";
import path from "path";

import { OPENCLAW_DIR } from "@/lib/paths";

const DEFAULT_WORKSPACE_ID = "workspace";
const WORKSPACE_PREFIX = "workspace-";
const WORKSPACE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

interface OpenClawAgentWorkspaceConfig {
  id?: string;
  name?: string;
  workspace?: string;
}

interface OpenClawWorkspaceConfig {
  agents?: {
    list?: OpenClawAgentWorkspaceConfig[];
  };
}

interface WorkspaceCandidate {
  path: string;
  agentName?: string;
}

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

async function toSafeWorkspacePath(candidatePath: string, openclawRealPath: string): Promise<string | null> {
  if (!(await isDirectoryPath(candidatePath))) {
    return null;
  }

  const candidateRealPath = await getRealPath(candidatePath);
  if (!candidateRealPath || !isWithinPath(openclawRealPath, candidateRealPath)) {
    return null;
  }

  return candidateRealPath;
}

function toConfiguredWorkspaceAbsolutePath(workspace: string | undefined, agentId: string): string {
  const configuredWorkspace = workspace?.trim();
  if (configuredWorkspace) {
    return path.isAbsolute(configuredWorkspace)
      ? configuredWorkspace
      : path.join(OPENCLAW_DIR, configuredWorkspace);
  }

  return path.join(OPENCLAW_DIR, DEFAULT_WORKSPACE_ID, "agents", agentId);
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

async function getDynamicWorkspaceMap(): Promise<Record<string, WorkspaceCandidate>> {
  const workspaceMap: Record<string, WorkspaceCandidate> = {};
  const openclawRealPath = await getRealPath(OPENCLAW_DIR);

  if (!openclawRealPath) {
    return workspaceMap;
  }

  const mainWorkspacePath = path.join(OPENCLAW_DIR, DEFAULT_WORKSPACE_ID);
  const safeMainWorkspacePath = await toSafeWorkspacePath(mainWorkspacePath, openclawRealPath);
  if (safeMainWorkspacePath) {
    workspaceMap[DEFAULT_WORKSPACE_ID] = { path: safeMainWorkspacePath };
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

      const discoveredWorkspacePath = path.join(OPENCLAW_DIR, entry.name);
      const safeWorkspacePath = await toSafeWorkspacePath(discoveredWorkspacePath, openclawRealPath);
      if (safeWorkspacePath) {
        workspaceMap[entry.name] = { path: safeWorkspacePath };
      }
    }
  } catch (error) {
    console.warn("[files-workspaces] Failed to discover workspace-* directories:", {
      openclawDir: OPENCLAW_DIR,
      error,
    });
    return workspaceMap;
  }

  return workspaceMap;
}

async function getConfiguredWorkspaceMap(): Promise<Record<string, WorkspaceCandidate>> {
  const workspaceMap: Record<string, WorkspaceCandidate> = {};
  const configPath = path.join(OPENCLAW_DIR, "openclaw.json");

  if (!(await pathExists(configPath))) {
    return workspaceMap;
  }

  const openclawRealPath = await getRealPath(OPENCLAW_DIR);
  if (!openclawRealPath) {
    return workspaceMap;
  }

  try {
    const rawConfig = await fs.readFile(configPath, "utf-8");
    const parsedConfig = JSON.parse(rawConfig) as OpenClawWorkspaceConfig;
    const agents = parsedConfig.agents?.list ?? [];

    for (const agent of agents) {
      const agentId = agent.id?.trim();
      if (!agentId || !WORKSPACE_ID_PATTERN.test(agentId)) {
        continue;
      }

      const workspacePath = toConfiguredWorkspaceAbsolutePath(agent.workspace, agentId);
      const safeWorkspacePath = await toSafeWorkspacePath(workspacePath, openclawRealPath);
      if (!safeWorkspacePath) {
        continue;
      }

      workspaceMap[agentId] = {
        path: safeWorkspacePath,
        agentName: agent.name?.trim() || undefined,
      };
    }
  } catch (error) {
    console.warn("[files-workspaces] Failed to discover configured workspaces:", {
      configPath,
      error,
    });
    return {};
  }

  return workspaceMap;
}

async function getAllowlistedWorkspaceMap(): Promise<Record<string, WorkspaceCandidate>> {
  const workspaceMap: Record<string, WorkspaceCandidate> = {};
  const openclawRealPath = await getRealPath(OPENCLAW_DIR);

  if (!openclawRealPath) {
    return workspaceMap;
  }

  const configuredAllowlist = parseAllowlistFromEnv();
  for (const [id, relativePath] of Object.entries(configuredAllowlist)) {
    const candidatePath = path.join(OPENCLAW_DIR, relativePath);
    const safeWorkspacePath = await toSafeWorkspacePath(candidatePath, openclawRealPath);
    if (safeWorkspacePath) {
      workspaceMap[id] = { path: safeWorkspacePath };
    }
  }

  return workspaceMap;
}

function addWorkspaceCandidates(
  targetMap: Record<string, WorkspaceCandidate>,
  sourceMap: Record<string, WorkspaceCandidate>,
  knownPaths: Set<string>,
  dedupeByPath: boolean,
): void {
  for (const [id, workspace] of Object.entries(sourceMap)) {
    const hasDuplicatePath = dedupeByPath && knownPaths.has(workspace.path);
    if (targetMap[id] || hasDuplicatePath) {
      continue;
    }

    targetMap[id] = workspace;
    knownPaths.add(workspace.path);
  }
}

async function getDiscoveredWorkspaceMap(): Promise<Record<string, WorkspaceCandidate>> {
  const [dynamicMap, configuredMap, allowlistedMap] = await Promise.all([
    getDynamicWorkspaceMap(),
    getConfiguredWorkspaceMap(),
    getAllowlistedWorkspaceMap(),
  ]);

  const mergedWorkspaces: Record<string, WorkspaceCandidate> = {};
  const knownPaths = new Set<string>();

  addWorkspaceCandidates(mergedWorkspaces, dynamicMap, knownPaths, true);
  addWorkspaceCandidates(mergedWorkspaces, configuredMap, knownPaths, true);
  addWorkspaceCandidates(mergedWorkspaces, allowlistedMap, knownPaths, false);

  return mergedWorkspaces;
}

async function resolveWorkspaceBasePath(workspaceId?: string): Promise<{ workspaceId: string; workspacePath: string } | null> {
  const requestedWorkspaceId = (workspaceId || DEFAULT_WORKSPACE_ID).trim();

  if (!WORKSPACE_ID_PATTERN.test(requestedWorkspaceId)) {
    return null;
  }

  const discoveredMap = await getDiscoveredWorkspaceMap();
  const allowlistMap = {
    ...LEGACY_WORKSPACE_ALIASES,
    ...parseAllowlistFromEnv(),
  };

  const candidate = discoveredMap[requestedWorkspaceId]?.path
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
  const allWorkspaces = await getDiscoveredWorkspaceMap();
  const workspaceEntries = Object.entries(allWorkspaces);
  const workspaces: WorkspaceEntry[] = [];

  for (const [id, workspace] of workspaceEntries) {
    const agentInfo = await getAgentInfo(workspace.path);

    workspaces.push({
      id,
      name: toWorkspaceLabel(id),
      emoji: agentInfo?.emoji || (id === DEFAULT_WORKSPACE_ID ? "🫙" : "🤖"),
      path: workspace.path,
      agentName: workspace.agentName || agentInfo?.name || (id === DEFAULT_WORKSPACE_ID ? "SuperBotijo" : undefined),
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
