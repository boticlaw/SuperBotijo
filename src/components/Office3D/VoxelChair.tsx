'use client';

import { Box } from '@react-three/drei';

interface VoxelChairProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}

export default function VoxelChair({ 
  position, 
  rotation = [0, 0, 0],
  color = '#4a5568'
}: VoxelChairProps) {
  const baseColor = '#1f2937';
  const supportColor = '#2d3748';

  return (
    <group position={position} rotation={rotation}>
      {/* Seat cushion */}
      <Box args={[0.52, 0.1, 0.5]} position={[0, 0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </Box>

      {/* Backrest */}
      <Box args={[0.5, 0.46, 0.08]} position={[0, 0.74, -0.2]} castShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </Box>

      {/* Backrest support */}
      <Box args={[0.08, 0.18, 0.08]} position={[0, 0.57, -0.16]} castShadow>
        <meshStandardMaterial color={supportColor} metalness={0.25} roughness={0.6} />
      </Box>

      {/* Armrests */}
      <Box args={[0.08, 0.04, 0.32]} position={[-0.24, 0.52, -0.05]} castShadow>
        <meshStandardMaterial color={baseColor} roughness={0.65} />
      </Box>
      <Box args={[0.08, 0.04, 0.32]} position={[0.24, 0.52, -0.05]} castShadow>
        <meshStandardMaterial color={baseColor} roughness={0.65} />
      </Box>

      {/* Armrest supports */}
      <Box args={[0.05, 0.12, 0.05]} position={[-0.24, 0.46, -0.16]} castShadow>
        <meshStandardMaterial color={supportColor} metalness={0.2} />
      </Box>
      <Box args={[0.05, 0.12, 0.05]} position={[0.24, 0.46, -0.16]} castShadow>
        <meshStandardMaterial color={supportColor} metalness={0.2} />
      </Box>

      {/* Central column */}
      <Box args={[0.09, 0.26, 0.09]} position={[0, 0.17, 0]} castShadow>
        <meshStandardMaterial color={supportColor} metalness={0.45} roughness={0.45} />
      </Box>

      {/* Five-star base + wheels */}
      {[0, 72, 144, 216, 288].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const legLength = 0.28;
        const legX = Math.cos(rad) * (legLength / 2);
        const legZ = Math.sin(rad) * (legLength / 2);
        const wheelX = Math.cos(rad) * 0.3;
        const wheelZ = Math.sin(rad) * 0.3;

        return (
          <group key={i}>
            <Box
              args={[legLength, 0.04, 0.05]}
              position={[legX, 0.05, legZ]}
              rotation={[0, -rad, 0]}
              castShadow
            >
              <meshStandardMaterial color={supportColor} metalness={0.35} roughness={0.5} />
            </Box>

            <Box args={[0.08, 0.06, 0.06]} position={[wheelX, 0.02, wheelZ]} castShadow>
              <meshStandardMaterial color={baseColor} metalness={0.35} roughness={0.55} />
            </Box>
          </group>
        );
      })}
    </group>
  );
}
