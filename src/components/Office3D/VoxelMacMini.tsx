'use client';

import { Box } from '@react-three/drei';

interface VoxelMacMiniProps {
  position: [number, number, number];
}

export default function VoxelMacMini({ position }: VoxelMacMiniProps) {
  return (
    <group position={position}>
      {/* Cuerpo principal (Mac mini - cuadrado bajo) */}
      <Box args={[0.2, 0.05, 0.2]} position={[0, 0.025, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.3} />
      </Box>

      {/* Borde superior */}
      <Box args={[0.21, 0.01, 0.21]} position={[0, 0.055, 0]} castShadow>
        <meshStandardMaterial color="#f3f4f6" metalness={0.6} roughness={0.2} />
      </Box>

      {/* Logo Apple (simple) */}
      <Box args={[0.04, 0.04, 0.01]} position={[0, 0.03, 0.105]} castShadow>
        <meshStandardMaterial color="#9ca3af" emissive="#6b7280" emissiveIntensity={0.3} />
      </Box>

      {/* Puertos frontales (pequeños rectángulos negros) */}
      <Box args={[0.015, 0.008, 0.005]} position={[-0.04, 0.03, 0.105]} castShadow>
        <meshStandardMaterial color="#1f2937" />
      </Box>
      <Box args={[0.015, 0.008, 0.005]} position={[-0.02, 0.03, 0.105]} castShadow>
        <meshStandardMaterial color="#1f2937" />
      </Box>

      {/* LED de encendido (verde) */}
      <Box args={[0.008, 0.008, 0.003]} position={[0.06, 0.03, 0.105]} castShadow>
        <meshStandardMaterial 
          color="#22c55e" 
          emissive="#15803d" 
          emissiveIntensity={0.8}
        />
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
            <meshStandardMaterial color="#1f2937" roughness={1} />
          </Box>
        ))
      )}
    </group>
  );
}
