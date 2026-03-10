'use client';

import { Box } from '@react-three/drei';

interface WindowProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number];
}

export default function Window({
  position,
  rotation = [0, 0, 0],
  size = [2.2, 1.6],
}: WindowProps) {
  const [width, height] = size;
  const frameWidth = 0.05;

  return (
    <group position={position} rotation={rotation}>
      <Box args={[width, height, 0.02]}>
        <meshStandardMaterial
          color="#87ceeb"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.1}
        />
      </Box>

      <Box args={[width + frameWidth * 2, frameWidth, 0.04]} position={[0, height / 2 + frameWidth / 2, 0]}>
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </Box>
      <Box args={[width + frameWidth * 2, frameWidth, 0.04]} position={[0, -height / 2 - frameWidth / 2, 0]}>
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </Box>
      <Box args={[frameWidth, height, 0.04]} position={[-width / 2 - frameWidth / 2, 0, 0]}>
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </Box>
      <Box args={[frameWidth, height, 0.04]} position={[width / 2 + frameWidth / 2, 0, 0]}>
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </Box>

      <Box args={[0.03, height, 0.02]} position={[0, 0, 0.01]}>
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </Box>
    </group>
  );
}
