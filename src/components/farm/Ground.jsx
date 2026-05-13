import * as THREE from 'three';
import { useMemo } from 'react';

/* ── Soil-bed rows ── */
function PlantingRows() {
  return [0, 1, 2].map(row => (
    <mesh key={row} position={[0, 0.56, (row - 1) * 1.8]} receiveShadow>
      <boxGeometry args={[10, 0.08, 0.3]} />
      <meshStandardMaterial color={0x4a3728} roughness={1} />
    </mesh>
  ));
}

import { useFarm } from '../../context/FarmContext';

/* ── Dirt mounds at each planting spot ── */
function PlantingMounds() {
  const { state } = useFarm();
  const grid = useMemo(() => 
    Array.from({ length: 15 }, (_, i) => ({
      idx: i,
      row: Math.floor(i / 5),
      col: i % 5
    })), []);

  return grid.map(({ idx, row, col }) => {
    const isPlanted = state.seedsPlanted > idx || state.plantingState === 'germinated' || state.currentSection > 1;
    if (!isPlanted) return null;
    return (
      <mesh key={idx} position={[(col - 2) * 2.2, 0.55, (row - 1) * 1.8]} receiveShadow>
        <sphereGeometry args={[0.25, 8, 4]} />
        <meshStandardMaterial color={0x3a2a1a} roughness={1} />
      </mesh>
    );
  });
}

/* ── Soil texture bumps ── */
function SoilBumps() {
  const bumps = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 11,
      z: (Math.random() - 0.5) * 5,
      r: Math.random() * 0.15 + 0.05,
    }));
  }, []);

  return bumps.map(b => (
    <mesh key={b.id} position={[b.x, 0.55, b.z]} scale={[1, 0.5, 1]} receiveShadow>
      <sphereGeometry args={[b.r, 6, 4]} />
      <meshStandardMaterial color={0x5C4033} roughness={1} />
    </mesh>
  ));
}

export default function Ground() {
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={0xece8e0} roughness={0.95} metalness={0} />
      </mesh>

      {/* Soil bed group */}
      <group position={[0, -0.1, 0]}>
        {/* Raised bed frame */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 1.0, 6]} />
          <meshStandardMaterial color={0x8B7355} roughness={0.8} metalness={0.05} />
        </mesh>
        {/* Soil surface */}
        <mesh position={[0, 0.5, 0]} receiveShadow>
          <boxGeometry args={[11.6, 0.1, 5.6]} />
          <meshStandardMaterial color={0x5C4033} roughness={1} metalness={0} />
        </mesh>
        <SoilBumps />
        <PlantingMounds />
        <PlantingRows />
      </group>
    </group>
  );
}
