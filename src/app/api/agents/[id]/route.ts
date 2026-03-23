/**
 * Single Agent API - Get/Update/Delete specific agent
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAgentById, pauseAgent, resumeAgent, unregisterAgent } from '@/operations/agent-ops';

export const dynamic = "force-dynamic";

// GET /api/agents/[id] - Get agent by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAgentById(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ agent: result.data });
}

// PATCH /api/agents/[id] - Update agent status
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    let result;

    switch (action) {
      case 'pause':
        result = await pauseAgent(id);
        break;
      case 'resume':
        result = await resumeAgent(id);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await unregisterAgent(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
