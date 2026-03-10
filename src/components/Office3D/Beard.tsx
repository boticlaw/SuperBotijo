"use client";

import { Box } from "@react-three/drei";

interface BeardProps {
  color?: string;
}

export function Beard({ color = "#4a3728" }: BeardProps) {
  return (
    <Box args={[0.1, 0.04, 0.03]} position={[0, -0.05, 0.101]}>
      <meshStandardMaterial color={color} roughness={0.95} />
    </Box>
  );
}
