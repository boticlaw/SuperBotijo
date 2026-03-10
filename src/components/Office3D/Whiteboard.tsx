'use client';

import { useState } from 'react';
import { Box, Text } from '@react-three/drei';

interface WhiteboardProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  onClick?: () => void;
}

const KANBAN_COLUMNS = [
  {
    title: 'TODO',
    color: '#3b82f6',
    x: -0.75,
    items: [
      { text: 'Windows + natural light', color: '#6b7280' },
      { text: 'Bloom pass', color: '#6b7280' },
    ],
  },
  {
    title: 'DOING',
    color: '#f59e0b',
    x: 0,
    items: [
      { text: 'Office 3D polish', color: '#22c55e' },
      { text: 'Avatar idle routes', color: '#22c55e' },
    ],
  },
  {
    title: 'DONE',
    color: '#22c55e',
    x: 0.75,
    items: [
      { text: 'Ceiling', color: '#16a34a' },
      { text: 'Desk decor', color: '#16a34a' },
      { text: 'Monitor content', color: '#16a34a' },
    ],
  },
] as const;

export default function Whiteboard({ position, rotation = [0, 0, 0], onClick }: WhiteboardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position} rotation={rotation}>
      {/* Board surface */}
      <Box
        args={[2.5, 1.5, 0.1]}
        position={[0, 1.5, 0]}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={hovered ? '#f0f0f0' : '#ffffff'}
          emissive={hovered ? '#fbbf24' : '#000000'}
          emissiveIntensity={hovered ? 0.1 : 0}
        />
      </Box>

      {/* Frame */}
      <Box args={[2.6, 1.6, 0.08]} position={[0, 1.5, -0.05]}>
        <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.6} />
      </Box>

      {/* Marker tray */}
      <Box args={[2.3, 0.1, 0.15]} position={[0, 0.7, 0.05]} castShadow>
        <meshStandardMaterial color="#6b7280" />
      </Box>

      {/* Markers */}
      {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
        <group key={i} position={[x, 0.75, 0.1]}>
          <Box args={[0.08, 0.3, 0.08]} castShadow>
            <meshStandardMaterial
              color={['#ef4444', '#3b82f6', '#22c55e', '#eab308'][i]}
            />
          </Box>
          {/* Cap */}
          <Box args={[0.09, 0.08, 0.09]} position={[0, 0.17, 0]} castShadow>
            <meshStandardMaterial color="#1f2937" />
          </Box>
        </group>
      ))}

      {/* "ROADMAP" text on board */}
      <Text
        position={[0, 2.08, 0.06]}
        fontSize={0.13}
        color="#1f2937"
        anchorX="center"
        anchorY="middle"
      >
        ROADMAP Q1 - OFFICE 3D
      </Text>

      {/* Kanban-like content */}
      {KANBAN_COLUMNS.map((column) => (
        <group key={column.title} position={[column.x, 1.48, 0.06]}>
          <Text
            position={[0, 0.42, 0]}
            fontSize={0.065}
            color={column.color}
            anchorX="center"
            anchorY="middle"
          >
            {column.title}
          </Text>

          <Box args={[0.55, 0.01, 0.01]} position={[0, 0.37, 0]}>
            <meshStandardMaterial color={column.color} />
          </Box>

          {column.items.map((item, index) => (
            <Text
              key={`${column.title}-item-${index}`}
              position={[-0.24, 0.24 - index * 0.13, 0]}
              fontSize={0.047}
              color={item.color}
              anchorX="left"
              anchorY="middle"
            >
              • {item.text}
            </Text>
          ))}
        </group>
      ))}

      {/* Progress arrows */}
      <Box args={[0.18, 0.008, 0.01]} position={[-0.38, 1.35, 0.06]}>
        <meshStandardMaterial color="#9ca3af" />
      </Box>
      <Box args={[0.18, 0.008, 0.01]} position={[0.38, 1.35, 0.06]}>
        <meshStandardMaterial color="#9ca3af" />
      </Box>

      {/* Hover label */}
      {hovered && (
        <Text
          position={[0, 2.5, 0.1]}
          fontSize={0.12}
          color="#fbbf24"
          anchorX="center"
          anchorY="middle"
        >
          📋 Click to view
        </Text>
      )}
    </group>
  );
}
