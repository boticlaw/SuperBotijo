import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logActivity } from '@/lib/activities-db';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';

const WORKSPACE_MAP: Record<string, string> = {
  workspace: path.join(OPENCLAW_DIR, 'workspace'),
  'superbotijo': path.join(OPENCLAW_DIR, 'workspace', 'superbotijo'),
};

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.ts': 'text/plain',
    '.tsx': 'text/plain',
    '.js': 'text/javascript',
    '.jsx': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.log': 'text/plain',
    '.py': 'text/plain',
    '.sh': 'text/plain',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.toml': 'text/plain',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get('workspace') || 'workspace';
    const filePath = searchParams.get('path') || '';

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const base = WORKSPACE_MAP[workspace];
    if (!base) {
      return NextResponse.json({ error: 'Unknown workspace' }, { status: 400 });
    }

    const fullPath = path.resolve(base, filePath);
    if (!fullPath.startsWith(base)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 });
    }

    const content = await fs.readFile(fullPath);
    const filename = path.basename(fullPath);
    const mimeType = getMimeType(filename);

    logActivity('file_read', `Downloaded file: ${filePath}`, 'success', {
      metadata: { workspace, filePath, size: stat.size },
    });

    return new NextResponse(content, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stat.size.toString(),
      },
    });
  } catch (error) {
    console.error('[download] Error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
