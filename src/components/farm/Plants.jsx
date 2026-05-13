import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFarm } from '../../context/FarmContext';

/* ── Easing ── */
function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

/* ─────────────── STATIC SEEDS (section 1 pre-placed) ─────────────── */
const SEED_COLORS = [0x8B6914, 0x6B4226, 0x556B2F];

function StaticSeeds({ visible }) {
  const positions = useMemo(() =>
    Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) => ({ row, col, color: SEED_COLORS[row % 3] }))
    ).flat(), []);

  if (!visible) return null;
  return positions.map(({ row, col, color }) => (
    <group key={`${row}-${col}`} position={[(col - 2) * 2.2, 1.2, (row - 1) * 1.8]}>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 8]} />
        <meshStandardMaterial color={0x3a2a1a} roughness={1} />
      </mesh>
    </group>
  ));
}

/* ─────────────── DROPPED SEEDS (user clicks during seeding) ─────────────── */
export function DroppedSeeds({ seedsRef }) {
  const { state } = useFarm();
  const meshRef = useRef();
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current || !seedsRef.current.length) return;
    const dummy = new THREE.Object3D();
    seedsRef.current.forEach((s, i) => {
      if (!s.done) {
        s.y -= s.speed;
        // Smoothly move towards the target pot as it falls
        s.x += (s.targetGridX - s.x) * 0.1;
        s.z += (s.targetGridZ - s.z) * 0.1;
        if (s.y <= s.targetY) { 
          s.y = s.targetY; 
          s.x = s.targetGridX; 
          s.z = s.targetGridZ; 
          s.done = true; 
        }
      } else if (state.plantingState === 'planted' || state.plantingState === 'germinating') {
        // Slowly sink underground once gieo xong
        s.y -= 0.005;
      }
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(s.rx, s.ry, s.rz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Set color based on row color index
      colorObj.set(SEED_COLORS[s.colorIdx] || 0x6B4226);
      meshRef.current.setColorAt(i, colorObj);
    });
    meshRef.current.count = seedsRef.current.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, 100]} castShadow>
      <sphereGeometry args={[0.06, 12, 8]} />
      <meshStandardMaterial roughness={0.6} metalness={0.1} />
    </instancedMesh>
  );
}

