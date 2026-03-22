"use client";

import { Box } from "@react-three/drei";
import { MATERIALS } from "./materials";

export function Glasses() {
  return (
    <group position={[0, 0.03, 0.111]}>
      <Box args={[0.05, 0.03, 0.012]} position={[-0.05, 0, 0]}>
        <primitive object={MATERIALS.glasses.frame} attach="material" />
      </Box>
      <Box args={[0.05, 0.03, 0.012]} position={[0.05, 0, 0]}>
        <primitive object={MATERIALS.glasses.frame} attach="material" />
      </Box>
      <Box args={[0.025, 0.008, 0.01]} position={[0, 0, 0]}>
        <primitive object={MATERIALS.glasses.frame} attach="material" />
      </Box>
    </group>
  );
}
