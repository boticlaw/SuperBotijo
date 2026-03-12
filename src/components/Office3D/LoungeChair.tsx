'use client';

import { Box } from '@react-three/drei';

interface LoungeChairProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  variant?: LoungeChairVariant;
}

const LOUNGE_CHAIR_VARIANT = {
  task: "task",
  executive: "executive",
  lounge: "lounge",
} as const;

type LoungeChairVariant = (typeof LOUNGE_CHAIR_VARIANT)[keyof typeof LOUNGE_CHAIR_VARIANT];

export function LoungeChair({
  position,
  rotation = [0, 0, 0],
  color = '#1f2937',
  variant = LOUNGE_CHAIR_VARIANT.task,
}: LoungeChairProps) {
  const variantConfig = {
    [LOUNGE_CHAIR_VARIANT.task]: {
      seatHeight: 0.42,
      backHeight: 0.44,
      backColor: "#334155",
      armHeight: 0.34,
      armColor: "#475569",
      pillow: false,
    },
    [LOUNGE_CHAIR_VARIANT.executive]: {
      seatHeight: 0.45,
      backHeight: 0.56,
      backColor: "#1e293b",
      armHeight: 0.38,
      armColor: "#334155",
      pillow: true,
    },
    [LOUNGE_CHAIR_VARIANT.lounge]: {
      seatHeight: 0.38,
      backHeight: 0.38,
      backColor: "#3f4b5c",
      armHeight: 0.28,
      armColor: "#5b6575",
      pillow: true,
    },
  }[variant];

  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.56, 0.1, 0.56]} position={[0, variantConfig.seatHeight, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.65} />
      </Box>
      <Box args={[0.56, variantConfig.backHeight, 0.1]} position={[0, 0.42 + variantConfig.backHeight / 2, -0.23]} castShadow>
        <meshStandardMaterial color={variantConfig.backColor} roughness={0.62} />
      </Box>
      <Box args={[0.08, variantConfig.armHeight, 0.48]} position={[-0.24, 0.42 + variantConfig.armHeight / 2, 0]} castShadow>
        <meshStandardMaterial color={variantConfig.armColor} roughness={0.7} />
      </Box>
      <Box args={[0.08, variantConfig.armHeight, 0.48]} position={[0.24, 0.42 + variantConfig.armHeight / 2, 0]} castShadow>
        <meshStandardMaterial color={variantConfig.armColor} roughness={0.7} />
      </Box>

      {variantConfig.pillow && (
        <Box args={[0.28, 0.08, 0.2]} position={[0, variantConfig.seatHeight + 0.08, -0.08]} castShadow>
          <meshStandardMaterial color="#94a3b8" roughness={0.55} />
        </Box>
      )}
    </group>
  );
}
