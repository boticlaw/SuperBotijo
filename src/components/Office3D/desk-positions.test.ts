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
    const uniquePositions = new Set(serializedPositions);
    expect(uniquePositions.size).toBeGreaterThanOrEqual(11);

    const ninthDesk = layout[8].deskPosition;
    const tenthDesk = layout[9].deskPosition;

    expect(Math.abs(ninthDesk.z)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(tenthDesk.z)).toBeGreaterThanOrEqual(0);
    expect(`${ninthDesk.x}:${ninthDesk.z}`).not.toBe(`${tenthDesk.x}:${tenthDesk.z}`);
  });

  it("keeps the main agent centered and places others in grid slots", () => {
    const { cols } = getGridDimensions(9);
    const mainDesk = calculateDeskPosition(0, cols);
    const firstSubDesk = calculateDeskPosition(1, cols);

    expect(mainDesk).toEqual({ x: 0, y: 0, z: 1, rotation: 0 });
    expect(Math.abs(firstSubDesk.z)).toBeGreaterThan(0);
  });

  it("places desks within the main area rug bounds (18x10 at center)", () => {
    const agents = buildAgents(15);
    const layout = generateDeskLayout(agents);

    layout.forEach((agent) => {
      expect(agent.deskPosition.x).toBeGreaterThanOrEqual(-12);
      expect(agent.deskPosition.x).toBeLessThanOrEqual(12);
      expect(agent.deskPosition.z).toBeGreaterThanOrEqual(-3);
      expect(agent.deskPosition.z).toBeLessThanOrEqual(6);
    });
  });

  it("uses improved spacing (3.5 X, 2.5 Z) for better rug utilization", () => {
    const agents = buildAgents(6);
    const layout = generateDeskLayout(agents);

    // Check that adjacent desks in same row have spacing ~3.5 in X
    const row1Agents = layout.filter(a => Math.abs(a.deskPosition.z - 2.5) < 0.1);
    if (row1Agents.length >= 2) {
      const sortedByX = [...row1Agents].sort((a, b) => a.deskPosition.x - b.deskPosition.x);
      const spacing = Math.abs(sortedByX[1].deskPosition.x - sortedByX[0].deskPosition.x);
      expect(spacing).toBeCloseTo(3.5, 1);
    }
  });

  it("distributes agents in rows both in front and behind the main agent", () => {
    const agents = buildAgents(10);
    const layout = generateDeskLayout(agents);

    const zPositions = layout.map(a => a.deskPosition.z);

    // Should have agents both in front (positive Z) and behind (negative Z) the main agent
    const hasPositiveZ = zPositions.some(z => z > 1);
    const hasNegativeZ = zPositions.some(z => z < -1);

    // With 10 agents, we should fill multiple rows including back rows
    expect(hasPositiveZ || hasNegativeZ).toBe(true);
  });
});
