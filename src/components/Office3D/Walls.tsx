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

      {/* Front wall — two solid sections flanking a glass entrance */}
      {/* Left section of front wall */}
      <mesh position={[-9.5, 3, 10]} receiveShadow>
        <boxGeometry args={[11, 6, 0.2]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.9} />
      </mesh>
      {/* Right section of front wall */}
      <mesh position={[9.5, 3, 10]} receiveShadow>
        <boxGeometry args={[11, 6, 0.2]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.9} />
      </mesh>
      {/* Transom above entrance (glass panel above the door) */}
      <mesh position={[0, 5, 10]}>
        <boxGeometry args={[8, 2, 0.15]} />
        <meshStandardMaterial
          color="#c8dfe8"
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>
      {/* Glass entrance doors — two panels */}
      <mesh position={[-1.5, 2, 10]}>
        <boxGeometry args={[3, 4, 0.08]} />
        <meshStandardMaterial
          color="#a8cfe0"
          transparent
          opacity={0.3}
          roughness={0.05}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[1.5, 2, 10]}>
        <boxGeometry args={[3, 4, 0.08]} />
        <meshStandardMaterial
          color="#a8cfe0"
          transparent
          opacity={0.3}
          roughness={0.05}
          metalness={0.15}
        />
      </mesh>
      {/* Door frame — brushed steel */}
      {/* Vertical left */}
      <mesh position={[-3.05, 2, 10]}>
        <boxGeometry args={[0.1, 4, 0.2]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Vertical center */}
      <mesh position={[0, 2, 10]}>
        <boxGeometry args={[0.06, 4, 0.2]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Vertical right */}
      <mesh position={[3.05, 2, 10]}>
        <boxGeometry args={[0.1, 4, 0.2]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Horizontal top (where glass meets transom) */}
      <mesh position={[0, 4, 10]}>
        <boxGeometry args={[6.2, 0.08, 0.2]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Door handles — small horizontal bars */}
      <mesh position={[-0.25, 1.8, 10.12]}>
        <boxGeometry args={[0.4, 0.04, 0.04]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0.25, 1.8, 10.12]}>
        <boxGeometry args={[0.4, 0.04, 0.04]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.2} />
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
      {/* Front wall baseboards (left and right sections only) */}
      <mesh position={[-9.5, 0.05, 9.9]} receiveShadow>
        <boxGeometry args={[11, 0.1, 0.1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      <mesh position={[9.5, 0.05, 9.9]} receiveShadow>
        <boxGeometry args={[11, 0.1, 0.1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
    </group>
  );
}
