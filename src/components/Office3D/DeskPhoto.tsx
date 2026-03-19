"use client";

import { Box } from "@react-three/drei";

interface DeskPhotoProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function DeskPhoto({ position, rotation = [0, 0, 0] }: DeskPhotoProps) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.18, 0.12, 0.015]} position={[0, 0.09, 0]} receiveShadow>
        <meshStandardMaterial color="#374151" roughness={0.7} />
      </Box>

      <Box args={[0.145, 0.085, 0.008]} position={[0, 0.09, 0.01]}>
        <meshStandardMaterial color="#e0f2fe" emissive="#0ea5e9" emissiveIntensity={0.08} />
      </Box>

      <Box args={[0.05, 0.08, 0.01]} position={[0, 0.035, -0.03]} rotation={[-0.5, 0, 0]}>
        <meshStandardMaterial color="#1f2937" roughness={0.8} />
      </Box>
    </group>
  );
}
