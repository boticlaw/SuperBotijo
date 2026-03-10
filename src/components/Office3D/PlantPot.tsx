"use client";

import { useRef } from "react";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const PLANT_SIZES = {
  small: "small",
  medium: "medium",
  large: "large",
} as const;

const PLANT_TYPES = {
  bush: "bush",
  tree: "tree",
  succulent: "succulent",
} as const;

const TYPE_SCALE = {
  bush: 1,
  tree: 1.15,
  succulent: 0.9,
} as const;

const FOLIAGE_BASE_Y = {
  bush: 0.22,
  tree: 0.2,
  succulent: 0.21,
} as const;

interface PlantPotProps {
  position: [number, number, number];
  size?: (typeof PLANT_SIZES)[keyof typeof PLANT_SIZES];
  type?: (typeof PLANT_TYPES)[keyof typeof PLANT_TYPES];
}

export default function PlantPot({
  position,
  size = PLANT_SIZES.medium,
  type = PLANT_TYPES.bush,
}: PlantPotProps) {
  const foliageRef = useRef<Group>(null);
  const swayOffset = position[0] * 0.11 + position[2] * 0.07;
  const scale = size === PLANT_SIZES.small ? 0.6 : size === PLANT_SIZES.large ? 1.4 : 1;
  const typeScale = TYPE_SCALE[type];
  const foliageBaseY = FOLIAGE_BASE_Y[type];

  useFrame((state) => {
    if (!foliageRef.current) {
      return;
    }

    foliageRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.45 + swayOffset) * 0.02;
    foliageRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6 + swayOffset + 1.2) * 0.015;
  });

  return (
    <group position={position} scale={scale * typeScale}>
      <group position={[0, 0.1, 0]}>
        <Cylinder args={[0.12, 0.1, 0.2, 16]} castShadow receiveShadow>
          <meshStandardMaterial color="#8b4513" roughness={0.9} />
        </Cylinder>
        <Cylinder args={[0.1, 0.1, 0.05, 16]} position={[0, 0.08, 0]}>
          <meshStandardMaterial color="#3d2817" roughness={1} />
        </Cylinder>
      </group>

      <group ref={foliageRef} position={[0, foliageBaseY, 0]}>
        {type === PLANT_TYPES.bush && (
          <>
            <Box args={[0.035, 0.08, 0.035]} position={[0, 0.03, 0]} castShadow>
              <meshStandardMaterial color="#2d5016" roughness={0.95} />
            </Box>
            <Sphere args={[0.17, 14, 14]} position={[0, 0.14, 0]} castShadow>
              <meshStandardMaterial color="#22c55e" roughness={0.8} />
            </Sphere>
            <Sphere args={[0.12, 12, 12]} position={[0.11, 0.2, 0.06]} castShadow>
              <meshStandardMaterial color="#1ea54e" roughness={0.8} />
            </Sphere>
            <Sphere args={[0.11, 12, 12]} position={[-0.1, 0.21, -0.06]} castShadow>
              <meshStandardMaterial color="#2dd46a" roughness={0.8} />
            </Sphere>
          </>
        )}

        {type === PLANT_TYPES.tree && (
          <>
            <Box args={[0.05, 0.26, 0.05]} position={[0, 0.14, 0]} castShadow>
              <meshStandardMaterial color="#5b3a1f" roughness={0.95} />
            </Box>
            <Sphere args={[0.18, 14, 14]} position={[0, 0.35, 0]} castShadow>
              <meshStandardMaterial color="#22c55e" roughness={0.85} />
            </Sphere>
            <Sphere args={[0.11, 12, 12]} position={[0.11, 0.33, 0.04]} castShadow>
              <meshStandardMaterial color="#16a34a" roughness={0.85} />
            </Sphere>
          </>
        )}

        {type === PLANT_TYPES.succulent && (
          <>
            <Box args={[0.03, 0.05, 0.03]} position={[0, 0.03, 0]} castShadow>
              <meshStandardMaterial color="#2d5016" roughness={0.95} />
            </Box>
            <Sphere args={[0.1, 12, 12]} position={[0, 0.12, 0]} castShadow>
              <meshStandardMaterial color="#34d399" roughness={0.75} />
            </Sphere>
            <Sphere args={[0.065, 10, 10]} position={[0.08, 0.13, 0.02]} castShadow>
              <meshStandardMaterial color="#10b981" roughness={0.75} />
            </Sphere>
            <Sphere args={[0.065, 10, 10]} position={[-0.08, 0.13, -0.02]} castShadow>
              <meshStandardMaterial color="#059669" roughness={0.75} />
            </Sphere>
            <Sphere args={[0.055, 10, 10]} position={[0, 0.19, -0.06]} castShadow>
              <meshStandardMaterial color="#2dd4bf" roughness={0.75} />
            </Sphere>
          </>
        )}
      </group>
    </group>
  );
}
