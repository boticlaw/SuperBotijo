/**
 * Office 3D — Desk Position Utilities
 *
 * Grid-based position calculation for dynamic desk layout.
 * The office space is 30x30 units.
 * Main area rug is 18x10 units centered at [0, 0, 0.5]
 */

import { AgentConfig, AgentWithDesk, AvatarState } from "./agentsConfig";

// Desk spacing optimized for the rug area
// With spacing 3.5 in X: we can fit 5 columns (-7, -3.5, 0, 3.5, 7) within the 18-unit rug
const DESK_SPACING_X = 3.5;

// Row offsets from center (z=0)
// Positive = towards camera/entrance, Negative = towards back/collab zone
// Fits within the 10-unit rug depth (z: -4.5 to 5.5)
const ROW_OFFSETS = [2.5, 5, -2.5, -5] as const;

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
 * Uses an office-style layout:
 * - Main agent (index 0) at center, facing forward
 * - Other agents arranged in rows, facing the central corridor
 *
 * Layout pattern:
 *   Row -2 (z=-5):   [8]  [9]  [10] [11]  <- towards back wall
 *   Row -1 (z=-2.5): [4]  [5]  [6]  [7]
 *   Row 0  (z=0):    [0]  <- MAIN AGENT
 *   Row 1  (z=2.5):  [1]  [2]  [3]  [4]
 *   Row 2  (z=5):    [5]  [6]  [7]  [8]  <- towards entrance
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
    // Main agent at center, facing forward (towards camera/entrance)
    return { x: 0, y: 0, z: 0, rotation: 0 };
  }

  // Calculate grid position (excluding index 0 which is center)
  const gridIndex = index - 1;

  // Determine which row and column
  // Rows alternate: first fill rows in front (positive Z), then behind (negative Z)
  const colsPerRow = gridWidth;
  const rowIndex = Math.floor(gridIndex / colsPerRow);
  const col = gridIndex % colsPerRow;

  // Get Z position from row offsets
  // Clamp to available rows to avoid going outside the rug
  const zOffset = ROW_OFFSETS[Math.min(rowIndex, ROW_OFFSETS.length - 1)];

  // Calculate X position, centered
  const xOffset = (gridWidth - 1) * DESK_SPACING_X / 2;
  const x = col * DESK_SPACING_X - xOffset;

  // Rotation: agents face towards the central corridor
  // - Agents on the left (negative X) face right (towards center)
  // - Agents on the right (positive X) face left (towards center)
  // - Center column faces forward
  let rotation = 0;
  if (x > 0.5) {
    rotation = Math.PI * 0.75; // Face left-forward
  } else if (x < -0.5) {
    rotation = -Math.PI * 0.75; // Face right-forward
  } else {
    // Center column - face forward (towards camera)
    rotation = 0;
  }

  // Agents in back rows (negative Z) face forward
  // Agents in front rows (positive Z) also face forward for consistency
  // This creates a classroom-like layout where everyone faces the same direction
  if (zOffset < 0) {
    // Back rows: face towards the front
    rotation = 0;
  }

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
