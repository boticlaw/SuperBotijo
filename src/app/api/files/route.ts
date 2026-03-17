import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { resolveWorkspaceDirectory, resolveWorkspacePath } from "@/lib/files-workspaces";

// Files to show in the memory browser
const ROOT_FILES = ["MEMORY.md", "SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md", "IDENTITY.md"];
const MEMORY_DIR = "memory";

interface FileNode {
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

async function getFileTree(workspacePath: string): Promise<FileNode[]> {
  const tree: FileNode[] = [];

  // Add root markdown files
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

  // Add memory folder if it exists
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

function sanitizePath(requestedPath: string): string | null {
  // Prevent directory traversal
  const normalized = path.normalize(requestedPath);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }

  // Only allow .md files
  if (!normalized.endsWith(".md")) {
    return null;
  }

  // Only allow root files or files in memory/
  const isRootFile = ROOT_FILES.includes(normalized);
  const isMemoryFile = normalized.startsWith(`${MEMORY_DIR}/`);

  if (!isRootFile && !isMemoryFile) {
    return null;
  }

  return normalized;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace") || "workspace";
  const filePath = searchParams.get("path");

  try {
    const resolvedWorkspace = await resolveWorkspaceDirectory(workspace);
    if (!resolvedWorkspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const workspacePath = resolvedWorkspace.workspacePath;

    if (!filePath) {
      // Return file tree
      const tree = await getFileTree(workspacePath);
      return NextResponse.json(tree);
    }

    // Read specific file
    const safePath = sanitizePath(filePath);
    if (!safePath) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    const resolvedPath = await resolveWorkspacePath(workspace, safePath);
    if (!resolvedPath || !(await fileExists(resolvedPath.fullPath))) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const content = await fs.readFile(resolvedPath.fullPath, "utf-8");
    return NextResponse.json({ path: safePath, content });
  } catch (error) {
    console.error("Error reading file:", error);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace = "workspace", path: filePath, content } = body;

    if (!filePath || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing path or content" },
        { status: 400 }
      );
    }

    const safePath = sanitizePath(filePath);
    if (!safePath) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    const resolvedWorkspace = await resolveWorkspaceDirectory(workspace);
    if (!resolvedWorkspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const resolvedPath = await resolveWorkspacePath(workspace, safePath);
    if (!resolvedPath) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    // Create memory directory if needed
    const dir = path.dirname(resolvedPath.fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath.fullPath, content, "utf-8");

    return NextResponse.json({ success: true, path: safePath });
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }
}
