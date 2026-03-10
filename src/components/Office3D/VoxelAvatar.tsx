'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Text } from '@react-three/drei';
import { MathUtils } from 'three';
import type { Group } from 'three';
import { AVATAR_HAIR_TYPES, AVATAR_HAT_TYPES, type AgentConfig } from './agentsConfig';
import { Glasses } from './Glasses';
import { Hair } from './Hair';
import { Hat } from './Hat';
import { Beard } from './Beard';

const FACE_EXPRESSIONS = {
  neutral: 'neutral',
  smile: 'smile',
  surprised: 'surprised',
  frown: 'frown',
} as const;

type FaceExpression = (typeof FACE_EXPRESSIONS)[keyof typeof FACE_EXPRESSIONS];

const IDLE_ANIMATIONS = {
  breathing: 'breathing',
  stretching: 'stretching',
  lookingAround: 'looking_around',
  checkingWatch: 'checking_watch',
  drinking: 'drinking',
} as const;

type IdleAnimation = (typeof IDLE_ANIMATIONS)[keyof typeof IDLE_ANIMATIONS];

interface VoxelAvatarProps {
  agent: AgentConfig;
  position: [number, number, number];
  isWorking?: boolean;
  isThinking?: boolean;
  isError?: boolean;
  isWalking?: boolean;
  scale?: number;
  idleAnimation?: IdleAnimation;
}

