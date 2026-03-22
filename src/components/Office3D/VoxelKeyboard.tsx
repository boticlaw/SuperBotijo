'use client';

import { Box } from '@react-three/drei';
import { MATERIALS } from './materials';

interface VoxelKeyboardProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function VoxelKeyboard({ position, rotation = [0, 0, 0] }: VoxelKeyboardProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* Base del teclado */}
      <Box args={[0.8, 0.04, 0.3]} position={[0, 0, 0]} castShadow receiveShadow>
        <primitive object={MATERIALS.plastics.keyboard} attach="material" />
      </Box>

      {/* Fila de teclas - superior (números) */}
      {Array.from({ length: 10 }).map((_, i) => (
        <Box
          key={`top-${i}`}
          args={[0.06, 0.03, 0.06]}
          position={[-0.32 + i * 0.072, 0.035, -0.08]}
        >
          <primitive object={MATERIALS.plastics.keycaps} attach="material" />
        </Box>
      ))}

      {/* Fila de teclas - media (QWERTY) */}
      {Array.from({ length: 9 }).map((_, i) => (
        <Box
          key={`mid-${i}`}
          args={[0.06, 0.03, 0.06]}
          position={[-0.28 + i * 0.072, 0.035, -0.01]}
        >
          <primitive object={MATERIALS.plastics.keycaps} attach="material" />
        </Box>
      ))}

      {/* Fila de teclas - inferior (ASDF) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Box
          key={`low-${i}`}
          args={[0.06, 0.03, 0.06]}
          position={[-0.24 + i * 0.072, 0.035, 0.06]}
        >
          <primitive object={MATERIALS.plastics.keycaps} attach="material" />
        </Box>
      ))}

      {/* Barra espaciadora */}
      <Box args={[0.35, 0.03, 0.06]} position={[0, 0.035, 0.13]}>
        <primitive object={MATERIALS.plastics.spacebar} attach="material" />
      </Box>

      {/* Cable */}
      <Box args={[0.02, 0.02, 0.15]} position={[0.35, -0.01, 0.22]}>
        <primitive object={MATERIALS.plastics.dark} attach="material" />
      </Box>
    </group>
  );
}
