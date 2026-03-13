'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Text } from '@react-three/drei';
import type { Mesh } from 'three';
import type { AvatarState, AvatarAccessories } from './agentsConfig';
import VoxelChair from './VoxelChair';
import VoxelKeyboard from './VoxelKeyboard';
import VoxelMacMini from './VoxelMacMini';
import { ClickableAvatar } from './ClickableAvatar';
import CoffeeMug from './CoffeeMug';
import DeskPlant from './DeskPlant';
import Notepad from './Notepad';
import DeskPhoto from './DeskPhoto';
import { DESK_DECOR_TYPES, getDeskDecorPreset, type DeskDecorItem } from './deskDecorPresets';

export type AvatarType = 'WalkingAvatar' | 'SeatedAvatar' | 'VoxelAvatar' | 'none';

export interface AgentDeskProps {
  agentId: string;
  agentName: string;
  agentColor: string;
  agentEmoji?: string;
  agentRole?: string;
  agentAccessories?: AvatarAccessories;
  deskPosition: [number, number, number];
  deskRotation?: [number, number, number];
  avatarState: AvatarState;
  avatarType?: AvatarType;
  currentTask?: string;
  onClick: () => void;
  isSelected: boolean;
  useSharedTable?: boolean;
}

export default function AgentDesk({
  agentId,
  agentName,
  agentColor,
  agentEmoji = '🤖',
  agentRole = 'Agent',
  agentAccessories,
  deskPosition,
  deskRotation = [0, 0, 0],
  avatarState,
  onClick,
  isSelected,
  useSharedTable = false,
}: AgentDeskProps) {
  const monitorRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Animación de pulsación para estado "thinking"
  useFrame((frameState) => {
    if (monitorRef.current && avatarState === 'thinking') {
      monitorRef.current.scale.setScalar(1 + Math.sin(frameState.clock.elapsedTime * 2) * 0.05);
    }
  });

  const getStatusColor = () => {
    switch (avatarState) {
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
    switch (avatarState) {
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

  const getMonitorLines = () => {
    switch (avatarState) {
      case 'working':
        return [
          '> npm run build',
          'Compiling...',
          '████████░░ 80%',
          '',
          '✓ modules: 1234',
        ];
      case 'thinking':
        return [
          'Analyzing context...',
          '',
          'function solve() {',
          '  // thinking...',
          '}',
        ];
      case 'error':
        return [
          'Error!',
          '',
          'TypeError: undefined',
          'at line 42',
          'Retrying...',
        ];
      case 'online':
        return [
          'Ready',
          '',
          `Agent: ${agentName}`,
          'Listening events...',
          '',
        ];
      case 'offline':
        return [
          'Standby mode',
          '',
          `Agent: ${agentName}`,
          'Status: offline',
          '',
        ];
      case 'idle':
      default:
        return [
          'Ready',
          '',
          `Agent: ${agentName}`,
          'Status: idle',
          '',
        ];
    }
  };

  const decorItems = getDeskDecorPreset(agentId).slice(0, 3);

  const renderDecorItem = (item: DeskDecorItem, index: number) => {
    const key = `decor-${agentId}-${item.type}-${index}`;

    switch (item.type) {
      case DESK_DECOR_TYPES.coffeeMug:
        return <CoffeeMug key={key} position={item.position} rotation={item.rotation} />;
      case DESK_DECOR_TYPES.deskPlant:
        return <DeskPlant key={key} position={item.position} rotation={item.rotation} />;
      case DESK_DECOR_TYPES.notepad:
        return <Notepad key={key} position={item.position} rotation={item.rotation} />;
      case DESK_DECOR_TYPES.deskPhoto:
        return <DeskPhoto key={key} position={item.position} rotation={item.rotation} />;
      default:
        return null;
    }
  };

  return (
    <group position={deskPosition} rotation={deskRotation}>
      {/* Clickable desk surface */}
      {!useSharedTable && (
        <Box
          args={[2, 0.1, 1.5]}
          position={[0, 0.75, 0]}
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
          }}
        >
          <meshStandardMaterial
            color={hovered || isSelected ? agentColor : '#8B4513'}
            emissive={hovered || isSelected ? agentColor : '#000000'}
            emissiveIntensity={hovered || isSelected ? 0.2 : 0}
          />
        </Box>
      )}

      {/* Monitor */}
      <group 
        position={[0, 1.5, -0.5]} 
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Box
          ref={monitorRef}
          args={[1.2, 0.8, 0.05]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#1f2937" roughness={0.6} metalness={0.2} />
        </Box>

        <Box args={[1.1, 0.68, 0.015]} position={[0, 0, 0.03]}>
          <meshStandardMaterial
            color="#05070d"
            emissive={getMonitorEmissive()}
            emissiveIntensity={
              avatarState === 'offline' ? 0.22 :
              avatarState === 'idle' ? 0.3 :
              avatarState === 'online' ? 0.45 :
              0.62
            }
            toneMapped={false}
          />
        </Box>

        {getMonitorLines().map((line, index) => (
          <Text
            key={`monitor-line-${agentId}-${index}`}
            position={[-0.5, 0.23 - index * 0.11, 0.04]}
            fontSize={0.06}
            color={getStatusColor()}
            anchorX="left"
            anchorY="middle"
          >
            {line}
          </Text>
        ))}

        {/* Monitor stand */}
        <Box args={[0.1, 0.4, 0.1]} position={[0, -0.5, 0]} castShadow>
          <meshStandardMaterial color="#2d2d2d" />
        </Box>
      </group>

      {/* Keyboard */}
      <VoxelKeyboard
        position={[0, 0.81, 0.2]}
        rotation={[0, 0, 0]}
      />

      {/* Mac mini - al lado del monitor, sobre la mesa */}
      <VoxelMacMini
        position={[0.5, 0.825, -0.5]}
      />

      {/* Decorative desk objects - deterministic preset per agent */}
      <group onClick={onClick}>
        {decorItems.map((item, index) => renderDecorItem(item, index))}
      </group>

      {/* Dynamic avatar rendering based on avatarState */}
      {(avatarState === 'working' || avatarState === 'thinking' || avatarState === 'online') && (
        <ClickableAvatar
          agent={{
            id: agentId,
            name: agentName,
            emoji: agentEmoji,
            color: agentColor,
            role: agentRole || 'Agent',
            position: [0, 0, 0],
            accessories: agentAccessories,
          }}
          status={avatarState}
          onClick={onClick}
          isSelected={isSelected}
          scale={1.5}
        />
      )}

      {/* Office Chair */}
      <group scale={1.7}>
        <VoxelChair
          position={[0, 0, 0.95]}
          rotation={[0, Math.PI, 0]}
          color="#1f2937"
        />
      </group>

      {!useSharedTable &&
        [-0.8, 0.8].map((x, i) =>
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
          <meshBasicMaterial color={agentColor} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Calculate avatar type based on agent state
 * This maps the agent's current status to the appropriate avatar type
 */
export function calculateAvatarType(state: AvatarState): AvatarType {
  switch (state) {
    case 'offline':
      return 'none';
    case 'idle':
      return 'WalkingAvatar';
    case 'working':
    case 'thinking':
    case 'error':
      return 'SeatedAvatar';
    case 'online':
      return 'SeatedAvatar';
    default:
      return 'none';
  }
}
