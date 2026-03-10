'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import VoxelAvatar from './VoxelAvatar';
import { AgentLabel } from './AgentLabel';
import type { AgentConfig, AgentStatus } from './agentsConfig';

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
  otherAvatarPositions: Map<string, Vector3>;
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
  const groupRef = useRef<Group>(null);
  const [position, setPosition] = useState(new Vector3(
    agent.position[0], 
    0, 
    agent.position[2] + (Math.random() - 0.5) * 2
  ));
  const [targetPosition, setTargetPosition] = useState<Vector3 | null>(null);
  
  // Initialize target position (random position near desk)
  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 4;
    const targetX = agent.position[0] + Math.cos(angle) * distance;
    const targetZ = agent.position[2] + Math.sin(angle) * distance;
    setTargetPosition(new Vector3(targetX, 0, targetZ));
  }, [agent.position]);

  // Animation loop
  useFrame((frameState) => {
    if (!groupRef.current || !targetPosition) return;
    
    const delta = frameState.clock.getDelta();
    
    // Update position based on status
    if (status === 'idle' || status === 'offline') {
      // Idle/offline: slow walking animation
      const speed = status === 'idle' ? 0.8 : 0.4;
      
      // Random direction change every 2-8 seconds
      if (Math.random() < 0.001) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 3 + Math.random() * 4;
        const targetX = agent.position[0] + Math.cos(angle) * distance;
        const targetZ = agent.position[2] + Math.sin(angle) * distance;
        setTargetPosition(new Vector3(targetX, 0, targetZ));
      }
      
      // Move towards target
      if (targetPosition) {
        const direction = new Vector3().subVectors(targetPosition, groupRef.current.position);
        const distance = direction.length();
        
        if (distance > 0.5) {
          direction.normalize();
          direction.multiplyScalar(speed * delta);
          groupRef.current.position.add(direction);
          
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
          for (const [otherId, otherPos] of otherAvatarPositions) {
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
      }
    }
  });
  
  // Don't render if offline
  if (status === 'offline') {
    return null;
  }
  
  return (
    <group ref={groupRef}>
      {/* Avatar */}
      <VoxelAvatar
        agent={agent}
        position={[0, 0, 0]}
        isWorking={status === 'working'}
        isThinking={status === 'thinking'}
        isError={status === 'error'}
        scale={1.5}
      />
      
      {/* Label billboard */}
      <AgentLabel
        agent={agent}
        status={status}
      />
    </group>
  );
}
