'use client';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

interface FirstPersonControlsProps {
  moveSpeed?: number;
}

const BOUNDARIES = {
  minX: -9,
  maxX: 9,
  minY: 1,
  maxY: 5.8,
  minZ: -8,
  maxZ: 8,
};

function clampPosition(position: THREE.Vector3): void {
  position.x = Math.max(BOUNDARIES.minX, Math.min(BOUNDARIES.maxX, position.x));
  position.y = Math.max(BOUNDARIES.minY, Math.min(BOUNDARIES.maxY, position.y));
  position.z = Math.max(BOUNDARIES.minZ, Math.min(BOUNDARIES.maxZ, position.z));
}

export default function FirstPersonControls({ moveSpeed = 5 }: FirstPersonControlsProps) {
  const { camera } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof PointerLockControls> | null>(null);
  
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = true;
          break;
        case 'Space':
          moveState.current.up = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.down = true;
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = false;
          break;
        case 'Space':
          moveState.current.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.down = false;
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (!controlsRef.current?.isLocked) return;

    const speed = moveSpeed * delta;

    velocity.current.set(0, 0, 0);

    if (moveState.current.forward) velocity.current.z -= speed;
    if (moveState.current.backward) velocity.current.z += speed;
    if (moveState.current.left) velocity.current.x -= speed;
    if (moveState.current.right) velocity.current.x += speed;
    if (moveState.current.up) velocity.current.y += speed;
    if (moveState.current.down) velocity.current.y -= speed;

    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, camera.up).normalize();

    const movement = new THREE.Vector3();
    movement.addScaledVector(cameraDirection, -velocity.current.z);
    movement.addScaledVector(cameraRight, velocity.current.x);
    movement.y = velocity.current.y;

    camera.position.add(movement);

    clampPosition(camera.position);
  });

  return <PointerLockControls ref={controlsRef} />;
}
