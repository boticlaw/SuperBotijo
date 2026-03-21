/**
 * ClawHub Install API
 * POST /api/skills/clawhub/install
 * Installs a skill from ClawHub registry
 */
import { NextResponse } from 'next/server';
import { safeExecFile, isValidSlug, isValidVersion } from '@/lib/safe-exec';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, version } = body;

    if (!slug) {
      return NextResponse.json(
        { error: 'Skill slug required' },
        { status: 400 }
      );
    }

    if (!isValidSlug(slug)) {
      return NextResponse.json(
        { error: 'Invalid skill slug format' },
        { status: 400 }
      );
    }

    const args: string[] = ["install", "--dir", "skills", slug];

    if (version) {
      if (!isValidVersion(version)) {
        return NextResponse.json(
          { error: 'Invalid version format' },
          { status: 400 }
        );
      }
      args.push("--version", version);
    }

    console.log(`[clawhub/install] Running: clawhub install --dir skills ${slug}${version ? ` --version ${version}` : ''}`);

    const result = safeExecFile("clawhub", args, {
      timeout: 30000,
      cwd: process.cwd(),
    });

    if (result.status !== 0 || result.stdout.includes('Error') || result.stdout.includes('Failed')) {
      return NextResponse.json(
        { error: 'Installation failed', output: result.stdout || result.stderr },
        { status: 500 }
      );
    }

    console.log(`[clawhub/install] Output:`, result.stdout);

    return NextResponse.json({
      success: true,
      slug,
      version: version || 'latest',
      output: result.stdout,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[clawhub/install] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to install skill', details: errorMessage },
      { status: 500 }
    );
  }
}
