import { promises as fs } from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { resolveWorkspaceDirectory } from "@/lib/files-workspaces";

export const dynamic = "force-dynamic";

export interface FileNode3D {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  extension: string;
  mimeType: string;
  color: string;
  lastModified: string;
  depth: number;
  children?: FileNode3D[];
}

const EXTENSION_COLORS: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f7df1e",
  jsx: "#61dafb",
  json: "#292929",
  md: "#083fa1",
  css: "#264de4",
  scss: "#cd6799",
  html: "#e34c26",
  py: "#3572A5",
  go: "#00ADD8",
  rs: "#dea584",
  java: "#b07219",
  rb: "#701516",
  php: "#4F5D95",
  sh: "#89e051",
  yaml: "#cb171e",
  yml: "#cb171e",
  sql: "#e38c00",
  graphql: "#e10098",
  svg: "#ffb13b",
  png: "#a074c4",
  jpg: "#a074c4",
  jpeg: "#a074c4",
  gif: "#a074c4",
  ico: "#a074c4",
  woff: "#a074c4",
  woff2: "#a074c4",
  ttf: "#a074c4",
  eot: "#a074c4",
  gitignore: "#f14e32",
  env: "#ecd53f",
  lock: "#e8e8e8",
};

const DEFAULT_COLOR = "#6e7681";

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1);
  const mimeTypes: Record<string, string> = {
    ts: "text/typescript",
    tsx: "text/typescript-jsx",
    js: "text/javascript",
    jsx: "text/javascript-jsx",
    json: "application/json",
    md: "text/markdown",
    css: "text/css",
    scss: "text/x-scss",
    html: "text/html",
    py: "text/x-python",
    go: "text/x-go",
    rs: "text/x-rust",
    java: "text/x-java",
    rb: "text/x-ruby",
    php: "text/x-php",
    sh: "text/x-sh",
    yaml: "text/yaml",
    yml: "text/yaml",
    sql: "application/sql",
    graphql: "application/graphql",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function getColor(filename: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (EXTENSION_COLORS[ext]) return EXTENSION_COLORS[ext];

  if (filename.startsWith(".")) {
    if (filename === ".gitignore") return EXTENSION_COLORS.gitignore;
    if (filename.includes("env")) return EXTENSION_COLORS.env;
    return DEFAULT_COLOR;
  }

  return DEFAULT_COLOR;
}

async function buildTree(
  dirPath: string,
  basePath: string,
  depth: number = 0,
  maxDepth: number = 5
): Promise<FileNode3D[]> {
  const nodes: FileNode3D[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sortedEntries) {
      if (entry.name.startsWith(".") && entry.name !== ".env" && entry.name !== ".gitignore") {
        continue;
      }

      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        const stats = await fs.stat(fullPath);

        const node: FileNode3D = {
          id: relativePath.replace(/\//g, "-").replace(/\\/g, "-"),
          name: entry.name,
          path: relativePath,
          type: "directory",
          size: 0,
          extension: "",
          mimeType: "inode/directory",
          color: "#8b949e",
          lastModified: stats.mtime.toISOString(),
          depth,
        };

        if (depth < maxDepth) {
          const children = await buildTree(fullPath, basePath, depth + 1, maxDepth);
          node.children = children;
          node.size = children.reduce((sum, child) => sum + child.size, 0);
        }

        nodes.push(node);
      } else {
        const stats = await fs.stat(fullPath);
        const ext = path.extname(entry.name).toLowerCase().slice(1);

        nodes.push({
          id: relativePath.replace(/\//g, "-").replace(/\\/g, "-"),
          name: entry.name,
          path: relativePath,
          type: "file",
          size: stats.size,
          extension: ext,
          mimeType: getMimeType(entry.name),
          color: getColor(entry.name),
          lastModified: stats.mtime.toISOString(),
          depth,
        });
      }
    }
  } catch (error) {
    console.error(`[tree-3d] Error reading ${dirPath}:`, error);
  }

  return nodes;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspace = searchParams.get("workspace") || "workspace";
  const maxDepth = parseInt(searchParams.get("maxDepth") || "4", 10);

  try {
    const resolvedWorkspace = await resolveWorkspaceDirectory(workspace);
    if (!resolvedWorkspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const workspacePath = resolvedWorkspace.workspacePath;
    const resolvedTree = await buildTree(workspacePath, workspacePath, 0, maxDepth);

    const totalFiles = resolvedTree.reduce((sum, node) => {
      if (node.type === "file") return sum + 1;
      return sum + (node.children?.length || 0);
    }, 0);

    return NextResponse.json({
      workspace,
      tree: resolvedTree,
      stats: {
        totalFiles,
        maxDepth,
      },
    });
  } catch (error) {
    console.error("[files/tree-3d] Error:", error);
    return NextResponse.json({ error: "Failed to build tree" }, { status: 500 });
  }
}
