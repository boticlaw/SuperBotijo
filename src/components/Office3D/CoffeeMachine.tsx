'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Text, RoundedBox, Torus } from '@react-three/drei';
import type { Mesh, Group, MeshBasicMaterial } from 'three';
import { MATERIALS } from './materials';

interface CoffeeMachineProps {
  position: [number, number, number];
  onClick?: () => void;
}

export default function CoffeeMachine({ position, onClick }: CoffeeMachineProps) {
  const [hovered, setHovered] = useState(false);
  const steamRefs = useRef<Mesh[]>([]);
  const dripRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);
  const lastSteamUpdateRef = useRef(0);

  // Animate steam particles (throttled to 200ms)
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const now = time * 1000;
    
    if (now - lastSteamUpdateRef.current > 200) {
      lastSteamUpdateRef.current = now;
      
      steamRefs.current.forEach((steam) => {
        if (steam && steam.material) {
          const offset = steamRefs.current.indexOf(steam) * 0.5;
          const cycle = (time + offset) % 2;
          
          steam.position.y = 1.45 + cycle * 0.3;
          const mat = steam.material as MeshBasicMaterial;
          mat.opacity = Math.max(0, 0.4 - cycle * 0.2);
          steam.scale.setScalar(1 + cycle * 0.3);
        }
      });
    }

    // Coffee drip animation (subtle)
    if (dripRef.current) {
      const dripCycle = (time * 2) % 1;
      dripRef.current.scale.y = 0.3 + Math.sin(dripCycle * Math.PI) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* === KITCHEN COUNTER/BASE === */}
      <Box
        args={[1.2, 0.9, 0.7]}
        position={[0, 0.45, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={MATERIALS.coffee.counter} attach="material" />
      </Box>
      
      {/* Counter top - marble look */}
      <Box
        args={[1.3, 0.04, 0.8]}
        position={[0, 0.92, 0]}
        castShadow
        receiveShadow
      >
        <primitive object={MATERIALS.coffee.counterTop} attach="material" />
      </Box>

      {/* === ESPRESSO MACHINE BODY === */}
      <group position={[0, 0.94, 0]}>
        {/* Main body - chrome professional look */}
        <RoundedBox
          args={[0.6, 0.55, 0.45]}
          radius={0.03}
          smoothness={4}
          position={[0, 0.275, 0]}
          castShadow
          receiveShadow
          onClick={onClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <meshStandardMaterial
            color={hovered ? "#4a4a4a" : "#3a3a3a"}
            metalness={0.8}
            roughness={0.2}
            dispose={null}
          />
        </RoundedBox>

        {/* Top chrome dome */}
        <Cylinder
          args={[0.25, 0.3, 0.15, 32]}
          position={[0, 0.6, 0]}
        >
          <primitive object={MATERIALS.coffee.dome} attach="material" />
        </Cylinder>

        {/* === LED DISPLAY SCREEN === */}
        <Box
          args={[0.35, 0.12, 0.02]}
          position={[0, 0.42, 0.24]}
        >
          <primitive object={MATERIALS.coffee.display} attach="material" />
        </Box>
        
        {/* Display text */}
        <Text
          position={[0, 0.42, 0.26]}
          fontSize={0.045}
          color="#22d3ee"
          anchorX="center"
          anchorY="middle"
        >
          ESPRESSO READY
        </Text>

        {/* === CONTROL BUTTONS === */}
        {/* Left button group */}
        {[-0.15, 0, 0.15].map((xOffset, i) => (
          <Cylinder
            key={i}
            args={[0.025, 0.025, 0.02, 16]}
            position={[xOffset - 0.1, 0.28, 0.24]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <primitive object={i === 1 ? MATERIALS.coffee.btnGreen : MATERIALS.coffee.btnGray} attach="material" />
          </Cylinder>
        ))}

        {/* === PORTAFILTER / GROUP HEAD === */}
        {/* Chrome group head */}
        <Cylinder
          args={[0.08, 0.08, 0.12, 16]}
          position={[0, 0.18, 0.2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <primitive object={MATERIALS.coffee.dome} attach="material" />
        </Cylinder>

        {/* Portafilter handle */}
        <Box
          args={[0.03, 0.08, 0.15]}
          position={[0, 0.12, 0.28]}
          rotation={[0.3, 0, 0]}
        >
          <primitive object={MATERIALS.coffee.portafilter} attach="material" />
        </Box>

        {/* === COFFEE DRIP (animated) === */}
        <mesh ref={dripRef} position={[0, 0.08, 0.2]}>
          <cylinderGeometry args={[0.008, 0.005, 0.04, 8]} />
          <primitive object={MATERIALS.coffee.drip} attach="material" />
        </mesh>

        {/* === DRIP TRAY === */}
        <RoundedBox
          args={[0.4, 0.03, 0.25]}
          radius={0.01}
          smoothness={2}
          position={[0, 0.015, 0.1]}
          receiveShadow
        >
          <primitive object={MATERIALS.coffee.dripTray} attach="material" />
        </RoundedBox>

        {/* Drain grate lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            args={[0.35, 0.01, 0.015]}
            position={[-0.07 + i * 0.035, 0.035, 0.1]}
          >
            <primitive object={MATERIALS.coffee.grate} attach="material" />
          </Box>
        ))}
      </group>

      {/* === COFFEE CUP === */}
      <group position={[0, 0.94, 0.1]}>
        {/* Cup body */}
        <Cylinder
          args={[0.045, 0.035, 0.1, 16]}
          position={[0, 0.05, 0.12]}
        >
          <primitive object={MATERIALS.coffee.cup} attach="material" />
        </Cylinder>

        {/* Cup rim */}
        <Torus
          args={[0.045, 0.005, 8, 16]}
          position={[0, 0.1, 0.12]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <primitive object={MATERIALS.coffee.cupRim} attach="material" />
        </Torus>

        {/* Coffee inside */}
        <Cylinder
          args={[0.04, 0.033, 0.07, 16]}
          position={[0, 0.06, 0.12]}
        >
          <primitive object={MATERIALS.coffee.coffeeInside} attach="material" />
        </Cylinder>

        {/* Cup handle */}
        <Torus
          args={[0.025, 0.006, 8, 16, Math.PI]}
          position={[0.055, 0.05, 0.12]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <primitive object={MATERIALS.coffee.cup} attach="material" />
        </Torus>
      </group>

      {/* === STEAM PARTICLES === */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) steamRefs.current[i] = el; }}
          position={[0, 1.45, 0.12]}
        >
          <sphereGeometry args={[0.02, 8, 8]} />
          <primitive object={MATERIALS.coffee.steam} attach="material" />
        </mesh>
      ))}

      {/* === WATER TANK (back) === */}
      <Box
        args={[0.25, 0.35, 0.12]}
        position={[0, 1.15, -0.2]}
      >
        <primitive object={MATERIALS.coffee.waterTank} attach="material" />
      </Box>

      {/* Water level indicator */}
      <Box
        args={[0.02, 0.25, 0.01]}
        position={[-0.14, 1.1, -0.13]}
      >
        <primitive object={MATERIALS.coffee.waterLevel} attach="material" />
      </Box>

      {/* === HOVER LABEL === */}
      {hovered && (
        <group position={[0, 1.7, 0]}>
          {/* Label background */}
          <RoundedBox
            args={[0.8, 0.25, 0.02]}
            radius={0.05}
            smoothness={4}
          >
            <primitive object={MATERIALS.coffee.labelBg} attach="material" />
          </RoundedBox>
          
          <Text
            position={[0, 0.03, 0.02]}
            fontSize={0.08}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
          >
            ☕ Coffee Station
          </Text>
          
          <Text
            position={[0, -0.06, 0.02]}
            fontSize={0.045}
            color="#9ca3af"
            anchorX="center"
            anchorY="middle"
          >
            Click to view energy
          </Text>
        </group>
      )}
    </group>
  );
}
