'use client';

import { MATERIALS } from './materials';

export default function Walls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 3, -10]} receiveShadow>
        <boxGeometry args={[30, 6, 0.2]} />
        <primitive object={MATERIALS.walls.main} attach="material" />
      </mesh>

      {/* Left wall */}
      <mesh position={[-15, 3, 0]} receiveShadow>
        <boxGeometry args={[0.2, 6, 20]} />
        <primitive object={MATERIALS.walls.main} attach="material" />
      </mesh>

      {/* Right wall */}
      <mesh position={[15, 3, 0]} receiveShadow>
        <boxGeometry args={[0.2, 6, 20]} />
        <primitive object={MATERIALS.walls.main} attach="material" />
      </mesh>



      {/* Baseboards */}
      {/* Back wall baseboard */}
      <mesh position={[0, 0.05, -9.9]} receiveShadow>
        <boxGeometry args={[30, 0.1, 0.1]} />
        <primitive object={MATERIALS.walls.baseboard} attach="material" />
      </mesh>
      {/* Left wall baseboard */}
      <mesh position={[-14.9, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.1, 20]} />
        <primitive object={MATERIALS.walls.baseboard} attach="material" />
      </mesh>
      {/* Right wall baseboard */}
      <mesh position={[14.9, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.1, 20]} />
        <primitive object={MATERIALS.walls.baseboard} attach="material" />
      </mesh>

    </group>
  );
}
