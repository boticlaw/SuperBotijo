"use client";

import { Box } from "@react-three/drei";
import { MATERIALS } from "./materials";

interface DeskPhotoProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function DeskPhoto({ position, rotation = [0, 0, 0] }: DeskPhotoProps) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.18, 0.12, 0.015]} position={[0, 0.09, 0]} receiveShadow>
        <primitive object={MATERIALS.deskItems.photoFrame} attach="material" />
      </Box>

      <Box args={[0.145, 0.085, 0.008]} position={[0, 0.09, 0.01]}>
        <primitive object={MATERIALS.deskItems.photoImage} attach="material" />
      </Box>

      <Box args={[0.05, 0.08, 0.01]} position={[0, 0.035, -0.03]} rotation={[-0.5, 0, 0]}>
        <primitive object={MATERIALS.deskItems.photoStand} attach="material" />
      </Box>
    </group>
  );
}
