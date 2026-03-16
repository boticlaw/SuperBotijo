'use client';

import { useMemo } from 'react';
import { RepeatWrapping, CanvasTexture } from 'three';

interface AreaRugProps {
  position: [number, number, number];
  size: [number, number];
  color?: string;
  borderColor?: string;
}

/**
 * AreaRug — A flat textured rug placed on the floor to delineate zones.
 * Uses a procedural canvas texture with a woven pattern and border.
 */
export function AreaRug({
  position,
  size,
  color = '#3d3529',
  borderColor = '#2a2318',
}: AreaRugProps) {
  const rugTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Parse hex color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Base fill
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle woven pattern — alternating rows of lighter/darker fibers
    for (let y = 0; y < 256; y += 4) {
      const variation = (y % 8 === 0) ? 8 : -5;
      ctx.fillStyle = `rgb(${r + variation}, ${g + variation}, ${b + variation})`;
      ctx.fillRect(0, y, 256, 2);
    }

    // Cross-hatch for texture
    for (let x = 0; x < 256; x += 6) {
      const variation = (x % 12 === 0) ? 6 : -3;
      ctx.fillStyle = `rgba(${r + variation}, ${g + variation}, ${b + variation}, 0.3)`;
      ctx.fillRect(x, 0, 1, 256);
    }

    // Border
    const borderWidth = 10;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, 256 - borderWidth, 256 - borderWidth);

    // Inner border line
    ctx.strokeStyle = `rgba(${r + 20}, ${g + 20}, ${b + 20}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(borderWidth + 3, borderWidth + 3, 256 - borderWidth * 2 - 6, 256 - borderWidth * 2 - 6);

    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(1, 1);

    return texture;
  }, [color, borderColor]);

  return (
    <mesh
      position={[position[0], 0.008, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={rugTexture}
        roughness={0.95}
        metalness={0.0}
      />
    </mesh>
  );
}
