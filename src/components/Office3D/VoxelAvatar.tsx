'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Text } from '@react-three/drei';
import type { Group } from 'three';
import type { AgentConfig } from './agentsConfig';

interface VoxelAvatarProps {
  agent: AgentConfig;
  position: [number, number, number];
  isWorking?: boolean;
  isThinking?: boolean;
  isError?: boolean;
  scale?: number;
}

export default function VoxelAvatar({
  agent,
  position,
  isWorking = false,
  isThinking = false,
  isError = false,
  scale = 1,
}: VoxelAvatarProps) {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);

  // Animations
  useFrame((state) => {
    if (!groupRef.current) return;

    // Working: typing animation (arms moving)
    if (isWorking && leftArmRef.current && rightArmRef.current) {
      const time = state.clock.elapsedTime * 3;
      leftArmRef.current.rotation.x = Math.sin(time) * 0.3;
      rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.3;
    }

    // Thinking: head bobbing
    if (isThinking && headRef.current) {
      headRef.current.position.y = 0.35 + Math.sin(state.clock.elapsedTime * 2) * 0.03;
      headRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }

    // Error: shake head
    if (isError && headRef.current) {
      headRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 5) * 0.1;
      headRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 4) * 0.15;
    }

    // Idle breathing
    if (!isWorking && !isThinking && !isError) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.01;
    }
  });

  // Colores basados en el agente
  const skinColor = '#ffa07a'; // peach
  const shirtColor = agent.color;
  const pantsColor = '#4a5568';

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* HEAD */}
      <group ref={headRef} position={[0, 0.35, 0]}>
        {/* Head cube */}
        <Box args={[0.2, 0.2, 0.2]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Box>

        {/* Eyes */}
        <Box args={[0.04, 0.04, 0.02]} position={[-0.05, 0.02, 0.11]} castShadow>
          <meshStandardMaterial color="#1f2937" />
        </Box>
        <Box args={[0.04, 0.04, 0.02]} position={[0.05, 0.02, 0.11]} castShadow>
          <meshStandardMaterial color="#1f2937" />
        </Box>

        {/* Mouth (smile or frown based on status) */}
        {!isError && (
          <Box args={[0.08, 0.02, 0.01]} position={[0, -0.04, 0.11]} castShadow>
            <meshStandardMaterial color="#000000" />
          </Box>
        )}
        {isError && (
          <Box args={[0.08, 0.02, 0.01]} position={[0, -0.06, 0.11]} rotation={[0, 0, Math.PI]} castShadow>
            <meshStandardMaterial color="#ef4444" />
          </Box>
        )}

        {/* Emoji badge on forehead */}
        <Text
          position={[0, 0.08, 0.11]}
          fontSize={0.08}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {agent.emoji}
        </Text>

        {/* Thinking particles effect */}
        {isThinking && (
          <>
            <mesh position={[-0.15, 0.15, 0]}>
              <sphereGeometry args={[0.02]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
            </mesh>
            <mesh position={[-0.18, 0.2, 0]}>
              <sphereGeometry args={[0.03]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
            </mesh>
            <mesh position={[-0.22, 0.26, 0]}>
              <sphereGeometry args={[0.04]} />
              <meshBasicMaterial color="#3b82f6" transparent opacity={0.4} />
            </mesh>
          </>
        )}
      </group>

      {/* BODY */}
      <Box args={[0.2, 0.25, 0.12]} position={[0, 0.125, 0]} castShadow>
        <meshStandardMaterial color={shirtColor} />
      </Box>

      {/* ARMS */}
      <group ref={leftArmRef} position={[-0.12, 0.18, 0]}>
        <Box args={[0.08, 0.2, 0.08]} position={[0, -0.1, 0]} castShadow>
          <meshStandardMaterial color={shirtColor} />
        </Box>
        {/* Hand */}
        <Box args={[0.08, 0.06, 0.08]} position={[0, -0.23, 0]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Box>
      </group>

      <group ref={rightArmRef} position={[0.12, 0.18, 0]}>
        <Box args={[0.08, 0.2, 0.08]} position={[0, -0.1, 0]} castShadow>
          <meshStandardMaterial color={shirtColor} />
        </Box>
        {/* Hand */}
        <Box args={[0.08, 0.06, 0.08]} position={[0, -0.23, 0]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Box>
      </group>

      {/* LEGS */}
      <Box args={[0.09, 0.18, 0.09]} position={[-0.05, -0.09, 0]} castShadow>
        <meshStandardMaterial color={pantsColor} />
      </Box>
      <Box args={[0.09, 0.18, 0.09]} position={[0.05, -0.09, 0]} castShadow>
        <meshStandardMaterial color={pantsColor} />
      </Box>

      {/* SHOES */}
      <Box args={[0.09, 0.04, 0.12]} position={[-0.05, -0.2, 0.015]} castShadow>
        <meshStandardMaterial color="#1f2937" />
      </Box>
      <Box args={[0.09, 0.04, 0.12]} position={[0.05, -0.2, 0.015]} castShadow>
        <meshStandardMaterial color="#1f2937" />
      </Box>

      {/* Error particles (sparks) */}
      {isError && (
        <>
          <mesh position={[0.15, 0.3, 0]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[-0.15, 0.25, 0]}>
            <boxGeometry args={[0.02, 0.02, 0.02]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        </>
      )}
    </group>
  );
}
