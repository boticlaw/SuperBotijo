/**
 * Active Sub-agents API
 * GET /api/agents/subagents - Returns currently active sub-agent sessions
 */
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

interface SubagentInfo {
  id: string;
  parentId: string;
  parentName: string;
  sessionKey: string;
  task: string;
  model: string;
  tokens: number;
  startedAt: string;
  ageMs: number;
  status: 'active' | 'idle';
}

interface RawSession {
  key: string;
  kind: string;
  updatedAt: number;
  ageMs: number;
  sessionId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
}

function parseSubagentKey(key: string): { parentId: string; subagentId: string } | null {
  // Format: agent:<parentId>:subagent:<subagentId>
  const parts = key.split(':');
  if (parts.length < 4 || parts[2] !== 'subagent') return null;
  return {
    parentId: parts[1],
    subagentId: parts[3],
  };
}

export async function GET() {
  try {
    const output = execSync('openclaw sessions --json 2>/dev/null', {
      timeout: 10000,
      encoding: 'utf-8',
    });

    const data = JSON.parse(output);
    const rawSessions: RawSession[] = data.sessions || [];

    // Filter to only subagent sessions
    const subagents: SubagentInfo[] = [];

    for (const session of rawSessions) {
      const parsed = parseSubagentKey(session.key);
      if (!parsed) continue;

      // Consider active if updated in last 2 minutes
      const isActive = session.ageMs < 2 * 60 * 1000;
      
      // Get task from session key (subagent ID usually contains task info)
      const task = parsed.subagentId
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 40);

      subagents.push({
        id: parsed.subagentId,
        parentId: parsed.parentId,
        parentName: parsed.parentId === 'main' ? 'SuperBotijo' : parsed.parentId,
        sessionKey: session.key,
        task: task || 'Working...',
        model: session.model || 'unknown',
        tokens: session.totalTokens || 0,
        startedAt: new Date(session.updatedAt - session.ageMs).toISOString(),
        ageMs: session.ageMs,
        status: isActive ? 'active' : 'idle',
      });
    }

    // Sort by most recent first, limit to 10
    subagents.sort((a, b) => a.ageMs - b.ageMs);
    const visibleSubagents = subagents.slice(0, 10);

    return NextResponse.json({
      subagents: visibleSubagents,
      total: subagents.length,
      visible: visibleSubagents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[subagents] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subagents', subagents: [], total: 0, visible: 0 },
      { status: 500 }
    );
  }
}
