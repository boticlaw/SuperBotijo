"use client";

import { useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { SeatedAvatar } from "./SeatedAvatar";
import type { AgentConfig, AgentStatus } from "./agentsConfig";

interface ClickableAvatarProps {
  agent: AgentConfig;
  status: AgentStatus;
  onClick: () => void;
  isSelected?: boolean;
  scale?: number;
}

/**
 * ClickableAvatar - Wrapper with onClick and hover effects
 * Provides glow effect on hover/selection and forwards clicks
 */
export function ClickableAvatar({
  agent,
  status,
  onClick,
  isSelected = false,
  scale = 1.5,
}: ClickableAvatarProps) {
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef<Mesh>(null);

  // Animate glow pulse when selected
  useFrame((state) => {
    if (glowRef.current && isSelected) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Hover/Selection glow ring on floor - under avatar at z=0.9 */}
      {(hovered || isSelected) && (
        <mesh
          ref={glowRef}
          position={[0, 0.01, 0.9]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.3, 0.5, 32]} />
          <meshBasicMaterial
            color={isSelected ? agent.color : "#ffffff"}
            transparent
            opacity={isSelected ? 0.6 : 0.3}
          />
        </mesh>
      )}

      {/* Seated avatar (includes AgentLabel inside) */}
      <SeatedAvatar agent={agent} status={status} scale={scale} />
    </group>
  );
}
