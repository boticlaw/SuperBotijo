'use client';

export default function Walls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 3, -10]} receiveShadow>
        <boxGeometry args={[30, 6, 0.2]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.9} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-15, 3, 0]} receiveShadow>
        <boxGeometry args={[0.2, 6, 20]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.9} />
      </mesh>

      {/* Right wall */}
      <mesh position={[15, 3, 0]} receiveShadow>
        <boxGeometry args={[0.2, 6, 20]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.9} />
      </mesh>



      {/* Baseboards */}
      {/* Back wall baseboard */}
      <mesh position={[0, 0.05, -9.9]} receiveShadow>
        <boxGeometry args={[30, 0.1, 0.1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {/* Left wall baseboard */}
      <mesh position={[-14.9, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.1, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {/* Right wall baseboard */}
      <mesh position={[14.9, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.1, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>

    </group>
  );
}
