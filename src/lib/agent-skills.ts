import fs from 'fs';
import path from 'path';

export interface AgentSkillMapping {
  agentId: string;
  agentName: string;
  emoji: string;
  skillIds: string[];
}

const WORKSPACE_AGENTS_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';

/**
 * Parse AGENTS.md to extract available_skills
 */
function parseAgentsFile(agentsPath: string): { agentId: string; agentName: string; emoji: string; skills: string[] } | null {
  try {
    if (!fs.existsSync(agentsPath)) return null;
    
    const content = fs.readFileSync(agentsPath, 'utf-8');
    
    // Extract agent info from IDENTITY.md in same directory
    const identityPath = path.join(path.dirname(agentsPath), 'IDENTITY.md');
    let agentName = '';
    let emoji = '';
    let agentId = '';
    
    if (fs.existsSync(identityPath)) {
      const identityContent = fs.readFileSync(identityPath, 'utf-8');
      const nameMatch = identityContent.match(/- \*\*Name:\*\* (.+)/);
      const emojiMatch = identityContent.match(/- \*\*Emoji:\*\* (.+)/);
      
      if (nameMatch) agentName = nameMatch[1].trim();
      if (emojiMatch) emoji = emojiMatch[1].trim();
      
      // Get folder name as agentId
      agentId = path.basename(path.dirname(agentsPath)).replace('workspace-', '');
    }
    
    // Extract available_skills section
    const skillsMatch = content.match(/<available_skills>([\s\S]*?)<\/available_skills>/);
    
    if (!skillsMatch) return null;
    
    const skillsSection = skillsMatch[1];
    const skillMatches = skillsSection.matchAll(/<skill>\s*<name>(.+?)<\/name>/g);
    
    const skills: string[] = [];
    for (const match of skillMatches) {
      skills.push(match[1].trim());
    }
    
    return { agentId: agentId || 'unknown', agentName: agentName || 'Unknown Agent', emoji: emoji || '🤖', skills };
  } catch (error) {
    console.error('Error parsing AGENTS.md:', error);
    return null;
  }
}

/**
 * Scan all workspaces and extract agent-skill mappings
 */
export function getAgentSkillMappings(): AgentSkillMapping[] {
  const mappings: AgentSkillMapping[] = [];
  
  try {
    // Scan workspace directories
    const workspaceDirs = fs.readdirSync(WORKSPACE_AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('workspace-'))
      .map(d => path.join(WORKSPACE_AGENTS_DIR, d.name));
    
    for (const workspaceDir of workspaceDirs) {
      const agentsPath = path.join(workspaceDir, 'AGENTS.md');
      const agentInfo = parseAgentsFile(agentsPath);
      
      if (agentInfo && agentInfo.skills.length > 0) {
        mappings.push({
          agentId: agentInfo.agentId,
          agentName: agentInfo.agentName,
          emoji: agentInfo.emoji,
          skillIds: agentInfo.skills,
        });
      }
    }
    
    // Sort by agent name
    mappings.sort((a, b) => a.agentName.localeCompare(b.agentName));
  } catch (error) {
    console.error('Error scanning agent skills:', error);
  }
  
  return mappings;
}

/**
 * Get all unique skills used across all agents
 */
export function getAllUsedSkills(): string[] {
  const mappings = getAgentSkillMappings();
  const allSkills = new Set<string>();
  
  for (const mapping of mappings) {
    for (const skillId of mapping.skillIds) {
      allSkills.add(skillId);
    }
  }
  
  return Array.from(allSkills).sort();
}

/**
 * Find which agents use a specific skill
 */
export function getAgentsUsingSkill(skillId: string): AgentSkillMapping[] {
  const mappings = getAgentSkillMappings();
  return mappings.filter(m => m.skillIds.includes(skillId));
}
