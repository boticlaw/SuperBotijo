/**
 * Write file content endpoint
 * POST /api/files/write
 * Body: { workspace, path, content }
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logActivity } from '@/lib/activities-db';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';

const WORKSPACE_MAP: Record<string, string> = {
  workspace: path.join(OPENCLAW_DIR, 'workspace'),
  'superbotijo': path.join(OPENCLAW_DIR, 'workspace', 'superbotijo'),
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path: filePath, content } = body;

    if (!filePath || content === undefined) {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 });
    }

    const base = WORKSPACE_MAP[workspace || 'workspace'];
    if (!base) {
      return NextResponse.json({ error: 'Unknown workspace' }, { status: 400 });
    }

    const fullPath = path.resolve(base, filePath);
    if (!fullPath.startsWith(base)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Create parent directories if needed
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    const stat = await fs.stat(fullPath);

    logActivity('file_write', `Edited file: ${filePath}`, 'success', {
      metadata: { workspace, filePath, size: stat.size },
    });

    return NextResponse.json({ success: true, path: filePath, size: stat.size });
  } catch (error) {
    console.error('[write] Error:', error);
    return NextResponse.json({ error: 'Write failed' }, { status: 500 });
  }
}
