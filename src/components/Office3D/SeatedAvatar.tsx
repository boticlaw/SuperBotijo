"use client";

import VoxelAvatar from "./VoxelAvatar";
import type { AgentConfig, AgentStatus } from "./agentsConfig";

interface SeatedAvatarProps {
  agent: AgentConfig;
  status: AgentStatus;
  scale?: number;
}

const STATUS_ANIMATIONS = {
  working: { isWorking: true, isThinking: false, isError: false },
  thinking: { isWorking: false, isThinking: true, isError: false },
  error: { isWorking: false, isThinking: false, isError: true },
  online: { isWorking: false, isThinking: false, isError: false },
  idle: { isWorking: false, isThinking: false, isError: false },
  offline: { isWorking: false, isThinking: false, isError: false },
} as const;

/**
 * SeatedAvatar - Avatar positioned on chair, no movement
 * Position relative to desk group: [0, 0.7, 0.9]
 * - z=0.9: same as chair position
 * - y=0.7: seated on chair seat (chair seat at y=0.4*2=0.8, avatar pivot at y≈0.1)
 * - rotation Y=PI: facing monitor (not the chair back)
 */
export function SeatedAvatar({ agent, status, scale = 1.5 }: SeatedAvatarProps) {
  const animations = STATUS_ANIMATIONS[status] || STATUS_ANIMATIONS.offline;

  return (
    <group position={[0, 0.7, 0.9]} rotation={[0, Math.PI, 0]} scale={scale}>
      <VoxelAvatar
        agent={agent}
        position={[0, 0, 0]}
        isWorking={animations.isWorking}
        isThinking={animations.isThinking}
        isError={animations.isError}
      />
    </group>
  );
}
