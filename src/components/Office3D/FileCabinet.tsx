'use client';

import { useState } from 'react';
import { Box, Text } from '@react-three/drei';

interface FileCabinetProps {
  position: [number, number, number];
  onClick?: () => void;
}

export default function FileCabinet({ position, onClick }: FileCabinetProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      {/* Main body */}
      <Box
        args={[0.8, 1.2, 0.6]}
        position={[0, 0.6, 0]}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={hovered ? '#6b7280' : '#4b5563'}
          metalness={0.3}
          roughness={0.7}
        />
      </Box>

      {/* Drawer 1 (top) */}
      <Box
        args={[0.6, 0.15, 0.05]}
        position={[0, 1.0, 0.3]}
        castShadow
      >
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </Box>

      {/* Drawer 2 (middle) */}
      <Box
        args={[0.6, 0.15, 0.05]}
        position={[0, 0.6, 0.3]}
        castShadow
      >
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </Box>

      {/* Drawer 3 (bottom) */}
      <Box
        args={[0.6, 0.15, 0.05]}
        position={[0, 0.2, 0.3]}
        castShadow
      >
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </Box>

      {/* Handles */}
      {[1.0, 0.6, 0.2].map((y, i) => (
        <Box
          key={i}
          args={[0.15, 0.05, 0.05]}
          position={[0, y, 0.35]}
          castShadow
        >
          <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.2} />
        </Box>
      ))}

      {/* Label icon when hovered */}
      {hovered && (
        <Text
          position={[0, 1.4, 0]}
          fontSize={0.15}
          color="#fbbf24"
          anchorX="center"
          anchorY="middle"
        >
          📁 MEMORY
        </Text>
      )}
    </group>
  );
}
