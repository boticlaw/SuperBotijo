'use client';

import { MATERIALS } from './materials';

export default function Ceiling() {
  return (
    <mesh position={[0, 6.1, 0]} receiveShadow={false}>
      <boxGeometry args={[30, 0.2, 20]} />
      <primitive object={MATERIALS.walls.ceiling} attach="material" />
    </mesh>
  );
}
