/**
 * Skills Updates API
 * GET /api/skills/updates
 * Checks for available updates for installed skills
 */
import { NextResponse } from 'next/server';
import { safeExecFile, isValidSlug } from '@/lib/safe-exec';

export const dynamic = 'force-dynamic';

interface InstalledSkill {
  slug: string;
  version: string;
}

interface UpdateInfo {
  slug: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  changelog?: string;
}

export async function GET() {
  try {
    // Get installed skills
    const listResult = safeExecFile("clawhub", ["list"], {
      timeout: 5000,
    });

    const installedSkills: InstalledSkill[] = [];
    const lines = listResult.stdout.trim().split('\n').filter(l => l);

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)$/);
      if (match) {
        installedSkills.push({
          slug: match[1],
          version: match[2],
        });
      }
    }

    // Check each skill for updates
    const updates: UpdateInfo[] = [];

    for (const skill of installedSkills) {
      try {
        if (!isValidSlug(skill.slug)) {
          console.error(`[skills/updates] Invalid slug: ${skill.slug}`);
          continue;
        }

        // Get latest version info
        const inspectResult = safeExecFile("clawhub", ["inspect", skill.slug, "--json"], {
          timeout: 5000,
        });

        if (inspectResult.status !== 0 || !inspectResult.stdout) {
          updates.push({
            slug: skill.slug,
            currentVersion: skill.version,
            latestVersion: skill.version,
            hasUpdate: false,
          });
          continue;
        }

        // Parse JSON (skip first line)
        const jsonStr = inspectResult.stdout.split('\n').slice(1).join('\n');
        const data = JSON.parse(jsonStr);

        const latestVersion = data.latestVersion?.version || skill.version;
        const hasUpdate = latestVersion !== skill.version;
        const changelog = data.latestVersion?.changelog || '';

        updates.push({
          slug: skill.slug,
          currentVersion: skill.version,
          latestVersion,
          hasUpdate,
          changelog: hasUpdate ? changelog : undefined,
        });
      } catch (inspectError) {
        // If we can't check, assume no update
        console.error(`Failed to check updates for ${skill.slug}:`, inspectError);
        updates.push({
          slug: skill.slug,
          currentVersion: skill.version,
          latestVersion: skill.version,
          hasUpdate: false,
        });
      }
    }

    const skillsWithUpdates = updates.filter(u => u.hasUpdate);

    return NextResponse.json({
      updates,
      skillsWithUpdates,
      totalChecked: updates.length,
      totalWithUpdates: skillsWithUpdates.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[skills/updates] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check for updates', updates: [], skillsWithUpdates: [] },
      { status: 500 }
    );
  }
}