/* ─────────────── SPROUTS ─────────────── */
function Sprout({ row, col, animStartRef, visible }) {
  const groupRef = useRef();

  const stemCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.05, 0.4, 0.02),
    new THREE.Vector3(-0.02, 0.8, -0.01),
    new THREE.Vector3(0.03, 1.2, 0),
  ]), []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !visible) return;
    const ref = animStartRef.current[`s_${row}_${col}`];
    if (ref !== undefined) {
      // Slower growth (2.5 seconds)
      const t = Math.min((clock.getElapsedTime() - ref) / 2.5, 1);
      // Smooth cubic easing instead of elastic "pop"
      const s = t * (2 - t); // Ease out quad
      
      // Additional "fast growth" before section change
      const extraScale = window.__fastGrowth ? 1.5 : 1.0;
      groupRef.current.scale.setScalar(s * extraScale);
      groupRef.current.position.y = 0.4 + (s * extraScale * 0.25); // Slowly rise from mound
    }
    groupRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 1.5 + col * 0.5) * 0.05;
  });

  if (!visible) return null;

  const stemGeo = new THREE.TubeGeometry(stemCurve, 12, 0.03, 6, false);

  return (
    <group ref={groupRef} position={[(col - 2) * 2.2, 0.4, (row - 1) * 1.8]} scale={0}>
      <mesh geometry={stemGeo} castShadow>
        <meshStandardMaterial color={0x4a7c3f} roughness={0.7} />
      </mesh>
      {[0, 1].map(l => (
        <mesh key={l} position={[0, 0.8, 0]} rotation={[0, l * Math.PI, l === 0 ? 0.5 : -0.5]} scale={[0.8, 0.8, 0.8]} castShadow>
          <shapeGeometry args={[(() => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.bezierCurveTo(0.15, 0.1, 0.2, 0.3, 0, 0.5);
            shape.bezierCurveTo(-0.2, 0.3, -0.15, 0.1, 0, 0);
            return shape;
          })()]} />
          <meshStandardMaterial color={0x5a9e4b} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────── FULL PLANT ─────────────── */
const FLOWER_COLORS = [0xff6b6b, 0xfeca57, 0xff9ff3, 0x48dbfb];
const VARIETIES = ['Tomato', 'Basil', 'Pepper', 'Mint'];

function FullPlant({ row, col, seed, animStartRef, visible, hoveredRef, weather }) {
  const groupRef = useRef();
  const height = useMemo(() => 1.8 + seed * 0.8, [seed]);
  const stemCurve = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector3(Math.sin(t * 0.8) * 0.2, t * height, Math.cos(t * 0.4) * 0.1));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, [height]);

  const leafCount = useMemo(() => 8 + Math.floor(seed * 6), [seed]);
  const hasFlower = seed > 0.3;
  const flowerColor = FLOWER_COLORS[Math.floor(seed * FLOWER_COLORS.length)];
  const hue = 0.25 + seed * 0.1;

  useFrame(({ clock }) => {
    if (!groupRef.current || !visible) return;
    const time = clock.getElapsedTime();

    // Elastic grow animation
    const ref = animStartRef.current[`p_${row}_${col}`];
    if (ref !== undefined) {
      const t = Math.min((time - ref) / 0.8, 1);
      groupRef.current.scale.setScalar(easeOutElastic(t));
    }

    // Sway - faster when hovered
    const isHovered = hoveredRef.current === `p_${row}_${col}`;
    const swaySpeed = isHovered ? 1.5 : 0.8;
    const swayAmount = isHovered ? 0.06 : 0.03;
    
    // Remove the droopX tilt as requested, keep it upright
    groupRef.current.rotation.z = Math.sin(time * swaySpeed + col * 0.7) * swayAmount;
    groupRef.current.rotation.x = Math.sin(time * swaySpeed * 0.8 + row) * swayAmount * 0.7;
  });

  if (!visible) return null;

  const stemGeo = new THREE.TubeGeometry(stemCurve, 20, 0.05, 8, false);

  // Colors and damage based on health/weather/randomness
  const isSick = weather === 'disease';
  // Use the unique seed to determine severity (0.3 to 1.0)
  const severity = isSick ? (0.3 + (seed * 0.7)) : 0;
  
  const healthyStem = 0x2d5a27;
  const sickStem = 0x8b8b45;
  const stemColor = new THREE.Color(healthyStem).lerp(new THREE.Color(sickStem), severity);

  return (
    <group
      ref={groupRef}
      position={[(col - 2) * 2.2, 0.5, (row - 1) * 1.8]}
      scale={[1, 1, 1]}
      userData={{ type: 'plant', row, col, variety: VARIETIES[Math.floor(seed * VARIETIES.length)] }}
    >
      {/* Shadow blob */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.15} />
      </mesh>

      {/* Stem */}
      <mesh geometry={stemGeo} castShadow>
        <meshStandardMaterial 
          color={stemColor} 
          roughness={0.8} 
          emissive={isSick ? 0x1a1a05 : 0x0a1a05} 
          emissiveIntensity={0.2 * severity} 
        />
      </mesh>

      {/* Leaves */}
      {Array.from({ length: leafCount }, (_, l) => {
        const t = l / leafCount;
        const pos = stemCurve.getPointAt(0.2 + t * 0.7);
        
        const healthyLeaf = new THREE.Color().setHSL(hue, 0.5, 0.3 + (l / leafCount) * 0.2);
        const sickLeaf = new THREE.Color(0x222222).lerp(new THREE.Color(0x8b8b22), 1 - (l / leafCount));
        const leafColor = healthyLeaf.clone().lerp(sickLeaf, severity);
        
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.3, 0.2, 0.4, 0.5, 0, 0.9);
        shape.bezierCurveTo(-0.4, 0.5, -0.3, 0.2, 0, 0);
        return (
          <mesh
            key={l}
            position={[pos.x, pos.y, pos.z]}
            // Droop leaves more based on severity
            rotation={[(- 0.5 - (l / leafCount) * 0.5) + (severity * 1.2), (l / leafCount) * Math.PI * 4, (seed - 0.5) * 2]}
            // Shriveled leaves based on severity
            scale={(0.5 + (l / leafCount) * 0.5) * (1 - severity * 0.6)}
            castShadow
          >
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={leafColor} roughness={1} side={THREE.DoubleSide} />
          </mesh>
        );
      })}

      {/* Flower */}
      {hasFlower && (() => {
        const topPos = stemCurve.getPointAt(1.0);
        // Mix healthy flower color with black based on severity
        const healthyFlower = new THREE.Color(flowerColor);
        const sickFlower = new THREE.Color(0x111111);
        const finalFlowerColor = healthyFlower.clone().lerp(sickFlower, severity);
        
        return (
          <group position={[topPos.x, topPos.y, topPos.z]} scale={1 - severity * 0.5}>
            <mesh castShadow>
              <sphereGeometry args={[0.15, 12, 10]} />
              <meshStandardMaterial color={finalFlowerColor} roughness={0.9} />
            </mesh>
            {Array.from({ length: 5 }, (_, p) => (
              <group key={p} rotation={[0, 0, (p / 5) * Math.PI * 2]}>
                {/* Petals curl more if sick */}
                <mesh position={[0.15, 0, 0]} scale={[1.5, 0.2, 0.8]} rotation={[0, severity * 1.2, 0]}>
                  <sphereGeometry args={[0.1, 8, 8]} />
                  <meshStandardMaterial color={finalFlowerColor} roughness={0.9} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })()}
    </group>
  );
}

/* ─────────────── PLANTS ROOT COMPONENT ─────────────── */
export default function Plants({ animStartRef, hoveredRef, seedsRef }) {
  const { state } = useFarm();
  const { currentSection, plantingState, currentWeather } = state;

  // Grid config: 3 rows × 5 cols
  const grid = useMemo(() =>
    Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) => {
        const seed = Math.abs(Math.sin(row * 7 + col * 13)); // deterministic "random"
        return { row, col, seed, idx: row * 5 + col };
      })
    ).flat(), []);

  // Visibility logic: Persistent across sections so Overview reflects progress
  const showStaticSeeds  = currentSection === 1 && (plantingState === 'idle');
  
  // Show sprouts ONLY if we haven't reached the Growing stage yet
  const showSprouts      = (currentSection === 1 && plantingState === 'germinated') || 
                           (currentSection === 0 && plantingState === 'germinated' && state.currentSection < 2);
                           
  const showSproutsGrow  = (currentSection === 2 && plantingState === 'germinated');
  
  // Show full plants if we have reached section 2 or 3
  const showFullPlants   = (state.currentSection >= 2);

  return (
    <group>
      {/* Static pre-placed seeds hidden based on user request */}
      {/* <StaticSeeds visible={showStaticSeeds} /> */}

      {/* Dynamically dropped seeds */}
      <DroppedSeeds seedsRef={seedsRef} />

      {/* Sprouts (all 15 grid spots) */}
      {grid.map(({ row, col }) => (
        <Sprout
          key={`sp-${row}-${col}`}
          row={row} col={col}
          animStartRef={animStartRef}
          visible={showSprouts || showSproutsGrow}
        />
      ))}

      {/* Full Plants */}
      {grid.map(({ row, col, seed, idx }) => (
        <FullPlant
          key={`fp-${row}-${col}`}
          row={row} col={col} seed={seed} idx={idx}
          animStartRef={animStartRef}
          hoveredRef={hoveredRef}
          visible={showFullPlants}
          weather={currentWeather}
        />
      ))}
    </group>
  );
}
