'use client';

export default function Lights() {
  return (
    <>
      {/* Ambient light (general illumination) */}
      <ambientLight intensity={0.5} color="#fff5e6" />

      {/* Main directional light (sun) - only ONE shadow-casting light for performance */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Natural light from windows - NO shadows */}
      <directionalLight
        position={[6, 7, -14]}
        intensity={0.35}
        color="#fff5e6"
      />
      <directionalLight
        position={[-18, 6, 2]}
        intensity={0.25}
        color="#fff7eb"
      />

      {/* Point lights - reduced count for performance */}
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#fff5e6" />
      <pointLight position={[-4, 4, -3]} intensity={0.3} color="#fff5e6" />
      <pointLight position={[4, 4, -3]} intensity={0.3} color="#fff5e6" />

      {/* Hemisphere light for soft fill */}
      <hemisphereLight args={['#87CEEB', '#8b7355', 0.5]} />


    </>
  );
}