export default function VoxelAvatar({
  agent,
  position,
  isWorking = false,
  isThinking = false,
  isError = false,
  isWalking = false,
  scale = 1,
  idleAnimation = IDLE_ANIMATIONS.breathing,
}: VoxelAvatarProps) {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const [currentIdle, setCurrentIdle] = useState<IdleAnimation>(idleAnimation);

  useEffect(() => {
    setCurrentIdle(idleAnimation);
  }, [idleAnimation]);

  useEffect(() => {
    if (isWorking || isThinking || isError) {
      return;
    }

    let timeoutId: NodeJS.Timeout | undefined;
    const idleOptions: IdleAnimation[] = [
      IDLE_ANIMATIONS.breathing,
      IDLE_ANIMATIONS.stretching,
      IDLE_ANIMATIONS.lookingAround,
      IDLE_ANIMATIONS.checkingWatch,
      IDLE_ANIMATIONS.drinking,
    ];

    const getHash = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
      }
      return hash;
    };

    const baseHash = getHash(agent.id);

    const scheduleNext = () => {
      const randomIndex = (baseHash + Math.floor(Math.random() * 1000)) % idleOptions.length;
      setCurrentIdle(idleOptions[randomIndex]);

      const delay = 8000 + Math.random() * 7000;
      timeoutId = setTimeout(scheduleNext, delay);
    };

    timeoutId = setTimeout(scheduleNext, 3000 + (baseHash % 2500));

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [agent.id, isWorking, isThinking, isError]);

  // Animations
  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;

    let targetGroupY = position[1];

    let targetHeadY = 0.35;
    let targetHeadRotX = 0;
    let targetHeadRotY = 0;
    let targetHeadRotZ = 0;

    let targetLeftArmRotX = 0;
    let targetLeftArmRotZ = 0;
    let targetRightArmRotX = 0;
    let targetRightArmRotZ = 0;
    let targetRightArmY = 0.18;
    const targetLeftArmY = 0.18;

    // Working: typing animation (arms moving)
    if (isWorking && leftArmRef.current && rightArmRef.current) {
      targetLeftArmRotX = Math.sin(time * 3) * 0.3;
      targetRightArmRotX = Math.sin(time * 3 + Math.PI) * 0.3;
    }

    // Thinking: head bobbing
    if (isThinking && headRef.current) {
      targetHeadY = 0.35 + Math.sin(time * 2) * 0.03;
      targetHeadRotY = Math.sin(time) * 0.1;
    }

    // Error: shake head
    if (isError && headRef.current) {
      targetHeadRotX = Math.sin(time * 5) * 0.1;
      targetHeadRotZ = Math.sin(time * 4) * 0.15;
    }

    // Walking: leg swing + arm swing animation
    let targetLeftLegRotX = 0;
    let targetRightLegRotX = 0;
    if (isWalking) {
      targetLeftLegRotX = Math.sin(time * 6) * 0.5;
      targetRightLegRotX = Math.sin(time * 6 + Math.PI) * 0.5;
      // Arm swing (opposite to legs)
      targetLeftArmRotX = Math.sin(time * 6 + Math.PI) * 0.3;
      targetRightArmRotX = Math.sin(time * 6) * 0.3;
      // Subtle body bob
      targetGroupY = position[1] + Math.abs(Math.sin(time * 6)) * 0.015;
    }

    // Idle behaviors
    if (!isWorking && !isThinking && !isError && !isWalking) {
      if (currentIdle === IDLE_ANIMATIONS.breathing) {
        targetGroupY = position[1] + Math.sin(time) * 0.01;
      }

      if (currentIdle === IDLE_ANIMATIONS.stretching) {
        const stretch = Math.sin(time * 0.5) * 0.5;
        targetLeftArmRotZ = -stretch;
        targetRightArmRotZ = stretch;
        targetLeftArmRotX = -0.25;
        targetRightArmRotX = -0.25;
      }

      if (currentIdle === IDLE_ANIMATIONS.lookingAround) {
        targetHeadRotY = Math.sin(time * 0.8) * 0.3;
      }

      if (currentIdle === IDLE_ANIMATIONS.checkingWatch) {
        targetLeftArmRotX = -Math.PI / 2;
        targetLeftArmRotZ = Math.sin(time * 0.5) * 0.2;
        targetHeadRotX = -0.2;
      }

      if (currentIdle === IDLE_ANIMATIONS.drinking) {
        targetRightArmRotX = -Math.PI / 3;
        targetRightArmY = 0.24;
        targetHeadRotX = Math.sin(time * 0.5) * -0.12;
      }
    }

    groupRef.current.position.y = MathUtils.lerp(groupRef.current.position.y, targetGroupY, 0.1);

    if (headRef.current) {
      headRef.current.position.y = MathUtils.lerp(headRef.current.position.y, targetHeadY, 0.12);
      headRef.current.rotation.x = MathUtils.lerp(headRef.current.rotation.x, targetHeadRotX, 0.12);
      headRef.current.rotation.y = MathUtils.lerp(headRef.current.rotation.y, targetHeadRotY, 0.12);
      headRef.current.rotation.z = MathUtils.lerp(headRef.current.rotation.z, targetHeadRotZ, 0.12);
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = MathUtils.lerp(leftArmRef.current.rotation.x, targetLeftArmRotX, 0.15);
      leftArmRef.current.rotation.z = MathUtils.lerp(leftArmRef.current.rotation.z, targetLeftArmRotZ, 0.15);
      leftArmRef.current.position.y = MathUtils.lerp(leftArmRef.current.position.y, targetLeftArmY, 0.15);
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = MathUtils.lerp(rightArmRef.current.rotation.x, targetRightArmRotX, 0.15);
      rightArmRef.current.rotation.z = MathUtils.lerp(rightArmRef.current.rotation.z, targetRightArmRotZ, 0.15);
      rightArmRef.current.position.y = MathUtils.lerp(rightArmRef.current.position.y, targetRightArmY, 0.15);
    }

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = MathUtils.lerp(leftLegRef.current.rotation.x, targetLeftLegRotX, 0.15);
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = MathUtils.lerp(rightLegRef.current.rotation.x, targetRightLegRotX, 0.15);
    }
  });

  // Colores basados en el agente
  const skinColor = '#ffa07a'; // peach
  const noseColor = '#f08f6b';
  const shirtColor = agent.color;
  const pantsColor = '#4a5568';
  const browColor = '#4a3728';
  const accessories = agent.accessories;
  const hairStyle = accessories?.hair ?? AVATAR_HAIR_TYPES.none;
  const hatStyle = accessories?.hat ?? AVATAR_HAT_TYPES.none;

  const getExpression = (): FaceExpression => {
    if (isError) {
      return FACE_EXPRESSIONS.frown;
    }

    if (isThinking) {
      return FACE_EXPRESSIONS.surprised;
    }

    if (isWorking) {
      return FACE_EXPRESSIONS.neutral;
    }

    return FACE_EXPRESSIONS.smile;
  };

  const expression = getExpression();

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* HEAD */}
      <group ref={headRef} position={[0, 0.35, 0]}>
        {/* Head cube */}
        <Box args={[0.2, 0.2, 0.2]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Box>

        {/* Accessories */}
        {hairStyle !== AVATAR_HAIR_TYPES.none && <Hair style={hairStyle} />}
        {accessories?.glasses && <Glasses />}
        {hatStyle !== AVATAR_HAT_TYPES.none && <Hat style={hatStyle} color={agent.color} />}
        {accessories?.beard && <Beard />}
        {accessories?.earrings && (
          <>
            <mesh position={[-0.105, 0, 0]}>
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0.105, 0, 0]}>
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.3} />
            </mesh>
          </>
        )}

        {/* Ears */}
        <Box args={[0.02, 0.06, 0.04]} position={[-0.11, 0, 0]} rotation={[0, 0.25, 0]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Box>
        <Box args={[0.02, 0.06, 0.04]} position={[0.11, 0, 0]} rotation={[0, -0.25, 0]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Box>

        {/* Eyes with sclera and pupil */}
        <group position={[-0.05, 0.02, 0.1]}>
          <Box args={[0.04, 0.04, 0.02]} castShadow>
            <meshStandardMaterial color="#ffffff" />
          </Box>
          <Box args={[0.02, 0.02, 0.01]} position={[0, 0, 0.011]} castShadow>
            <meshStandardMaterial color="#1f2937" />
          </Box>
        </group>
        <group position={[0.05, 0.02, 0.1]}>
          <Box args={[0.04, 0.04, 0.02]} castShadow>
            <meshStandardMaterial color="#ffffff" />
          </Box>
          <Box args={[0.02, 0.02, 0.01]} position={[0, 0, 0.011]} castShadow>
            <meshStandardMaterial color="#1f2937" />
          </Box>
        </group>

        {/* Brows */}
        <Box args={[0.045, 0.008, 0.01]} position={[-0.05, 0.065, 0.106]} rotation={[0, 0, 0.1]} castShadow>
          <meshStandardMaterial color={browColor} />
        </Box>
        <Box args={[0.045, 0.008, 0.01]} position={[0.05, 0.065, 0.106]} rotation={[0, 0, -0.1]} castShadow>
          <meshStandardMaterial color={browColor} />
        </Box>

        {/* Nose */}
        <Box args={[0.03, 0.04, 0.02]} position={[0, -0.01, 0.115]} castShadow>
          <meshStandardMaterial color={noseColor} />
        </Box>

        {/* Mouth by expression */}
        {expression === FACE_EXPRESSIONS.neutral && (
          <Box args={[0.06, 0.014, 0.01]} position={[0, -0.05, 0.114]} castShadow>
            <meshStandardMaterial color="#111111" />
          </Box>
        )}
        {expression === FACE_EXPRESSIONS.surprised && (
          <Box args={[0.024, 0.024, 0.01]} position={[0, -0.052, 0.114]} castShadow>
            <meshStandardMaterial color="#111111" />
          </Box>
        )}
        {expression === FACE_EXPRESSIONS.smile && (
          <group position={[0, -0.05, 0.114]}>
            <Box args={[0.02, 0.012, 0.01]} position={[-0.028, -0.003, 0]} rotation={[0, 0, 0.25]} castShadow>
              <meshStandardMaterial color="#111111" />
            </Box>
            <Box args={[0.02, 0.012, 0.01]} position={[0.028, -0.003, 0]} rotation={[0, 0, -0.25]} castShadow>
              <meshStandardMaterial color="#111111" />
            </Box>
            <Box args={[0.028, 0.01, 0.01]} position={[0, -0.006, 0]} castShadow>
              <meshStandardMaterial color="#111111" />
            </Box>
          </group>
        )}
        {expression === FACE_EXPRESSIONS.frown && (
          <group position={[0, -0.06, 0.114]}>
            <Box args={[0.02, 0.012, 0.01]} position={[-0.028, 0.003, 0]} rotation={[0, 0, -0.25]} castShadow>
              <meshStandardMaterial color="#ef4444" />
            </Box>
            <Box args={[0.02, 0.012, 0.01]} position={[0.028, 0.003, 0]} rotation={[0, 0, 0.25]} castShadow>
              <meshStandardMaterial color="#ef4444" />
            </Box>
            <Box args={[0.028, 0.01, 0.01]} position={[0, 0.006, 0]} castShadow>
              <meshStandardMaterial color="#ef4444" />
            </Box>
          </group>
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
      <group ref={leftLegRef} position={[-0.05, 0, 0]}>
        <Box args={[0.09, 0.18, 0.09]} position={[0, -0.09, 0]} castShadow>
          <meshStandardMaterial color={pantsColor} />
        </Box>
        <Box args={[0.09, 0.04, 0.12]} position={[0, -0.2, 0.015]} castShadow>
          <meshStandardMaterial color="#1f2937" />
        </Box>
      </group>
      <group ref={rightLegRef} position={[0.05, 0, 0]}>
        <Box args={[0.09, 0.18, 0.09]} position={[0, -0.09, 0]} castShadow>
          <meshStandardMaterial color={pantsColor} />
        </Box>
        <Box args={[0.09, 0.04, 0.12]} position={[0, -0.2, 0.015]} castShadow>
          <meshStandardMaterial color="#1f2937" />
        </Box>
      </group>

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
