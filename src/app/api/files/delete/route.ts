import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logActivity } from '@/lib/activities-db';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';

const WORKSPACE_MAP: Record<string, string> = {
  workspace: path.join(OPENCLAW_DIR, 'workspace'),
  'superbotijo': path.join(OPENCLAW_DIR, 'workspace', 'superbotijo'),
};

// Protected paths - never allow deletion
const PROTECTED = [
  'MEMORY.md', 'SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md',
  'package.json', 'tsconfig.json', '.env', '.env.local',
];

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path: filePath } = body;

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const base = WORKSPACE_MAP[workspace || 'workspace'];
    if (!base) {
      return NextResponse.json({ error: 'Unknown workspace' }, { status: 400 });
    }

    const fullPath = path.resolve(base, filePath);
    if (!fullPath.startsWith(base)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const filename = path.basename(fullPath);
    if (PROTECTED.includes(filename)) {
      return NextResponse.json({ error: `Cannot delete protected file: ${filename}` }, { status: 403 });
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }

    logActivity('file_write', `Deleted ${stat.isDirectory() ? 'folder' : 'file'}: ${filePath}`, 'success', {
      metadata: { workspace, filePath },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete] Error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
