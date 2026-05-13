import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFarm, MAX_SEEDS } from '../../context/FarmContext';

/* ── Seed Box ── */
function SeedBox({ visible }) {
  if (!visible) return null;
  const woodMat = { color: 0x8B4513, roughness: 0.9, metalness: 0.1 };
  return (
    <group position={[-8, 0.5, 3]} rotation={[0, Math.PI / 6, 0]}>
      <mesh><boxGeometry args={[2, 0.1, 1.5]} /><meshStandardMaterial {...woodMat} /></mesh>
      <mesh position={[0, 0.3, 0.75]}><boxGeometry args={[2.1, 0.6, 0.1]} /><meshStandardMaterial {...woodMat} /></mesh>
      <mesh position={[0, 0.3, -0.75]}><boxGeometry args={[2.1, 0.6, 0.1]} /><meshStandardMaterial {...woodMat} /></mesh>
      <mesh position={[1.05, 0.3, 0]}><boxGeometry args={[0.1, 0.6, 1.5]} /><meshStandardMaterial {...woodMat} /></mesh>
      <mesh position={[-1.05, 0.3, 0]}><boxGeometry args={[0.1, 0.6, 1.5]} /><meshStandardMaterial {...woodMat} /></mesh>
    </group>
  );
}

/* ── Seed Bag (follows mouse during seeding) ── */
export function SeedBag({ bagRef, visible }) {
  if (!visible) return null;
  return (
    <group ref={bagRef} position={[0, 6, 0]}>
      <mesh><boxGeometry args={[0.9, 1.2, 0.2]} /><meshStandardMaterial color={0xf9f9f2} roughness={1} /></mesh>
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.92, 0.15, 0.22]} /><meshStandardMaterial color={0xc5e1a5} /></mesh>
      <mesh position={[0, 0, 0.101]}>
        <circleGeometry args={[0.3, 32]} />
        <meshStandardMaterial color={0xc5e1a5} side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <group key={i}>
            <mesh position={[Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, 0.105]}>
              <circleGeometry args={[0.08, 8]} />
              <meshStandardMaterial color={0xffffff} />
            </mesh>
            <mesh position={[Math.cos(angle) * 0.15, Math.sin(angle) * 0.15, 0.106]}>
              <circleGeometry args={[0.02, 8]} />
              <meshStandardMaterial color={0xffa726} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ── Watering Can ── */
export function WateringCan({ canRef, visible }) {
  const { state } = useFarm();

  useFrame(({ clock }) => {
    if (!canRef.current || !visible) return;
    const t = clock.getElapsedTime();
    
    if (state.plantingState === 'planted') {
      // Idle floating
      canRef.current.position.y = 5 + Math.sin(t * 2) * 0.2;
      canRef.current.rotation.z = Math.sin(t) * 0.1;
    } else if (state.plantingState === 'germinating') {
      // Scanning the whole 3x5 grid in 3 seconds
      const scanX = Math.sin(t * 6) * 4.5;
      const scanZ = Math.cos(t * 2) * 2;
      canRef.current.position.lerp(new THREE.Vector3(scanX, 4.5, scanZ), 0.15);
      canRef.current.rotation.z = THREE.MathUtils.lerp(canRef.current.rotation.z, -Math.PI / 3, 0.1);
    }
  });

  if (!visible) return null;
  const metalMat = { color: 0x2980b9, metalness: 0.8, roughness: 0.2 };
  return (
    <group ref={canRef} position={[8, 5, 3]} rotation={[0, -Math.PI / 3, 0]}>
      <mesh><cylinderGeometry args={[0.4, 0.6, 1.0, 16]} /><meshStandardMaterial {...metalMat} /></mesh>
      <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial {...metalMat} /></mesh>
      <group>
        <mesh position={[0.6, 0.4, 0]} rotation={[0, 0, -Math.PI / 3]}><cylinderGeometry args={[0.04, 0.1, 1.2, 12]} /><meshStandardMaterial {...metalMat} /></mesh>
        <mesh position={[1.1, 0.9, 0]} rotation={[0, 0, -Math.PI / 3]}><cylinderGeometry args={[0.15, 0.05, 0.1, 12]} /><meshStandardMaterial {...metalMat} /></mesh>
      </group>
      <mesh position={[-0.4, 0.3, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.5, 0.04, 8, 20, Math.PI]} />
        <meshStandardMaterial {...metalMat} />
      </mesh>
    </group>
  );
}

/* ── Water drops spawned during watering ── */
export function WaterDrops({ dropsRef, canRef }) {
  const { state } = useFarm();
  const meshRef = useRef();

  useFrame(() => {
    if (!meshRef.current) return;
    
    // Spawn drops if watering - cap total drops to prevent lag
    if (state.plantingState === 'germinating' && dropsRef.current.length < 300) {
      if (canRef.current) {
        canRef.current.updateMatrixWorld();
        const spoutPos = new THREE.Vector3(1.1, 0.9, 0); // Correct local spout pos
        spoutPos.applyMatrix4(canRef.current.matrixWorld);
        
        for (let i = 0; i < 4; i++) {
          dropsRef.current.push({
            x: spoutPos.x + (Math.random() - 0.5) * 0.3,
            y: spoutPos.y,
            z: spoutPos.z + (Math.random() - 0.5) * 0.3,
            sx: (Math.random() - 0.5) * 1.5,
            sz: (Math.random() - 0.5) * 1.5,
            speed: 0.12 + Math.random() * 0.08
          });
        }
      }
    }

    const dummy = new THREE.Object3D();
    // Cleanup drops that hit the ground or go too low
    dropsRef.current = dropsRef.current.filter(d => d.y > 0.5);
    
    dropsRef.current.forEach((d, i) => {
      d.y  -= d.speed;
      d.x  += d.sx * 0.02;
      d.z  += d.sz * 0.02;
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.setScalar(0.6 + Math.random() * 0.4);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.count = Math.min(dropsRef.current.length, 300);
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, 300]}>
      <sphereGeometry args={[0.06, 6, 4]} />
      <meshStandardMaterial color={0x00a8ff} transparent opacity={0.8} emissive={0x00a8ff} emissiveIntensity={2} />
    </instancedMesh>
  );
}

/* ─────────────── PROPS ROOT ─────────────── */
export default function FarmProps({ bagRef, canRef, dropsRef }) {
  const { state } = useFarm();
  const { currentSection, plantingState } = state;

  const showSeedBox  = currentSection === 1;
  const showSeedBag  = currentSection === 1 && plantingState === 'seeding';
  const showCan      = currentSection === 1 && (plantingState === 'planted' || plantingState === 'germinating');

  return (
    <>
      <SeedBox     visible={showSeedBox} />
      <SeedBag     bagRef={bagRef} visible={showSeedBag} />
      <WateringCan canRef={canRef} visible={showCan} />
      <WaterDrops  dropsRef={dropsRef} canRef={canRef} />
    </>
  );
}
