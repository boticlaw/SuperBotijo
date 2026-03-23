/**
 * Memory full-text search API
 * GET /api/memory/search?q=<query>
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';
const WORKSPACE = path.join(OPENCLAW_DIR, 'workspace');

export const dynamic = "force-dynamic";

interface SearchResult {
  file: string;
  title: string;
  snippet: string;
  matches: number;
  path: string;
}

async function searchFile(filePath: string, query: string, displayPath: string): Promise<SearchResult | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter(Boolean);

    // Count matches for each word
    let totalMatches = 0;
    for (const word of words) {
      let pos = 0;
      while (true) {
        const idx = lower.indexOf(word, pos);
        if (idx === -1) break;
        totalMatches++;
        pos = idx + 1;
      }
    }

    if (totalMatches === 0) return null;

    // Extract snippet around first match
    const firstMatchIdx = lower.indexOf(words[0]);
    const snippetStart = Math.max(0, firstMatchIdx - 60);
    const snippetEnd = Math.min(content.length, firstMatchIdx + 200);
    let snippet = content.slice(snippetStart, snippetEnd).replace(/\n+/g, ' ').trim();
    if (snippetStart > 0) snippet = '...' + snippet;
    if (snippetEnd < content.length) snippet = snippet + '...';

    // Get title (first heading or filename)
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : path.basename(filePath, '.md');

    return { file: path.basename(filePath), title, snippet, matches: totalMatches, path: displayPath };
  } catch {
    return null;
  }
}

async function getFiles(): Promise<Array<{ path: string; display: string }>> {
  const files: Array<{ path: string; display: string }> = [];

  // Root workspace files
  const rootFiles = ['MEMORY.md', 'SOUL.md', 'USER.md', 'AGENTS.md', 'TOOLS.md', 'IDENTITY.md', 'HEARTBEAT.md'];
  for (const f of rootFiles) {
    const full = path.join(WORKSPACE, f);
    try {
      await fs.access(full);
      files.push({ path: full, display: f });
    } catch {}
  }

  // Memory directory
  try {
    const memDir = path.join(WORKSPACE, 'memory');
    const memFiles = await fs.readdir(memDir);
    for (const f of memFiles.sort().reverse().slice(0, 30)) { // last 30 days
      if (f.endsWith('.md')) {
        files.push({ path: path.join(memDir, f), display: `memory/${f}` });
      }
    }
  } catch {}

  return files;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';

  if (query.length < 2) {
    return NextResponse.json({ results: [], query });
  }

  try {
    const files = await getFiles();
    const results = await Promise.all(files.map((f) => searchFile(f.path, query, f.display)));
    const sorted = results
      .filter(Boolean)
      .sort((a, b) => (b?.matches || 0) - (a?.matches || 0)) as SearchResult[];

    return NextResponse.json({ results: sorted.slice(0, 20), query, total: sorted.length });
  } catch (error) {
    console.error('[memory/search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
