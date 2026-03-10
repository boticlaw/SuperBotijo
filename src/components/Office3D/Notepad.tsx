"use client";

import { Box, Cylinder } from "@react-three/drei";

interface NotepadProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function Notepad({ position, rotation = [0, 0, 0] }: NotepadProps) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.24, 0.015, 0.18]} position={[0, 0.008, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#fefce8" roughness={0.85} />
      </Box>

      <Box args={[0.24, 0.005, 0.03]} position={[0, 0.02, -0.075]}>
        <meshStandardMaterial color="#9ca3af" roughness={0.6} />
      </Box>

      {[-0.08, -0.04, 0, 0.04, 0.08].map((x) => (
        <Cylinder key={`ring-${x}`} args={[0.008, 0.008, 0.02, 8]} position={[x, 0.02, -0.075]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#6b7280" metalness={0.35} roughness={0.35} />
        </Cylinder>
      ))}

      <Box args={[0.18, 0.002, 0.002]} position={[0, 0.017, 0.01]}>
        <meshStandardMaterial color="#d1d5db" />
      </Box>
      <Box args={[0.18, 0.002, 0.002]} position={[0, 0.017, 0.045]}>
        <meshStandardMaterial color="#d1d5db" />
      </Box>
    </group>
  );
}
