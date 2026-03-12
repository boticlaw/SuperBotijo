import { describe, expect, it } from "vitest";

import type { AgentConfig } from "./agentsConfig";
import { calculateDeskPosition, generateDeskLayout, getGridDimensions } from "./desk-positions";

function buildAgents(count: number): AgentConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `agent-${index}`,
    name: `Agent ${index}`,
    emoji: "🤖",
    position: [0, 0, 0],
    color: "#60a5fa",
    role: "Agent",
  }));
}

describe("desk-positions", () => {
  it("calculates a grid that can fit more than 8 agents", () => {
    const { rows, cols } = getGridDimensions(12);

    expect(rows).toBeGreaterThan(0);
    expect(cols).toBeGreaterThan(0);
    expect(rows * cols).toBeGreaterThanOrEqual(12);
  });

  it("assigns unique desk positions for agents after the 8th", () => {
    const agents = buildAgents(12);
    const layout = generateDeskLayout(agents);

    expect(layout).toHaveLength(12);

    const serializedPositions = layout.map((agent) => `${agent.deskPosition.x}:${agent.deskPosition.z}`);
    expect(new Set(serializedPositions).size).toBe(12);

    const ninthDesk = layout[8].deskPosition;
    const tenthDesk = layout[9].deskPosition;

    expect(ninthDesk.z).toBeGreaterThanOrEqual(3);
    expect(tenthDesk.z).toBeGreaterThanOrEqual(3);
    expect(`${ninthDesk.x}:${ninthDesk.z}`).not.toBe(`${tenthDesk.x}:${tenthDesk.z}`);
  });

  it("keeps the main agent centered and places others in grid slots", () => {
    const { cols } = getGridDimensions(9);
    const mainDesk = calculateDeskPosition(0, cols);
    const firstSubDesk = calculateDeskPosition(1, cols);

    expect(mainDesk).toEqual({ x: 0, y: 0, z: 0, rotation: 0 });
    expect(firstSubDesk.z).toBeGreaterThan(0);
  });
});
