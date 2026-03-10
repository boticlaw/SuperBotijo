'use client';
 
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
import VoxelAvatar from './VoxelAvatar';
import type { AgentConfig, AgentStatus } from './agentsConfig';
 
const WATER_STATION_POSITION: [number, number, number] = [7.1, 0, -4.3];
const IDLE_WAYPOINTS: [number, number, number][] = [
  [-7.5, 0, 5.5],
  [-6.5, 0, -4.2],
  [0, 0, -6.8],
  [6.8, 0, -4.2],
  [7.5, 0, 5.5],
  [0, 0, 6.8],
];
 
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
 
export default function WalkingAvatar({ 
  agent, 
  status, 
  officeBounds, 
  obstacles, 
  otherAvatarPositions,
  onPositionUpdate 
}: WalkingAvatarProps) {
  const AVATAR_GROUND_Y = 0.22;
 
  const getStableOffset = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return (hash % 200) / 100 - 1;
  };
 
  const offset = getStableOffset(agent.id);
  const initialWaypointIndex = Math.abs(Math.floor(offset * 1000)) % IDLE_WAYPOINTS.length;
 
  const groupRef = useRef<Group>(null);
  const idlePhase = useRef(offset * Math.PI);
  const idleWaypointIndex = useRef(initialWaypointIndex);
  const targetRef = useRef<Vector3 | null>(null);
  const initializedRef = useRef(false);
 
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
 
    const initialPosition = new Vector3(
      agent.position[0] + offset,
      0,
      agent.position[2] + offset * 0.7
    );
    if (groupRef.current) {
      groupRef.current.position.copy(initialPosition);
    }
 
    if (status === 'idle') {
      targetRef.current = new Vector3(...IDLE_WAYPOINTS[idleWaypointIndex.current]);
    } else if (status === 'offline') {
      targetRef.current = new Vector3(...WATER_STATION_POSITION);
    }
  }, [agent.id, agent.position, offset, status]);
 
  // Animation loop
  useFrame((frameState) => {
    if (!groupRef.current || !targetRef.current) return;
    
    const delta = frameState.clock.getDelta();
    
    // Update position based on status
    if (status === 'idle' || status === 'offline') {
      // Idle/offline: slow walking animation
      const speed = status === 'idle' ? 0.8 : 0.6;
      
      // Move towards target
      const direction = new Vector3().subVectors(targetRef.current, groupRef.current.position);
      const distance = direction.length();
      
      if (distance > 0.5) {
        direction.normalize();
        direction.multiplyScalar(speed * delta);
        groupRef.current.position.add(direction);
        groupRef.current.rotation.y = Math.atan2(direction.x, direction.z);
        
        // Check bounds
        groupRef.current.position.x = Math.max(officeBounds.minX, Math.min(officeBounds.maxX, groupRef.current.position.x));
        groupRef.current.position.z = Math.max(officeBounds.minZ, Math.min(officeBounds.maxZ, groupRef.current.position.z));
        
        // Check collisions with obstacles
        for (const obstacle of obstacles) {
          const distToObstacle = groupRef.current.position.distanceTo(obstacle.position);
          if (distToObstacle < obstacle.radius) {
            // Bounce back
            const bounceDirection = new Vector3().subVectors(groupRef.current.position, obstacle.position).normalize();
            groupRef.current.position.add(bounceDirection.multiplyScalar(obstacle.radius - distToObstacle + 0.1));
          }
        }
        
        // Check collisions with other avatars
        for (const [otherId, otherPos] of otherAvatarPositions.current) {
          if (otherId === agent.id) continue;
          const distToOther = groupRef.current.position.distanceTo(otherPos);
          if (distToOther < 1.2) {
            // Step back
            const bounceDirection = new Vector3().subVectors(groupRef.current.position, otherPos).normalize();
            groupRef.current.position.add(bounceDirection.multiplyScalar(1.2 - distToOther + 0.1));
          }
        }
        
        // Notify parent of position update
        onPositionUpdate(agent.id, groupRef.current.position.clone());
      }
 
      if (status === 'offline' && distance <= 0.5) {
        groupRef.current.rotation.y = Math.atan2(
          WATER_STATION_POSITION[0] - groupRef.current.position.x,
          WATER_STATION_POSITION[2] - groupRef.current.position.z
        );
        groupRef.current.position.y = Math.sin(frameState.clock.elapsedTime * 1.5 + idlePhase.current) * 0.015;
        onPositionUpdate(agent.id, groupRef.current.position.clone());
      } else if (status === 'idle' && distance <= 0.5) {
        idleWaypointIndex.current =
          (idleWaypointIndex.current + 1) % IDLE_WAYPOINTS.length;
        targetRef.current = new Vector3(...IDLE_WAYPOINTS[idleWaypointIndex.current]);
 
        groupRef.current.position.y =
          Math.sin(frameState.clock.elapsedTime * 1.2 + idlePhase.current) * 0.008;
        onPositionUpdate(agent.id, groupRef.current.position.clone());
      } else {
        groupRef.current.position.y = 0;
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
        scale={1.5}
      />
    </group>
  );
}