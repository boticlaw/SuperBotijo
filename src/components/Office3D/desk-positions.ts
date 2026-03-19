/**
 * Office 3D — Desk Position Utilities
 *
 * Grid-based position calculation for dynamic desk layout.
 * The office space is 30x30 units.
 * Main area rug is 18x10 units centered at [0, 0, 0.5]
 */

import { AgentConfig, AgentWithDesk, AvatarState } from "./agentsConfig";

// Desk spacing - wider for better separation
const DESK_SPACING_X = 5;

// Simple row offsets - all facing forward (towards camera/entrance)
// z positive = towards entrance, z negative = towards back wall
const ROW_OFFSETS = [4, 1, -2] as const;

/**
 * Calculate grid dimensions based on agent count
 * @param agentCount - Number of agents to fit in the grid
 * @returns rows and columns for the grid
 */
export function getGridDimensions(agentCount: number): { rows: number; cols: number } {
  if (agentCount <= 0) {
    return { rows: 0, cols: 0 };
  }

  // Start with a reasonable aspect ratio (more columns than rows for office layout)
  const aspectRatio = 1.5;
  const cols = Math.ceil(Math.sqrt(agentCount * aspectRatio));
  const rows = Math.ceil(agentCount / cols);

  return { rows, cols };
}

/**
 * Calculate desk position for a given index in a grid
 * Simple office grid layout - all agents face forward (towards camera/entrance)
 *
 * Layout pattern (3 columns):
 *   Row z=4:    [1]  [2]  [3]
 *   Row z=1:    [4]  [0]  [5]   <- main agent at center
 *   Row z=-2:   [6]  [7]  [8]
 *
 * @param index - Agent index in the grid (0 = main agent at center)
 * @param gridWidth - Number of columns in the grid
 * @returns { x, y, z, rotation } for the desk position (y is always 0 for floor level)
 */
export function calculateDeskPosition(index: number, gridWidth: number): {
  x: number;
  y: number;
  z: number;
  rotation: number;
} {
  // Main agent (index 0) at center, facing forward
  if (index === 0) {
    return { x: 0, y: 0, z: 1, rotation: 0 };
  }

  // Calculate grid position (excluding index 0 which is center)
  const gridIndex = index - 1;

  // Determine which row and column
  const colsPerRow = gridWidth;
  const rowIndex = Math.floor(gridIndex / colsPerRow);
  const col = gridIndex % colsPerRow;

  // Get Z position from row offsets
  const zOffset = ROW_OFFSETS[Math.min(rowIndex, ROW_OFFSETS.length - 1)];

  // Calculate X position, centered
  const xOffset = (gridWidth - 1) * DESK_SPACING_X / 2;
  const x = col * DESK_SPACING_X - xOffset;

  // All agents face forward (towards camera/entrance)
  const rotation = 0;

  return { x, y: 0, z: zOffset, rotation };
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
