'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import VoxelAvatar from './VoxelAvatar';
import type { AgentConfig, AgentStatus } from './agentsConfig';

// Agent Energy Dashboard (coffee machine) — against the back wall at [8, 0, -9.7]
// Agents stop in front of it (within reachable bounds)
const COFFEE_MACHINE_POSITION: [number, number, number] = [8, 0, -9];
const COFFEE_ARRIVAL_RADIUS = 1.0;

// Safe walking zone (inside office bounds, away from walls)
const WALK_ZONE = { minX: -8, maxX: 8, minZ: -7, maxZ: 7 };

interface WalkingAvatarProps {
  agent: AgentConfig;
  status: AgentStatus;
  officeBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  obstacles: Array<{ position: Vector3; radius: number }>;
  otherAvatarPositions: { current: Map<string, Vector3> };
  onPositionUpdate: (id: string, pos: Vector3) => void;
}

/** Simple seeded pseudo-random number generator (Mulberry32) */
function createRng(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getStringHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function WalkingAvatar({
  agent,
  status,
  officeBounds,
  obstacles,
  otherAvatarPositions,
  onPositionUpdate
}: WalkingAvatarProps) {
  const AVATAR_GROUND_Y = 0.32;

  const seed = getStringHash(agent.id);
  const rngRef = useRef(createRng(seed));
  const groupRef = useRef<Group>(null);
  const targetRef = useRef<Vector3 | null>(null);
  const initializedRef = useRef(false);
  const pauseTimerRef = useRef(0);
  const isPausedRef = useRef(false);
  const idlePhase = useRef(((seed % 200) / 100 - 1) * Math.PI);
  const [arrivedAtCoffee, setArrivedAtCoffee] = useState(false);

  /** Pick a random point in the walking zone, biased toward the agent's home desk */
  const pickRandomTarget = () => {
    const rng = rngRef.current;
    // 30% chance to wander near home desk, 70% truly random
    const nearHome = rng() < 0.3;
    if (nearHome) {
      return new Vector3(
        agent.position[0] + (rng() - 0.5) * 4,
        0,
        agent.position[2] + (rng() - 0.5) * 4,
      );
    }
    return new Vector3(
      WALK_ZONE.minX + rng() * (WALK_ZONE.maxX - WALK_ZONE.minX),
      0,
      WALK_ZONE.minZ + rng() * (WALK_ZONE.maxZ - WALK_ZONE.minZ),
    );
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const rng = rngRef.current;
    const initialPosition = new Vector3(
      agent.position[0] + (rng() - 0.5) * 2,
      0,
      agent.position[2] + (rng() - 0.5) * 2,
    );
    if (groupRef.current) {
      groupRef.current.position.copy(initialPosition);
    }

    if (status === 'idle') {
      targetRef.current = pickRandomTarget();
    } else if (status === 'offline') {
      targetRef.current = new Vector3(...COFFEE_MACHINE_POSITION);
    }
  }, [agent.id, agent.position, status]);

  // Animation loop
  useFrame((_state, delta) => {
    if (!groupRef.current || !targetRef.current) return;

    if (status === 'idle' || status === 'offline') {
      // Handle pause (standing still, looking around)
      if (isPausedRef.current) {
        pauseTimerRef.current -= delta;
        if (pauseTimerRef.current <= 0) {
          isPausedRef.current = false;
          targetRef.current = status === 'offline'
            ? new Vector3(...COFFEE_MACHINE_POSITION)
            : pickRandomTarget();
        }
        // Gentle idle sway while paused
        groupRef.current.position.y =
          Math.sin(_state.clock.elapsedTime * 1.2 + idlePhase.current) * 0.008;
        onPositionUpdate(agent.id, groupRef.current.position.clone());
        return;
      }

      const speed = status === 'idle' ? 0.8 : 0.6;
      const direction = new Vector3().subVectors(targetRef.current, groupRef.current.position);
      direction.y = 0; // Keep movement horizontal
      const distance = direction.length();

      const arrivalDist = status === 'offline' ? COFFEE_ARRIVAL_RADIUS : 0.5;
      if (distance > arrivalDist) {
        // Set rotation from raw direction BEFORE scaling by delta
        groupRef.current.rotation.y = Math.atan2(direction.x, direction.z);

        direction.normalize();
        direction.multiplyScalar(speed * delta);
        groupRef.current.position.add(direction);

        // Check bounds — offline agents heading to coffee machine get extended Z range
        const minZ = status === 'offline' ? Math.min(officeBounds.minZ, COFFEE_MACHINE_POSITION[2] - 0.5) : officeBounds.minZ;
        groupRef.current.position.x = Math.max(officeBounds.minX, Math.min(officeBounds.maxX, groupRef.current.position.x));
        groupRef.current.position.z = Math.max(minZ, Math.min(officeBounds.maxZ, groupRef.current.position.z));

        // Check collisions with obstacles (skip when close to coffee machine target)
        const nearCoffee = status === 'offline' &&
          groupRef.current.position.distanceTo(new Vector3(...COFFEE_MACHINE_POSITION)) < COFFEE_ARRIVAL_RADIUS * 3;
        if (!nearCoffee) {
          for (const obstacle of obstacles) {
            const distToObstacle = groupRef.current.position.distanceTo(obstacle.position);
            if (distToObstacle < obstacle.radius) {
              const bounceDirection = new Vector3().subVectors(groupRef.current.position, obstacle.position).normalize();
              groupRef.current.position.add(bounceDirection.multiplyScalar(obstacle.radius - distToObstacle + 0.1));
            }
          }
        }

        // Check collisions with other avatars
        for (const [otherId, otherPos] of otherAvatarPositions.current) {
          if (otherId === agent.id) continue;
          const distToOther = groupRef.current.position.distanceTo(otherPos);
          if (distToOther < 1.2) {
            const bounceDirection = new Vector3().subVectors(groupRef.current.position, otherPos).normalize();
            groupRef.current.position.add(bounceDirection.multiplyScalar(1.2 - distToOther + 0.1));
          }
        }

        onPositionUpdate(agent.id, groupRef.current.position.clone());
      } else {
        // Reached target — decide: pause or pick new target
        const rng = rngRef.current;

        if (status === 'offline') {
          // Arrived at coffee machine — stop walking, face it
          if (!arrivedAtCoffee) setArrivedAtCoffee(true);
          groupRef.current.rotation.y = Math.atan2(
            COFFEE_MACHINE_POSITION[0] - groupRef.current.position.x,
            COFFEE_MACHINE_POSITION[2] - groupRef.current.position.z,
          );
          groupRef.current.position.y =
            Math.sin(_state.clock.elapsedTime * 1.5 + idlePhase.current) * 0.015;
          onPositionUpdate(agent.id, groupRef.current.position.clone());
        } else {
          // 50% chance to pause 2-5s before picking next target
          if (rng() < 0.5) {
            isPausedRef.current = true;
            pauseTimerRef.current = 2 + rng() * 3;
          } else {
            targetRef.current = pickRandomTarget();
          }
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Avatar */}
      <VoxelAvatar
        agent={agent}
        position={[0, AVATAR_GROUND_Y, 0]}
        isWorking={false}
        isThinking={false}
        isError={false}
        isWalking={!(status === 'offline' && arrivedAtCoffee)}
        scale={1.5}
      />
    </group>
  );
}
