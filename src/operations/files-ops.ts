import { promises as fs } from "fs";
import path from "path";

import { resolveWorkspaceDirectory } from "@/lib/files-workspaces";

const ROOT_FILES = ["MEMORY.md", "SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md", "IDENTITY.md"];
const MEMORY_DIR = "memory";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFileTree(workspacePath: string): Promise<FileNode[]> {
  const tree: FileNode[] = [];

  for (const file of ROOT_FILES) {
    const fullPath = path.join(workspacePath, file);
    if (await fileExists(fullPath)) {
      tree.push({
        name: file,
        path: file,
        type: "file",
      });
    }
  }

  const memoryPath = path.join(workspacePath, MEMORY_DIR);
  if (await fileExists(memoryPath)) {
    const memoryStats = await fs.stat(memoryPath);
    if (memoryStats.isDirectory()) {
      const memoryFiles = await fs.readdir(memoryPath);
      const children: FileNode[] = [];

      for (const file of memoryFiles.sort().reverse()) {
        if (file.endsWith(".md")) {
          children.push({
            name: file,
            path: `${MEMORY_DIR}/${file}`,
            type: "file",
          });
        }
      }

      if (children.length > 0) {
        tree.push({
          name: MEMORY_DIR,
          path: MEMORY_DIR,
          type: "folder",
          children,
        });
      }
    }
  }

  return tree;
}

export async function getWorkspaceFileTree(workspaceId?: string): Promise<FileNode[]> {
  const resolvedWorkspace = await resolveWorkspaceDirectory(workspaceId);
  if (!resolvedWorkspace) {
    return [];
  }
  return getFileTree(resolvedWorkspace.workspacePath);
}

export async function getMemoryFileContent(
  workspaceId: string,
  filePath: string
): Promise<{ content: string; path: string } | null> {
  const normalized = path.normalize(filePath);
  if (normalized.startsWith("..") || path.isAbsolute(normalized) || !normalized.endsWith(".md")) {
    return null;
  }

  const isRootFile = ROOT_FILES.includes(normalized);
  const isMemoryFile = normalized.startsWith(`${MEMORY_DIR}/`);

  if (!isRootFile && !isMemoryFile) {
    return null;
  }

  const resolvedWorkspace = await resolveWorkspaceDirectory(workspaceId);
  if (!resolvedWorkspace) {
    return null;
  }

  const fullPath = path.join(resolvedWorkspace.workspacePath, normalized);
  
  if (!(await fileExists(fullPath))) {
    return null;
  }

  const content = await fs.readFile(fullPath, "utf-8");
  return { content, path: normalized };
}
