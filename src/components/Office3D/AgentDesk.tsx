'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import type { Mesh } from 'three';
import type { AgentConfig, AgentState } from './agentsConfig';
import VoxelChair from './VoxelChair';
import VoxelKeyboard from './VoxelKeyboard';
import VoxelMacMini from './VoxelMacMini';
import { ClickableAvatar } from './ClickableAvatar';

interface AgentDeskProps {
  agent: AgentConfig;
  state: AgentState;
  onClick: () => void;
  isSelected: boolean;
}

export default function AgentDesk({ agent, state, onClick, isSelected }: AgentDeskProps) {
  const deskRef = useRef<Mesh>(null);
  const monitorRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Animación de pulsación para estado "thinking"
  useFrame((frameState) => {
    if (monitorRef.current && state.status === 'thinking') {
      monitorRef.current.scale.setScalar(1 + Math.sin(frameState.clock.elapsedTime * 2) * 0.05);
    }
  });

  const getStatusColor = () => {
    switch (state.status) {
      case 'working':
        return '#22c55e'; // green-500
      case 'online':
        return '#4ade80'; // green-400
      case 'thinking':
        return '#3b82f6'; // blue-500
      case 'error':
        return '#ef4444'; // red-500
      case 'idle':
        return '#eab308'; // yellow-500
      case 'offline':
      default:
        return '#6b7280'; // gray-500
    }
  };

  const getMonitorEmissive = () => {
    switch (state.status) {
      case 'working':
        return '#15803d'; // darker green
      case 'online':
        return '#166534'; // darker green-400
      case 'thinking':
        return '#1e40af'; // darker blue
      case 'error':
        return '#991b1b'; // darker red
      case 'idle':
        return '#a16207'; // darker yellow
      case 'offline':
      default:
        return '#374151'; // darker gray
    }
  };

  return (
    <group position={agent.position}>
      {/* Desk surface */}
      <Box
        ref={deskRef}
        args={[2, 0.1, 1.5]}
        position={[0, 0.75, 0]}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={hovered || isSelected ? agent.color : '#8B4513'}
          emissive={hovered || isSelected ? agent.color : '#000000'}
          emissiveIntensity={hovered || isSelected ? 0.2 : 0}
        />
      </Box>

      {/* Monitor */}
      <Box
        ref={monitorRef}
        args={[1.2, 0.8, 0.05]}
        position={[0, 1.5, -0.5]}
        castShadow
        onClick={onClick}
      >
        <meshStandardMaterial
          color={getStatusColor()}
          emissive={getMonitorEmissive()}
          emissiveIntensity={
            state.status === 'offline' ? 0.05 :
            state.status === 'idle' ? 0.15 :
            state.status === 'online' ? 0.3 :
            0.5 // working, thinking, error
          }
        />
      </Box>

      {/* Monitor stand */}
      <Box
        args={[0.1, 0.4, 0.1]}
        position={[0, 1, -0.5]}
        castShadow
      >
        <meshStandardMaterial color="#2d2d2d" />
      </Box>

      {/* Keyboard */}
      <VoxelKeyboard
        position={[0, 0.81, 0.2]}
        rotation={[0, 0, 0]}
      />

      {/* Mac mini - al lado del monitor, sobre la mesa */}
      <VoxelMacMini
        position={[0.5, 0.825, -0.5]}
      />

      {/* Seated avatar with click and label - only when working/online/thinking */}
      {(state.status === 'working' || state.status === 'online' || state.status === 'thinking') && (
        <ClickableAvatar
          agent={agent}
          status={state.status}
          onClick={onClick}
          isSelected={isSelected}
          scale={1.5}
        />
      )}

      {/* Office Chair - 2x size, rotated 180°, moved back and right */}
      <group scale={2}>
        <VoxelChair
          position={[0, 0, 0.9]}
          rotation={[0, Math.PI, 0]}
          color="#1f2937"
        />
      </group>

      {/* Desk legs */}
      {[-0.8, 0.8].map((x, i) =>
        [-0.6, 0.6].map((z, j) => (
          <Box
            key={`leg-${i}-${j}`}
            args={[0.05, 0.7, 0.05]}
            position={[x, 0.35, z]}
            castShadow
          >
            <meshStandardMaterial color="#5d4037" />
          </Box>
        ))
      )}

      {/* Subtle floor glow when selected */}
      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.5, 32]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
