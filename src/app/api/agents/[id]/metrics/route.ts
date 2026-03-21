/**
 * Agent Metrics API - Get metrics for a specific agent
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActivities } from '@/lib/activities-db';
import { getAgentMood } from '@/operations/agent-ops';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params;
    
    // Get activities for this agent
    const activitiesResult = getActivities({ limit: 1000, sort: 'newest' });
    const activities = activitiesResult.activities.filter(() => 
      // In production, would filter by agent ID
      true
    );

    // Calculate metrics
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const last24h = activities.filter(a => new Date(a.timestamp).getTime() > dayAgo);
    const lastWeek = activities.filter(a => new Date(a.timestamp).getTime() > weekAgo);

    const successCount = last24h.filter(a => a.status === 'success').length;
    const errorCount = last24h.filter(a => a.status === 'error').length;
    const successRate = last24h.length > 0 ? (successCount / last24h.length) * 100 : 100;

    const totalDuration = last24h.reduce((sum, a) => sum + (a.duration_ms || 0), 0);
    const avgResponseTime = last24h.length > 0 ? totalDuration / last24h.length / 1000 : 0;

    const tokensPerDay = last24h.reduce((sum, a) => sum + (a.tokens_used || 0), 0);

    // Calculate top tasks
    const taskCounts: Record<string, number> = {};
    for (const a of lastWeek) {
      const taskType = a.type || 'unknown';
      taskCounts[taskType] = (taskCounts[taskType] || 0) + 1;
    }
    
    const topTasks = Object.entries(taskCounts)
      .map(([task, count]) => ({ task, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get agent mood
    const moodResult = await getAgentMood(agentId);
    const mood = moodResult.success ? moodResult.data : null;

    const metrics = {
      totalActivities: activities.length,
      last24h: last24h.length,
      lastWeek: lastWeek.length,
      successRate: Math.round(successRate * 10) / 10,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      tokensPerDay,
      errorsLast24h: errorCount,
      topTasks,
      mood,
    };

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('[api/agents/[id]/metrics] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get metrics' },
      { status: 500 }
    );
  }
}
