import fs from 'fs';
import path from 'path';
import Office3D from '@/components/Office3D/Office3D';
import { calculateDeskPosition, getGridDimensions } from '@/components/Office3D/desk-positions';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');

/**
 * Get default accessories for an agent (same logic as office-agents.ts)
 */
function getDefaultAccessories(agentId: string): Record<string, unknown> {
  const presets = [
    { glasses: true, hair: "short" },
    { hat: "beanie", hair: "short" },
    { beard: true, hair: "long" },
    { hat: "cap", glasses: true, hair: "none" },
    { earrings: true, hair: "spiky" },
  ];
  let hash = 0;
  for (let i = 0; i < agentId.length; i += 1) {
    hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0;
  }
  return presets[hash % presets.length] as Record<string, unknown>;
}

/**
 * Load agents directly from openclaw.json (server-side, no HTTP needed)
 */
async function loadOfficeAgents() {
  if (!fs.existsSync(OPENCLAW_CONFIG)) {
    return [];
  }

  try {
    const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));
    const agentsList = config.agents?.list || [];

    if (agentsList.length === 0) {
      return [];
    }

    const { cols } = getGridDimensions(agentsList.length);

    return agentsList.map((agent: {
      id: string;
      name?: string;
      emoji?: string;
      color?: string;
      model?: string;
    }, index: number) => {
      const deskPosition = calculateDeskPosition(index, cols);
      return {
        id: agent.id,
        name: agent.name || agent.id,
        emoji: agent.emoji || '🤖',
        color: agent.color || '#666666',
        // AgentConfig format: position + deskRotation
        position: [deskPosition.x, deskPosition.y, deskPosition.z] as [number, number, number],
        deskRotation: [0, deskPosition.rotation, 0] as [number, number, number],
        role: agent.id === 'main' ? 'Main Agent' : 'Agent',
        accessories: getDefaultAccessories(agent.id),
      };
    });
  } catch (error) {
    console.error('[office] Failed to load agents from config:', error);
    return [];
  }
}

export const metadata = {
  title: 'The Office 3D | SuperBotijo',
  description: 'Visualiza tus agentes trabajando en tiempo real en un entorno 3D',
};

export default async function OfficePage() {
  // Load agents directly from openclaw.json (no HTTP, no API)
  const agents = await loadOfficeAgents();

  return <Office3D initialAgents={agents} />;
}
