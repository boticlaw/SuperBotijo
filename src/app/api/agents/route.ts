import { NextRequest, NextResponse } from 'next/server';
import { registerAgent, getAgents } from '@/operations/agent-ops';
import { validateBody, CreateAgentSchema } from '@/lib/api-validation';

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

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = validateBody(CreateAgentSchema, rawBody);
    if (!validation.success) return validation.error;
    const { id, name, model, systemPrompt, skills, temperature, maxTokens, autoStart } = validation.data;

    const agentId = id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = await registerAgent(agentId, name, model || 'claude-sonnet-4-20250514');

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const agent = result.data!;

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
