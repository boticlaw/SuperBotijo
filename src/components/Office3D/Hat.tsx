"use client";

import { Box, Sphere } from "@react-three/drei";

import { AVATAR_HAT_TYPES } from "./agentsConfig";

interface HatProps {
  style: (typeof AVATAR_HAT_TYPES)[keyof typeof AVATAR_HAT_TYPES];
  color?: string;
}

export function Hat({ style, color = "#3b82f6" }: HatProps) {
  if (style === AVATAR_HAT_TYPES.none) {
    return null;
  }

  if (style === AVATAR_HAT_TYPES.beanie) {
    return (
      <group position={[0, 0.14, 0]}>
        <Sphere args={[0.11, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]}>
          <meshStandardMaterial color={color} roughness={0.8} dispose={null} />
        </Sphere>
        <Box args={[0.2, 0.02, 0.2]} position={[0, -0.015, 0]}>
          <meshStandardMaterial color={color} roughness={0.85} dispose={null} />
        </Box>
      </group>
    );
  }

  return (
    <group position={[0, 0.14, 0.02]}>
      <Sphere args={[0.1, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]}>
        <meshStandardMaterial color={color} roughness={0.75} dispose={null} />
      </Sphere>
      <Box args={[0.13, 0.012, 0.08]} position={[0, -0.02, 0.085]} rotation={[0.25, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.75} dispose={null} />
      </Box>
    </group>
  );
}
