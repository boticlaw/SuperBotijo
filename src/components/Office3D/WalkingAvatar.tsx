'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import VoxelAvatar from './VoxelAvatar';
import type { AgentConfig, AgentStatus } from './agentsConfig';

// Points of Interest in the office - places idle agents naturally gravitate to
const POINTS_OF_INTEREST: Array<{
  position: [number, number, number];
  type: 'window' | 'coffee' | 'plant' | 'whiteboard' | 'bookshelf' | 'center';
  radius: number;
}> = [
  { position: [5.2, 0, -7], type: 'window', radius: 1.5 },
  { position: [-10, 0, 0.4], type: 'window', radius: 1.5 },
  { position: [6.5, 0, -5], type: 'coffee', radius: 1.2 },
  { position: [-6.9, 0, -4.7], type: 'plant', radius: 1.0 },
  { position: [6.9, 0, -4.7], type: 'plant', radius: 1.0 },
  { position: [-8.7, 0, 6], type: 'plant', radius: 1.2 },
  { position: [8.7, 0, 6], type: 'plant', radius: 1.2 },
  { position: [0, 0, -6], type: 'whiteboard', radius: 1.5 },
  { position: [-8, 0, 2.2], type: 'bookshelf', radius: 1.2 },
  { position: [8, 0, 2.2], type: 'bookshelf', radius: 1.2 },
  { position: [0, 0, 6], type: 'center', radius: 2.0 },
  { position: [-7, 0, 5], type: 'center', radius: 1.6 },
  { position: [7, 0, 5], type: 'center', radius: 1.6 },
  { position: [0, 0, -4.5], type: 'center', radius: 1.4 },
];

const BEHAVIOR_CONFIG = {
  minPauseTime: 1000, // Very short pauses
  maxPauseTime: 2000, // Very short max pause
  poiChance: 0.8, // High chance to go to interesting spots
  speedVariation: 0.2,
  baseSpeed: 3.0, // MUCH FASTER - for visible movement
} as const;

interface WalkingAvatarProps {
  agent: AgentConfig;
  status: AgentStatus;
  visible?: boolean; // Toggle visibility instead of remounting
  officeBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  obstacles: Array<{ position: Vector3; radius: number }>;
  otherAvatarPositions: Map<string, Vector3>;
  onPositionUpdate: (id: string, pos: Vector3) => void;
}

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

function pickDestination(
  seed: number,
  bounds: WalkingAvatarProps['officeBounds'],
  obstacles: WalkingAvatarProps['obstacles'],
  variation: number
): Vector3 {
  const rand = seededRandom(seed, variation);

  if (rand < BEHAVIOR_CONFIG.poiChance) {
    const poiIndex = Math.floor(seededRandom(seed, variation + 1) * POINTS_OF_INTEREST.length);
    const poi = POINTS_OF_INTEREST[poiIndex];
    const angle = seededRandom(seed, variation + 2) * Math.PI * 2;
    const dist = seededRandom(seed, variation + 3) * poi.radius;

    return new Vector3(
      poi.position[0] + Math.cos(angle) * dist,
      0,
      poi.position[2] + Math.sin(angle) * dist
    );
  }

  const randX = seededRandom(seed, variation + 4);
  const randZ = seededRandom(seed, variation + 5);
  const x = bounds.minX + randX * (bounds.maxX - bounds.minX);
  const z = bounds.minZ + randZ * (bounds.maxZ - bounds.minZ);

  const candidate = new Vector3(x, 0, z);
  for (const obstacle of obstacles) {
    if (candidate.distanceTo(obstacle.position) < obstacle.radius + 0.5) {
      const away = candidate.clone().sub(obstacle.position).normalize();
      candidate.add(away.multiplyScalar(obstacle.radius + 0.6));
    }
  }

  return candidate;
}

function getRandomPauseDuration(seed: number, variation: number): number {
  const rand = seededRandom(seed, variation + 6);
  return BEHAVIOR_CONFIG.minPauseTime + rand * (BEHAVIOR_CONFIG.maxPauseTime - BEHAVIOR_CONFIG.minPauseTime);
}

function getAgentSpeed(seed: number): number {
  const variation = (seededRandom(seed, 12345) - 0.5) * 2 * BEHAVIOR_CONFIG.speedVariation;
  return BEHAVIOR_CONFIG.baseSpeed * (1 + variation);
}

type MovementState = 'walking' | 'paused';

