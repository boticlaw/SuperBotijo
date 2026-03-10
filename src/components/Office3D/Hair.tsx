"use client";

import { Box, Cone } from "@react-three/drei";

import { AVATAR_HAIR_TYPES } from "./agentsConfig";

interface HairProps {
  style: (typeof AVATAR_HAIR_TYPES)[keyof typeof AVATAR_HAIR_TYPES];
  color?: string;
}

export function Hair({ style, color = "#4a3728" }: HairProps) {
  if (style === AVATAR_HAIR_TYPES.none) {
    return null;
  }

  if (style === AVATAR_HAIR_TYPES.short) {
    return (
      <Box args={[0.18, 0.04, 0.18]} position={[0, 0.12, 0]}>
        <meshStandardMaterial color={color} roughness={0.95} />
      </Box>
    );
  }

  if (style === AVATAR_HAIR_TYPES.long) {
    return (
      <group>
        <Box args={[0.2, 0.05, 0.2]} position={[0, 0.12, 0]}>
          <meshStandardMaterial color={color} roughness={0.95} />
        </Box>
        <Box args={[0.18, 0.1, 0.05]} position={[0, 0.05, -0.08]}>
          <meshStandardMaterial color={color} roughness={0.95} />
        </Box>
      </group>
    );
  }

  return (
    <group>
      {[-0.06, -0.02, 0.02, 0.06].map((x, index) => (
        <Cone
          key={`spike-${index}`}
          args={[0.022, 0.08, 4]}
          position={[x, 0.15, index % 2 === 0 ? 0.02 : -0.02]}
          rotation={[0.2, 0, x * 2]}
        >
          <meshStandardMaterial color={color} roughness={0.9} />
        </Cone>
      ))}
    </group>
  );
}
