'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Line2 } from 'three-stdlib';
import * as THREE from 'three';

interface AgentConnectionProps {
  from: [number, number, number];
  to: [number, number, number];
  status: 'active' | 'idle';
  taskName?: string;
}

/**
 * Visual connection between a parent agent and its subagent (visitor).
 * Shows an animated line with particles flowing from parent to child.
 */
export function AgentConnection({ from, to, status }: AgentConnectionProps) {
  const particleRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<Line2>(null);
  
  // Calculate midpoint for curve
  const midpoint: [number, number, number] = [
    (from[0] + to[0]) / 2,
    Math.max(from[1], to[1]) + 0.5, // Arc above
    (from[2] + to[2]) / 2,
  ];
  
  // Create curved path points
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...from),
    new THREE.Vector3(...midpoint),
    new THREE.Vector3(...to)
  );
  
  const points = curve.getPoints(20);
  const linePoints = points.map(p => [p.x, p.y, p.z] as [number, number, number]);
  
  // Color based on status
  const lineColor = status === 'active' ? '#22c55e' : '#666666';
  
  // Animate particle along the path
  useFrame((state) => {
    if (!particleRef.current || status !== 'active') return;
    
    // Move particle along curve (0 to 1, then reset)
    const t = (state.clock.elapsedTime * 0.5) % 1;
    const point = curve.getPoint(t);
    
    particleRef.current.position.copy(point);
    particleRef.current.scale.setScalar(0.8 + Math.sin(state.clock.elapsedTime * 4) * 0.2);
  });
  
  return (
    <group>
      {/* Connection line */}
      <Line
        ref={lineRef}
        points={linePoints}
        color={lineColor}
        lineWidth={1.5}
        transparent
        opacity={status === 'active' ? 0.8 : 0.3}
        dashed={status === 'idle'}
        dashSize={0.1}
        gapSize={0.05}
      />
      
      {/* Flowing particle (only when active) */}
      {status === 'active' && (
        <mesh ref={particleRef}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#22c55e"
            emissiveIntensity={0.8}
          />
        </mesh>
      )}
      
      {/* Glow effect at endpoints when active */}
      {status === 'active' && (
        <>
          <mesh position={from}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
          </mesh>
          <mesh position={to}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
          </mesh>
        </>
      )}
    </group>
  );
}

export default AgentConnection;
