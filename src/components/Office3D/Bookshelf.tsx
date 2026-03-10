"use client";

import { Box, Cylinder, Sphere } from "@react-three/drei";

interface BookshelfProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

interface BookSpec {
  width: number;
  height: number;
  color: string;
  tilt: number;
}

const BOOK_ROWS: BookSpec[][] = [
  [
    { width: 0.045, height: 0.2, color: "#b91c1c", tilt: -0.05 },
    { width: 0.05, height: 0.24, color: "#1d4ed8", tilt: 0.03 },
    { width: 0.04, height: 0.18, color: "#15803d", tilt: -0.02 },
    { width: 0.055, height: 0.23, color: "#7e22ce", tilt: 0.04 },
    { width: 0.04, height: 0.17, color: "#a16207", tilt: -0.03 },
    { width: 0.048, height: 0.21, color: "#0e7490", tilt: 0.02 },
  ],
  [
    { width: 0.042, height: 0.17, color: "#9f1239", tilt: 0.02 },
    { width: 0.06, height: 0.26, color: "#1e40af", tilt: -0.04 },
    { width: 0.038, height: 0.16, color: "#166534", tilt: 0.03 },
    { width: 0.052, height: 0.22, color: "#6b21a8", tilt: -0.02 },
    { width: 0.046, height: 0.19, color: "#b45309", tilt: 0.04 },
    { width: 0.044, height: 0.18, color: "#155e75", tilt: -0.03 },
  ],
  [
    { width: 0.05, height: 0.23, color: "#991b1b", tilt: 0.03 },
    { width: 0.044, height: 0.19, color: "#1e3a8a", tilt: -0.03 },
    { width: 0.053, height: 0.24, color: "#14532d", tilt: 0.04 },
    { width: 0.04, height: 0.16, color: "#581c87", tilt: -0.02 },
    { width: 0.058, height: 0.25, color: "#92400e", tilt: 0.03 },
    { width: 0.042, height: 0.17, color: "#0f766e", tilt: -0.04 },
  ],
];

function BooksRow({ y, rowIndex }: { y: number; rowIndex: number }) {
  const books = BOOK_ROWS[rowIndex % BOOK_ROWS.length];

  return (
    <group position={[0, y, 0]}>
      {books.map((book, index) => {
        const previousWidth = books
          .slice(0, index)
          .reduce((total, item) => total + item.width + 0.012, 0);
        const x = -0.42 + previousWidth + book.width / 2;

        return (
          <Box
            key={`book-${rowIndex}-${index}`}
            args={[book.width, book.height, 0.18]}
            position={[x, book.height / 2, 0]}
            rotation={[0, 0, book.tilt]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={book.color} roughness={0.7} />
          </Box>
        );
      })}
    </group>
  );
}

function SmallPlant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Cylinder args={[0.04, 0.035, 0.06, 8]} castShadow receiveShadow>
        <meshStandardMaterial color="#c2854a" roughness={0.9} />
      </Cylinder>
      <Sphere args={[0.05, 8, 8]} position={[0, 0.06, 0]} castShadow>
        <meshStandardMaterial color="#22c55e" roughness={0.8} />
      </Sphere>
    </group>
  );
}

export default function Bookshelf({ position, rotation = [0, 0, 0] }: BookshelfProps) {
  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.05, 1.5, 0.3]} position={[-0.5, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8b4513" roughness={0.82} />
      </Box>
      <Box args={[0.05, 1.5, 0.3]} position={[0.5, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8b4513" roughness={0.82} />
      </Box>

      {[-0.5, 0, 0.5, 1].map((y, index) => (
        <Box key={`shelf-${index}`} args={[1, 0.03, 0.28]} position={[0, y, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#8b4513" roughness={0.82} />
        </Box>
      ))}

      <Box args={[1, 1.02, 0.02]} position={[0, 0.51, -0.13]}>
        <meshStandardMaterial color="#6b4423" roughness={0.9} />
      </Box>

      <BooksRow y={-0.49} rowIndex={0} />
      <BooksRow y={0.01} rowIndex={1} />
      <BooksRow y={0.51} rowIndex={2} />

      <SmallPlant position={[0.33, 1.03, 0]} />
    </group>
  );
}
