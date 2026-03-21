/**
 * ClawHub Install API
 * POST /api/skills/clawhub/install
 * Installs a skill from ClawHub registry
 */
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

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

    // Install using ClawHub CLI
    const versionArg = version ? ` --version ${version}` : '';
    const command = `clawhub install --dir skills${versionArg} "${slug}" 2>&1`;

    console.log(`[clawhub/install] Running: ${command}`);

    const output = execSync(command, {
      timeout: 30000,
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    console.log(`[clawhub/install] Output:`, output);

    // Check if installation was successful
    if (output.includes('Error') || output.includes('Failed')) {
      return NextResponse.json(
        { error: 'Installation failed', output },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      slug,
      version: version || 'latest',
      output,
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
