'use client';

import { Box } from '@react-three/drei';
import { MATERIALS } from './materials';

interface VoxelMacMiniProps {
  position: [number, number, number];
}

export default function VoxelMacMini({ position }: VoxelMacMiniProps) {
  return (
    <group position={position}>
      {/* Cuerpo principal (Mac mini - cuadrado bajo) */}
      <Box args={[0.2, 0.05, 0.2]} position={[0, 0.025, 0]} castShadow receiveShadow>
        <primitive object={MATERIALS.macMini.body} attach="material" />
      </Box>

      {/* Borde superior */}
      <Box args={[0.21, 0.01, 0.21]} position={[0, 0.055, 0]} castShadow>
        <primitive object={MATERIALS.macMini.top} attach="material" />
      </Box>

      {/* Logo Apple (simple) */}
      <Box args={[0.04, 0.04, 0.01]} position={[0, 0.03, 0.105]} castShadow>
        <primitive object={MATERIALS.macMini.logo} attach="material" />
      </Box>

      {/* Puertos frontales (pequeños rectángulos negros) */}
      <Box args={[0.015, 0.008, 0.005]} position={[-0.04, 0.03, 0.105]} castShadow>
        <primitive object={MATERIALS.macMini.port} attach="material" />
      </Box>
      <Box args={[0.015, 0.008, 0.005]} position={[-0.02, 0.03, 0.105]} castShadow>
        <primitive object={MATERIALS.macMini.port} attach="material" />
      </Box>

      {/* LED de encendido (verde) */}
      <Box args={[0.008, 0.008, 0.003]} position={[0.06, 0.03, 0.105]} castShadow>
        <primitive object={MATERIALS.macMini.led} attach="material" />
      </Box>

      {/* Base/patas de goma (4 esquinas) */}
      {[-0.08, 0.08].map(x => 
        [-0.08, 0.08].map((z) => (
          <Box
            key={`foot-${x}-${z}`}
            args={[0.03, 0.005, 0.03]}
            position={[x, 0.0025, z]}
            receiveShadow
          >
            <primitive object={MATERIALS.macMini.foot} attach="material" />
          </Box>
        ))
      )}
    </group>
  );
}
