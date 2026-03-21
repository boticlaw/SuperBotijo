/**
 * ClawHub Search API
 * GET /api/skills/clawhub/search?q=query
 * Searches skills on ClawHub registry
 */
import { NextResponse } from 'next/server';
import { safeExecFile, isValidSlug } from '@/lib/safe-exec';

export const dynamic = 'force-dynamic';

interface ClawHubSkill {
  slug: string;
  displayName: string;
  summary: string;
  tags: Record<string, string>;
  stats: {
    comments: number;
    downloads: number;
    installsAllTime: number;
    installsCurrent: number;
    stars: number;
    versions: number;
  };
  createdAt: number;
  updatedAt: number;
}

interface ClawHubSearchResult {
  skill: ClawHubSkill;
  owner: {
    handle: string;
    displayName: string;
    image: string;
  };
  latestVersion: {
    version: string;
    createdAt: number;
    changelog: string;
  };
  score?: number;
}

const SAFE_QUERY_PATTERN = /^[a-zA-Z0-9_\-\s]+$/;

function isValidSearchQuery(query: string): boolean {
  if (!query || query.length === 0 || query.length > 100) return false;
  return SAFE_QUERY_PATTERN.test(query);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10)), 100);

  if (!query) {
    return NextResponse.json({ skills: [], error: 'Query parameter required' });
  }

  if (!isValidSearchQuery(query)) {
    return NextResponse.json({ skills: [], error: 'Invalid query format' });
  }

  try {
    // Search ClawHub using CLI
    const searchResult = safeExecFile("clawhub", ["search", "--limit", String(limit), query], {
      timeout: 10000,
    });

    if (searchResult.status !== 0) {
      return NextResponse.json({ skills: [], error: 'Search failed' });
    }

    // Parse the plain text output
    const lines = searchResult.stdout.trim().split('\n').filter(l => l && !l.startsWith('-'));
    const skills: ClawHubSearchResult[] = [];

    for (const line of lines) {
      // Format: "slug  displayName  (score)"
      const match = line.match(/^(\S+)\s+(.+?)\s+\(([0-9.]+)\)$/);
      if (!match) continue;

      const [, slug, , scoreStr] = match;

      if (!isValidSlug(slug)) {
        console.error(`[clawhub/search] Invalid slug in search result: ${slug}`);
        continue;
      }

      // Get detailed info using inspect
      try {
        const inspectResult = safeExecFile("clawhub", ["inspect", slug, "--json"], {
          timeout: 5000,
        });

        if (inspectResult.status !== 0 || !inspectResult.stdout) {
          continue;
        }

        // Skip the "Fetching skill" line
        const jsonStr = inspectResult.stdout.split('\n').slice(1).join('\n');
        const data = JSON.parse(jsonStr);

        skills.push({
          ...data,
          score: parseFloat(scoreStr),
        });
      } catch (inspectError) {
        // If inspect fails, skip this skill
        console.error(`Failed to inspect ${slug}:`, inspectError);
      }
    }

    return NextResponse.json({
      skills,
      query,
      limit,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[clawhub/search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search ClawHub', skills: [] },
      { status: 500 }
    );
  }
}
