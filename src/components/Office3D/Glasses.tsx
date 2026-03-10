"use client";

import { Box } from "@react-three/drei";

export function Glasses() {
  return (
    <group position={[0, 0.03, 0.111]}>
      <Box args={[0.05, 0.03, 0.012]} position={[-0.05, 0, 0]}>
        <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.2} />
      </Box>
      <Box args={[0.05, 0.03, 0.012]} position={[0.05, 0, 0]}>
        <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.2} />
      </Box>
      <Box args={[0.025, 0.008, 0.01]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.2} />
      </Box>
    </group>
  );
}