/**
 * WalkingAvatar - Idle agents walking around the office
 * 
 * Behavior:
 * - idle: Walks around the office, visiting points of interest
 * - offline/working/thinking/error: Component is not visible (agent not rendered)
 * 
 * The parent (Office3D) controls visibility via the `visible` prop.
 * Offline agents are not in the office, working agents are at their desks.
 */
export default function WalkingAvatar({
  agent,
  status,
  visible = true,
  officeBounds,
  obstacles,
  otherAvatarPositions,
  onPositionUpdate,
}: WalkingAvatarProps) {
  const AVATAR_GROUND_Y = 0.3;
  const seed = getAgentSeed(agent.id);
  const speed = getAgentSpeed(seed);

  const groupRef = useRef<Group>(null);
  const movementState = useRef<MovementState>('walking');
  const targetRef = useRef<Vector3 | null>(null);
  const pauseUntilRef = useRef<number>(0);
  const variationRef = useRef<number>(0);
  const initializedRef = useRef(false);

  useFrame((frameState) => {
    if (!groupRef.current || !visible) return;

    const delta = frameState.clock.getDelta();
    const now = Date.now();
    const position = groupRef.current.position;

    // Initialize on first frame
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      // Start in a clear area - push far forward from desk and to the side
      const sideOffset = (seed % 2 === 0 ? -1 : 1) * 1.5;
      const forwardOffset = 3.5;
      position.set(
        agent.position[0] + sideOffset,
        0,
        agent.position[2] + forwardOffset
      );
      variationRef.current = now * 0.001;
      console.log(`[WalkingAvatar] ${agent.id} initialized at [${position.x.toFixed(2)}, ${position.z.toFixed(2)}]`);
    }

    // Only idle agents walk around
    if (status !== 'idle') {
      return;
    }

    // Pick initial destination
    if (!targetRef.current) {
      variationRef.current += 1;
      targetRef.current = pickDestination(seed, officeBounds, obstacles, variationRef.current);
      movementState.current = 'walking';
    }

    // State machine for idle agents
    if (movementState.current === 'paused') {
      if (now >= pauseUntilRef.current) {
        movementState.current = 'walking';
        variationRef.current += 10;
        targetRef.current = pickDestination(seed, officeBounds, obstacles, variationRef.current);
      } else {
        // Slight idle animation while paused
        position.y = Math.sin(frameState.clock.elapsedTime * 1.2 + seed) * 0.008;
        onPositionUpdate(agent.id, position.clone());
      }
      return;
    }

    // Walking state
    const direction = new Vector3().subVectors(targetRef.current, position);
    const distance = direction.length();

    if (distance > 0.3) {
      direction.normalize();

      // Smooth rotation towards target
      const targetRotation = Math.atan2(direction.x, direction.z);
      const rotationDiff = targetRotation - groupRef.current.rotation.y;
      const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
      groupRef.current.rotation.y += normalizedDiff * delta * 3;

      // Move towards target
      const moveVector = direction.clone().multiplyScalar(speed * delta);
      position.add(moveVector);
      position.y = 0;

      // Keep within bounds
      position.x = Math.max(officeBounds.minX + 0.5, Math.min(officeBounds.maxX - 0.5, position.x));
      position.z = Math.max(officeBounds.minZ + 0.5, Math.min(officeBounds.maxZ - 0.5, position.z));

      // Avoid obstacles
      for (const obstacle of obstacles) {
        const distToObstacle = position.distanceTo(obstacle.position);
        if (distToObstacle < obstacle.radius + 0.3) {
          const pushAway = position.clone().sub(obstacle.position).normalize();
          position.add(pushAway.multiplyScalar(obstacle.radius + 0.4 - distToObstacle));
        }
      }

      // Avoid other avatars
      for (const [otherId, otherPos] of otherAvatarPositions) {
        if (otherId === agent.id) continue;
        const distToOther = position.distanceTo(otherPos);
        if (distToOther < 1.0) {
          const pushAway = position.clone().sub(otherPos).normalize();
          position.add(pushAway.multiplyScalar(1.1 - distToOther));
        }
      }

      onPositionUpdate(agent.id, position.clone());
    } else {
      // Reached destination - pause for a bit
      movementState.current = 'paused';
      variationRef.current += 100;
      pauseUntilRef.current = now + getRandomPauseDuration(seed, variationRef.current);
      position.y = 0;
      onPositionUpdate(agent.id, position.clone());
    }
  });

  return (
    <group ref={groupRef} visible={visible}>
      <VoxelAvatar
        agent={agent}
        position={[0, AVATAR_GROUND_Y, 0]}
        isWorking={false}
        isThinking={false}
        isError={false}
        scale={1.5}
      />
    </group>
  );
}
