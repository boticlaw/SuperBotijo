'use client';

import { useMemo } from "react";
import VoxelAvatar from "./VoxelAvatar";
import type { AgentConfig } from "./agentsConfig";

export interface RestZone {
  name: string;
  spawnPoints: [number, number, number][];
}

export const REST_ZONES: RestZone[] = [
  {
    name: "collab-zone",
    spawnPoints: [
      [-2.5, 0, -7.0],
      [2.5, 0, -7.0],
      [-2.5, 0, -4.8],
      [2.5, 0, -4.8],
    ],
  },
  {
    name: "coffee-machine",
    spawnPoints: [
      [11.5, 0, -6.8],
      [12.5, 0, -6.6],
    ],
  },
  {
    name: "focus-zone",
    spawnPoints: [
      [-10.35, 0, -7.35],
      [-12.2, 0, -7.7],
    ],
  },
  {
    name: "break-zone",
    spawnPoints: [
      [12.35, 0, -7.45],
      [10.3, 0, -7.85],
    ],
  },
];

function getAgentSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function seededRandom(seed: number, offset: number): number {
  const x = Math.sin(seed + offset) * 10000;
  return x - Math.floor(x);
}

export function assignRestZone(agentId: string): { zone: RestZone; spawnPoint: [number, number, number] } {
  const seed = getAgentSeed(agentId);
  const zoneIndex = Math.floor(seededRandom(seed, 0) * REST_ZONES.length);
  const zone = REST_ZONES[zoneIndex];

  const spawnIndex = Math.floor(seededRandom(seed, 1) * zone.spawnPoints.length);
  const baseSpawnPoint = zone.spawnPoints[spawnIndex];

  const jitterX = (seededRandom(seed, 2) - 0.5) * 0.3;
  const jitterZ = (seededRandom(seed, 3) - 0.5) * 0.3;

  return {
    zone,
    spawnPoint: [baseSpawnPoint[0] + jitterX, baseSpawnPoint[1], baseSpawnPoint[2] + jitterZ],
  };
}

interface RestingAvatarProps {
  agent: AgentConfig;
  visible?: boolean;
}

export default function RestingAvatar({ agent, visible = true }: RestingAvatarProps) {
  const AVATAR_GROUND_Y = 0.3;

  const { position, rotation } = useMemo(() => {
    const { spawnPoint } = assignRestZone(agent.id);

    const seed = getAgentSeed(agent.id);
    const rotY = seededRandom(seed, 4) * Math.PI * 2;

    return {
      position: [spawnPoint[0], spawnPoint[1], spawnPoint[2]] as [number, number, number],
      rotation: rotY,
    };
  }, [agent.id]);

  return (
    <group position={position} rotation={[0, rotation, 0]} visible={visible}>
      <VoxelAvatar
        agent={agent}
        position={[0, AVATAR_GROUND_Y, 0]}
        isWorking={false}
        isThinking={false}
        isError={false}
        isWalking={false}
        scale={1.5}
      />
    </group>
  );
}
