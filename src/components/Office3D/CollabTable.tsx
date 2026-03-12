'use client';

import { Box } from '@react-three/drei';

interface CollabTableProps {
  position: [number, number, number];
}

export function CollabTable({ position }: CollabTableProps) {
  return (
    <group position={position}>
      <Box args={[3.2, 0.12, 1.5]} position={[0, 0.78, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#5a4337" roughness={0.7} />
      </Box>

      {[
        [-1.45, 0.36, -0.62],
        [1.45, 0.36, -0.62],
        [-1.45, 0.36, 0.62],
        [1.45, 0.36, 0.62],
      ].map(([x, y, z], index) => (
        <Box key={`table-leg-${index}`} args={[0.1, 0.72, 0.1]} position={[x, y, z]} castShadow>
          <meshStandardMaterial color="#4a352b" roughness={0.72} />
        </Box>
      ))}
    </group>
  );
}
