"use client";

import { Box, Cylinder } from "@react-three/drei";
import { MATERIALS } from "./materials";

interface DeskPlantProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function DeskPlant({ position, rotation = [0, 0, 0] }: DeskPlantProps) {
  return (
    <group position={position} rotation={rotation}>
      <Cylinder args={[0.09, 0.07, 0.12, 10]} position={[0, 0.06, 0]} receiveShadow>
        <primitive object={MATERIALS.plants.deskPot} attach="material" />
      </Cylinder>

      <Cylinder args={[0.08, 0.08, 0.025, 10]} position={[0, 0.12, 0]}>
        <primitive object={MATERIALS.plants.deskSoil} attach="material" />
      </Cylinder>

      <Box args={[0.03, 0.12, 0.03]} position={[0, 0.2, 0]}>
        <primitive object={MATERIALS.plants.stem} attach="material" />
      </Box>

      <Box args={[0.14, 0.03, 0.08]} position={[0.07, 0.22, 0]} rotation={[0, 0, 0.35]}>
        <primitive object={MATERIALS.plants.leaf1} attach="material" />
      </Box>
      <Box args={[0.14, 0.03, 0.08]} position={[-0.07, 0.25, 0]} rotation={[0, 0, -0.35]}>
        <primitive object={MATERIALS.plants.leaf2} attach="material" />
      </Box>
      <Box args={[0.12, 0.03, 0.09]} position={[0, 0.28, 0.05]} rotation={[-0.3, 0, 0]}>
        <primitive object={MATERIALS.plants.leaf1} attach="material" />
      </Box>
    </group>
  );
}
