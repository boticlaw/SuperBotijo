/**
 * Agents API - CRUD operations for agent management
 */
import { NextRequest, NextResponse } from 'next/server';
import { registerAgent, getAgents } from '@/operations/agent-ops';

// GET /api/agents - List all agents
export async function GET() {
  try {
    const result = await getAgents();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ agents: result.data || [] });
  } catch (error) {
    console.error('[api/agents] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, model, systemPrompt, skills, temperature, maxTokens, autoStart } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate ID if not provided
    const agentId = id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Register the agent
    const result = await registerAgent(agentId, name, model || 'claude-sonnet-4-20250514');

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // In production, we would also:
    // - Create the agent's SOUL.md file
    // - Set up the agent's workspace
    // - Configure skills
    // - Start the agent process if autoStart is true

    const agent = result.data!;

    // Add additional config
    const fullAgent = {
      ...agent,
      systemPrompt,
      skills: skills || [],
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 4096,
      autoStart: autoStart !== false,
    };

    return NextResponse.json({ 
      success: true, 
      agent: fullAgent,
      message: `Agent "${name}" created successfully`,
    }, { status: 201 });
  } catch (error) {
    console.error('[api/agents] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create agent' },
      { status: 500 }
    );
  }
}
