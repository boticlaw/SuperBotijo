/**
 * Skill Update API
 * POST /api/skills/[id]/update
 * Updates a specific skill to latest or specified version
 */
import { NextResponse } from 'next/server';
import { safeExecFile, isValidSlug, isValidVersion } from '@/lib/safe-exec';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const slug = decodeURIComponent(id);

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { error: 'Invalid skill slug' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { version } = body;

    const args: string[] = ["update", slug];

    if (version) {
      if (!isValidVersion(version)) {
        return NextResponse.json(
          { error: 'Invalid version format' },
          { status: 400 }
        );
      }
      args.push("--version", version);
    }

    console.log(`[skills/update] Running: clawhub update ${slug}${version ? ` --version ${version}` : ''}`);

    const result = safeExecFile("clawhub", args, {
      timeout: 30000,
      cwd: process.cwd(),
    });

    if (result.status !== 0 || result.stdout.includes('Error') || result.stdout.includes('Failed')) {
      return NextResponse.json(
        { error: 'Update failed', output: result.stdout || result.stderr },
        { status: 500 }
      );
    }

    console.log(`[skills/update] Output:`, result.stdout);

    return NextResponse.json({
      success: true,
      slug,
      version: version || 'latest',
      output: result.stdout,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[skills/update] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update skill', details: errorMessage },
      { status: 500 }
    );
  }
}
