'use client';

/**
 * CeilingLight — A visible fluorescent panel fixture.
 * Emits a soft glow downward without adding expensive shadow-casting lights.
 */
function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Housing — dark metal frame flush against ceiling */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.6, 0.06, 0.5]} />
        <meshStandardMaterial color="#374151" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Diffuser panel — frosted acrylic look */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[1.5, 0.02, 0.4]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive="#e2e8f0"
          emissiveIntensity={0.35}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

export default function Lights() {
  return (
    <>
      {/* Ambient light (general illumination) */}
      <ambientLight intensity={0.5} color="#fff5e6" />

      {/* Main directional light (sun) */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Natural light from windows */}
      <directionalLight
        position={[6, 7, -14]}
        intensity={0.35}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[-18, 6, 2]}
        intensity={0.25}
        color="#fff7eb"
      />

      {/* Point lights above each desk area */}
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#fff5e6" />
      <pointLight position={[-4, 4, -3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[4, 4, -3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[-4, 4, 3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[4, 4, 3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[0, 4, 6]} intensity={0.4} color="#fff5e6" />

      {/* Hemisphere light for soft fill */}
      <hemisphereLight args={['#87CEEB', '#8b7355', 0.5]} />

      {/* Ceiling light fixtures — 2 rows of 3 for even coverage */}
      {/* Back row */}
      <CeilingLight position={[-5.5, 5.95, -5]} />
      <CeilingLight position={[0, 5.95, -5]} />
      <CeilingLight position={[5.5, 5.95, -5]} />
      {/* Front row */}
      <CeilingLight position={[-5.5, 5.95, 2]} />
      <CeilingLight position={[0, 5.95, 2]} />
      <CeilingLight position={[5.5, 5.95, 2]} />
    </>
  );
}
