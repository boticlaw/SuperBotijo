'use client';

export default function Lights() {
  return (
    <>
      {/* Ambient light (general illumination) - ISSUE #64: aumentado a 0.5 + color cálido */}
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

      {/* Point lights above each desk area - ISSUE #64: colores neutros cálidos */}
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#fff5e6" />
      <pointLight position={[-4, 4, -3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[4, 4, -3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[-4, 4, 3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[4, 4, 3]} intensity={0.4} color="#fff5e6" />
      <pointLight position={[0, 4, 6]} intensity={0.4} color="#fff5e6" />

      {/* Hemisphere light for soft fill - ISSUE #64: aumentado a 0.5 */}
      <hemisphereLight args={['#87CEEB', '#8b7355', 0.5]} />
    </>
  );
}
