import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

function getAgentInfo(workspacePath: string): { name: string; emoji: string } | null {
  const identityPath = path.join(workspacePath, 'IDENTITY.md');
  
  if (!fs.existsSync(identityPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(identityPath, 'utf-8');
    
    const nameMatch = content.match(/- \*\*Name:\*\* (.+)/);
    const emojiMatch = content.match(/- \*\*Emoji:\*\* (.+)/);
    
    let emoji = '📁';
    if (emojiMatch) {
      // Extract just the emoji character (first few characters before any description)
      const emojiText = emojiMatch[1].trim();
      emoji = emojiText.split(' ')[0]; // Take only the first part (the emoji)
    }
    
    return {
      name: nameMatch ? nameMatch[1].trim() : '',
      emoji,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const workspaces: Workspace[] = [];
    
    // Main workspace
    const mainWorkspace = path.join(OPENCLAW_DIR, 'workspace');
    if (fs.existsSync(mainWorkspace)) {
      const mainInfo = getAgentInfo(mainWorkspace);
      workspaces.push({
        id: 'workspace',
        name: 'Workspace Principal',
        emoji: mainInfo?.emoji || '🫙',
        path: mainWorkspace,
        agentName: mainInfo?.name || 'SuperBotijo',
      });
    }
    
    // Agent workspaces
    const entries = fs.readdirSync(OPENCLAW_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('workspace-')) {
        const workspacePath = path.join(OPENCLAW_DIR, entry.name);
        const agentInfo = getAgentInfo(workspacePath);
        
        const agentId = entry.name.replace('workspace-', '');
        // Friendly workspace name: capitalize the directory id (e.g. "academic" → "Academic")
        const workspaceLabel = agentId.charAt(0).toUpperCase() + agentId.slice(1);

        workspaces.push({
          id: entry.name,
          name: workspaceLabel,
          emoji: agentInfo?.emoji || '🤖',
          path: workspacePath,
          agentName: agentInfo?.name || undefined,
        });
      }
    }
    
    // Sort: main first, then alphabetically
    workspaces.sort((a, b) => {
      if (a.id === 'workspace') return -1;
      if (b.id === 'workspace') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return NextResponse.json({ workspaces: [] }, { status: 500 });
  }
}
