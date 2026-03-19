"use client";

import { Box, Cylinder, Torus } from "@react-three/drei";

interface CoffeeMugProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function CoffeeMug({ position, rotation = [0, 0, 0] }: CoffeeMugProps) {
  return (
    <group position={position} rotation={rotation}>
      <Cylinder args={[0.08, 0.085, 0.1, 16]} position={[0, 0.05, 0]} receiveShadow>
        <meshStandardMaterial color="#f9fafb" roughness={0.7} />
      </Cylinder>

      <Cylinder args={[0.065, 0.07, 0.085, 16]} position={[0, 0.06, 0]}>
        <meshStandardMaterial color="#4b2e1f" roughness={0.95} />
      </Cylinder>

      <Torus args={[0.032, 0.008, 12, 20]} position={[0.085, 0.055, 0]} rotation={[0, Math.PI / 2, 0]}>
        <meshStandardMaterial color="#e5e7eb" roughness={0.7} />
      </Torus>

      <Box args={[0.09, 0.006, 0.09]} position={[0, 0.003, 0]}>
        <meshStandardMaterial color="#d1d5db" roughness={0.8} />
      </Box>
    </group>
  );
}
