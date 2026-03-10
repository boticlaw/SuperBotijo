'use client';

export default function Ceiling() {
  return (
    <mesh position={[0, 6.1, 0]} receiveShadow={false}>
      <boxGeometry args={[30, 0.2, 20]} />
      <meshStandardMaterial color="#e8e4de" roughness={0.9} />
    </mesh>
  );
}
