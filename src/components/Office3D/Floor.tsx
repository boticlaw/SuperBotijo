'use client';

import { useMemo } from 'react';
import { RepeatWrapping, CanvasTexture } from 'three';

export default function Floor() {
  // Crear textura procedural de madera SOLO UNA VEZ (memoizada)
  const woodTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base madera clara
    ctx.fillStyle = '#8B6F47';
    ctx.fillRect(0, 0, 512, 512);

    // Vetas de madera (líneas verticales con seed fijo)
    for (let i = 0; i < 512; i += 8) {
      const shade = (Math.sin(i * 0.1) * 20); // Patrón determinista
      ctx.fillStyle = `rgb(${139 + shade}, ${111 + shade}, ${71 + shade})`;
      ctx.fillRect(i, 0, 3, 512);
    }

    // Nudos de madera (posiciones fijas)
    const knots = [
      { x: 100, y: 150, r: 15 },
      { x: 350, y: 80, r: 20 },
      { x: 200, y: 400, r: 18 },
      { x: 450, y: 300, r: 12 },
      { x: 50, y: 450, r: 16 },
      { x: 400, y: 200, r: 14 },
    ];

    knots.forEach(({ x, y, r }) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, '#5D4E37');
      gradient.addColorStop(1, '#8B6F47');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    // ISSUE #69: Reducido de 4x4 a 2x2 para menos repetición obvia
    texture.repeat.set(2, 2);
    
    return texture;
  }, []); // Array vacío = solo se crea una vez

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial
        map={woodTexture}
        roughness={0.9}
        metalness={0.0}
      />
    </mesh>
  );
}
