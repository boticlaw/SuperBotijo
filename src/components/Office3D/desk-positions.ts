/**
 * Office 3D — Desk Position Utilities
 *
 * Grid-based position calculation for dynamic desk layout.
 * The office space is 30x30 units.
 */

import { AgentConfig, AgentWithDesk, AvatarState } from "./agentsConfig";

// Office space dimensions
const OFFICE_SIZE = 30;
const DESK_SPACING_X = 4;
const DESK_SPACING_Z = 3;

/**
 * Calculate grid dimensions based on agent count
 * @param agentCount - Number of agents to fit in the grid
 * @returns rows and columns for the grid
 */
export function getGridDimensions(agentCount: number): { rows: number; cols: number } {
  if (agentCount <= 0) {
    return { rows: 0, cols: 0 };
  }

  // Start with a reasonable aspect ratio (more columns than rows)
  const aspectRatio = 1.5;
  const cols = Math.ceil(Math.sqrt(agentCount * aspectRatio));
  const rows = Math.ceil(agentCount / cols);

  return { rows, cols };
}

/**
 * Calculate desk position for a given index in a grid
 * Uses the existing desk pattern from the codebase:
 * - Main agent (index 0) at center
 * - Other agents arranged in a grid pattern around the center
 *
 * @param index - Agent index in the grid (0 = main agent)
 * @param gridWidth - Number of columns in the grid
 * @returns { x, y, z, rotation } for the desk position (y is always 0 for floor level)
 */
export function calculateDeskPosition(index: number, gridWidth: number): {
  x: number;
  y: number;
  z: number;
  rotation: number;
} {
  if (index === 0) {
    // Main agent at center, facing forward (toward camera)
    return { x: 0, y: 0, z: 0, rotation: 0 };
  }

  // Calculate grid position (excluding index 0 which is center)
  const gridIndex = index - 1;
  const col = gridIndex % gridWidth;
  const row = Math.floor(gridIndex / gridWidth);

  // Calculate position with spacing
  // Offset to center the grid in the office
  const xOffset = (gridWidth - 1) * DESK_SPACING_X / 2;
  const x = col * DESK_SPACING_X - xOffset;
  const z = row * DESK_SPACING_Z + DESK_SPACING_Z; // Start row 1 (row 0 is center/main)

  // Rotation: face toward center (negative Z direction)
  // Agents on the left face right, agents on the right face left
  let rotation = 0;
  if (x > 1) {
    rotation = Math.PI; // Face left
  } else if (x < -1) {
    rotation = 0; // Face right
  } else {
    // Center column - alternate facing based on row
    rotation = row % 2 === 0 ? 0 : Math.PI;
  }

  return { x, y: 0, z, rotation };
}

/**
 * Generate a complete desk layout for a list of agents
 * @param agents - Array of AgentConfig from agentsConfig.ts
 * @returns Array of AgentWithDesk with calculated desk positions
 */
export function generateDeskLayout(agents: AgentConfig[]): AgentWithDesk[] {
  if (!agents || agents.length === 0) {
    return [];
  }

  const { cols } = getGridDimensions(agents.length);

  return agents.map((agent, index) => {
    const deskPosition = calculateDeskPosition(index, cols);

    // Determine initial avatar state based on agent role
    // Main agent starts online, sub-agents start idle
    const currentAvatarState: AvatarState = index === 0 ? "online" : "idle";

    return {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      color: agent.color,
      role: agent.role,
      deskPosition,
      currentAvatarState,
      accessories: agent.accessories,
    };
  });
}

/**
 * Get a default desk position for a single agent
 * Useful when adding agents dynamically
 * @param index - Position index in the grid
 * @param totalAgents - Total number of agents for grid calculation
 * @returns DeskPosition with x, y, rotation
 */
export function getDefaultDeskPosition(
  index: number,
  totalAgents: number
): { x: number; y: number; rotation: number } {
  const { cols } = getGridDimensions(totalAgents);
  return calculateDeskPosition(index, cols);
}
