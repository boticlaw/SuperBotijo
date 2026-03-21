/**
 * ClawHub Search API
 * GET /api/skills/clawhub/search?q=query
 * Searches skills on ClawHub registry
 */
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!query) {
    return NextResponse.json({ skills: [], error: 'Query parameter required' });
  }

  try {
    // Search ClawHub using CLI
    const output = execSync(
      `clawhub search --limit ${limit} "${query.replace(/"/g, '\\"')}" 2>&1`,
      {
        timeout: 10000,
        encoding: 'utf-8',
      }
    );

    // Parse the plain text output
    const lines = output.trim().split('\n').filter(l => l && !l.startsWith('-'));
    const skills: ClawHubSearchResult[] = [];

    for (const line of lines) {
      // Format: "slug  displayName  (score)"
      const match = line.match(/^(\S+)\s+(.+?)\s+\(([0-9.]+)\)$/);
      if (!match) continue;

      const [, slug, , scoreStr] = match;

      // Get detailed info using inspect
      try {
        const inspectOutput = execSync(
          `clawhub inspect "${slug}" --json 2>&1`,
          {
            timeout: 5000,
            encoding: 'utf-8',
          }
        );

        // Skip the "Fetching skill" line
        const jsonStr = inspectOutput.split('\n').slice(1).join('\n');
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
