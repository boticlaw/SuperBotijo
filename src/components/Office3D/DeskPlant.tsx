"use client";

import { Box, Cylinder } from "@react-three/drei";

interface DeskPlantProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function DeskPlant({ position, rotation = [0, 0, 0] }: DeskPlantProps) {
  return (
    <group position={position} rotation={rotation}>
      <Cylinder args={[0.09, 0.07, 0.12, 10]} position={[0, 0.06, 0]} receiveShadow>
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </Cylinder>

      <Cylinder args={[0.08, 0.08, 0.025, 10]} position={[0, 0.12, 0]}>
        <meshStandardMaterial color="#4a2a1a" roughness={1} />
      </Cylinder>

      <Box args={[0.03, 0.12, 0.03]} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#166534" />
      </Box>

      <Box args={[0.14, 0.03, 0.08]} position={[0.07, 0.22, 0]} rotation={[0, 0, 0.35]}>
        <meshStandardMaterial color="#22c55e" />
      </Box>
      <Box args={[0.14, 0.03, 0.08]} position={[-0.07, 0.25, 0]} rotation={[0, 0, -0.35]}>
        <meshStandardMaterial color="#16a34a" />
      </Box>
      <Box args={[0.12, 0.03, 0.09]} position={[0, 0.28, 0.05]} rotation={[-0.3, 0, 0]}>
        <meshStandardMaterial color="#22c55e" />
      </Box>
    </group>
  );
}
