'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cylinder, Box, Text } from '@react-three/drei';
import type { Group } from 'three';

interface WallClockProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export default function WallClock({ position, rotation = [0, 0, 0] }: WallClockProps) {
  const hourHandRef = useRef<Group>(null);
  const minuteHandRef = useRef<Group>(null);
  const secondHandRef = useRef<Group>(null);
  const lastSecondRef = useRef(-1);

  useFrame(() => {
    const now = new Date();
    const seconds = now.getSeconds();
    if (seconds === lastSecondRef.current) {
      return;
    }
    lastSecondRef.current = seconds;

    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();

    if (hourHandRef.current) {
      hourHandRef.current.rotation.z = -((hours + minutes / 60) * (Math.PI / 6));
    }
    if (minuteHandRef.current) {
      minuteHandRef.current.rotation.z = -(minutes * (Math.PI / 30));
    }
    if (secondHandRef.current) {
      secondHandRef.current.rotation.z = -(seconds * (Math.PI / 30));
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Clock face */}
      <Cylinder
        args={[0.3, 0.3, 0.05, 32]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color="#f5f5f5" />
      </Cylinder>

      {/* Clock rim */}
      <Cylinder
        args={[0.32, 0.32, 0.04, 32]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.005]}
      >
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.3} />
      </Cylinder>

      {/* Center dot */}
      <Cylinder
        args={[0.03, 0.03, 0.03, 16]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.04]}
      >
        <meshStandardMaterial color="#1f2937" />
      </Cylinder>

      {/* ISSUE #68: Hour markers (12 markers) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI) / 6;
        const x = Math.sin(angle) * 0.24;
        const y = Math.cos(angle) * 0.24;
        const isMainHour = i % 3 === 0; // 12, 3, 6, 9 son más grandes
        
        return (
          <Box
            key={i}
            args={[
              isMainHour ? 0.04 : 0.02,
              isMainHour ? 0.04 : 0.025,
              0.02
            ]}
            position={[x, y, 0.035]}
            castShadow
          >
            <meshStandardMaterial color="#1f2937" />
          </Box>
        );
      })}

      {/* Hour hand */}
      <group ref={hourHandRef}>
        <Box args={[0.03, 0.15, 0.02]} position={[0, 0.075, 0.04]} castShadow>
          <meshStandardMaterial color="#1f2937" />
        </Box>
      </group>

      {/* Minute hand */}
      <group ref={minuteHandRef}>
        <Box args={[0.02, 0.22, 0.02]} position={[0, 0.11, 0.045]} castShadow>
          <meshStandardMaterial color="#374151" />
        </Box>
      </group>

      {/* Second hand */}
      <group ref={secondHandRef}>
        <Box args={[0.01, 0.25, 0.01]} position={[0, 0.125, 0.05]} castShadow>
          <meshStandardMaterial color="#ef4444" />
        </Box>
      </group>

      {/* Digital time display at bottom (static, updates on minute change) */}
      <Text
        position={[0, -0.18, 0.055]}
        fontSize={0.06}
        color="#1f2937"
        anchorX="center"
        anchorY="middle"
      >
        {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </group>
  );
}
