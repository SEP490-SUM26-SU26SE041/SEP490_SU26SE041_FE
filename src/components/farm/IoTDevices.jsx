import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFarm } from '../../context/FarmContext';

/* ── Bezier data stream between sensor and gateway ── */
function DataStream({ startPos, endPos, color, glowRef }) {
  const packetsRef = useRef([
    { offset: 0,     speed: 0.3 + Math.random() * 0.2 },
    { offset: 1 / 3, speed: 0.3 + Math.random() * 0.2 },
    { offset: 2 / 3, speed: 0.3 + Math.random() * 0.2 },
  ]);
  const meshRefs = useRef([useRef(), useRef(), useRef()]);

  const curve = useMemo(() => {
    const start = new THREE.Vector3(...startPos);
    const end   = new THREE.Vector3(...endPos);
    const mid   = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 2;
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [startPos, endPos]);

  const linePoints = useMemo(() => curve.getPoints(30), [curve]);

  useFrame(() => {
    packetsRef.current.forEach((p, i) => {
      p.offset = (p.offset + p.speed * 0.005) % 1;
      const pos = curve.getPointAt(p.offset);
      if (meshRefs.current[i]?.current) {
        meshRefs.current[i].current.position.copy(pos);
      }
    });
  });

  const lineGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(linePoints), [linePoints]);

  return (
    <group>
      <primitive object={new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 }))} />
      {meshRefs.current.map((ref, i) => (
        <mesh key={i} ref={ref} castShadow>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Single IoT Device ── */
const DEVICE_CONFIGS = [
  { name: 'Moisture\nSensor',     pos: [-5, 0.5, -1],  color: 0x3498db, dataKey: 'moisture' },
  { name: 'Temperature\nSensor',  pos: [5,  0.5, -1],  color: 0xe74c3c, dataKey: 'temperature' },
  { name: 'Light\nSensor',        pos: [0,  3.5, -3.5],color: 0xf39c12, dataKey: 'light' },
  { name: 'pH\nSensor',           pos: [-3, 0.5, 3.5], color: 0x2ecc71, dataKey: 'ph' },
  { name: 'AI\nCamera',           pos: [8,  7,   2],   color: 0x95a5a6, dataKey: 'ai' },
  { name: 'IoT\nGateway',         pos: [3.5,0.5, 3.5], color: 0x9b59b6, dataKey: null },
];

const GATEWAY_POS = DEVICE_CONFIGS[5].pos;

function IoTDevice({ config, idx, visible, animStartRef, aiCameraRef, aiZoom = 1 }) {
  const groupRef = useRef();
  const headRef  = useRef();
  const ledRef   = useRef();
  const screenRef = useRef();
  const coneRef = useRef();

  useEffect(() => {
    if (coneRef.current) coneRef.current.layers.set(1);
  }, []);

  const { pos, color, dataKey } = config;
  const isSoil      = dataKey === 'moisture' || dataKey === 'ph';
  const isCamera    = dataKey === 'ai';
  const isGateway   = dataKey === null;
  const isLightTemp = dataKey === 'temperature' || dataKey === 'light';

  useFrame(({ clock }) => {
    if (!groupRef.current || !visible) return;
    const time = clock.getElapsedTime();

    // Force the camera head to always look at the center of the garden
    if (isCamera && headRef.current) {
      headRef.current.lookAt(0, 0.5, 0);
      headRef.current.rotateY(Math.PI); // Lật ngược 180 độ để ống kính (-Z) chĩa vào vườn, màn hình (+Z) quay ra ngoài
    }

    // Elastic appear
    const startT = animStartRef.current[`iot_${idx}`];
    if (startT !== undefined) {
      const t = Math.min((time - startT) / 0.6, 1);
      if (t === 0) return;
      const s = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      groupRef.current.scale.setScalar(s);
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={pos} scale={[1, 1, 1]}>
      
      {/* 1. SOIL SENSORS (Moisture / pH) */}
      {isSoil && (
        <group>
          {/* Display Head */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.4, 0.3, 0.2]} />
            <meshStandardMaterial color={0x2c3e50} roughness={0.2} metalness={0.8} />
          </mesh>
          {/* Screen */}
          <mesh position={[0, 0.4, 0.101]}>
            <planeGeometry args={[0.3, 0.2]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.1} />
          </mesh>
          {/* Metallic Prongs going into soil */}
          <mesh position={[-0.1, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.01, 1.0, 8]} />
            <meshStandardMaterial color={0xbdc3c7} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.1, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.01, 1.0, 8]} />
            <meshStandardMaterial color={0xbdc3c7} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* 2. LIGHT / TEMPERATURE SENSORS */}
      {isLightTemp && (
        <group position={[0, 0.4, 0]}>
          {/* Box Body */}
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.6, 0.3]} />
            <meshStandardMaterial color={0x34495e} roughness={0.4} metalness={0.2} />
          </mesh>
          {/* Screen */}
          <mesh position={[0, 0.1, 0.151]}>
            <planeGeometry args={[0.4, 0.3]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.2} />
          </mesh>
          {/* Sensor Dome on top */}
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={0xecf0f1} transparent opacity={0.6} />
          </mesh>
          {/* Status LED */}
          <mesh position={[0, -0.15, 0.151]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color={0x00ff00} emissive={0x00ff00} emissiveIntensity={1} />
          </mesh>
        </group>
      )}

      {/* 3. IOT GATEWAY */}
      {isGateway && (
        <group position={[0, 0.2, 0]}>
          {/* Main Electrical Box */}
          <mesh castShadow>
            <boxGeometry args={[0.8, 1.2, 0.4]} />
            <meshStandardMaterial color={0xbdc3c7} roughness={0.5} metalness={0.5} />
          </mesh>
          {/* Glass panel / screen */}
          <mesh position={[0, 0.2, 0.201]}>
            <planeGeometry args={[0.6, 0.4]} />
            <meshStandardMaterial color={0x2c3e50} roughness={0.1} metalness={0.8} />
          </mesh>
          {/* Status LEDs */}
          <mesh position={[-0.2, -0.2, 0.201]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color={0x2ecc71} emissive={0x2ecc71} emissiveIntensity={1} />
          </mesh>
          <mesh position={[0, -0.2, 0.201]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color={0xf1c40f} emissive={0xf1c40f} emissiveIntensity={1} />
          </mesh>
          <mesh position={[0.2, -0.2, 0.201]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color={0xe74c3c} emissive={0xe74c3c} emissiveIntensity={0.5} />
          </mesh>
          {/* Dual Antennas */}
          <mesh position={[-0.3, 0.8, -0.1]} rotation={[0, 0, 0.2]} castShadow>
            <cylinderGeometry args={[0.015, 0.02, 0.8, 8]} />
            <meshStandardMaterial color={0x34495e} />
          </mesh>
          <mesh position={[0.3, 0.8, -0.1]} rotation={[0, 0, -0.2]} castShadow>
            <cylinderGeometry args={[0.015, 0.02, 0.8, 8]} />
            <meshStandardMaterial color={0x34495e} />
          </mesh>
        </group>
      )}

      {/* 4. AI SECURITY CAMERA */}
      {isCamera && (
        <group>
          {/* The camera head that rotates to face the garden */}
          <group ref={headRef}>
            {/* The actual PerspectiveCamera for the PiP view (Moved outside the lens) */}
            {aiCameraRef && (
              <perspectiveCamera ref={aiCameraRef} position={[0, 0, -0.3]} fov={50 / aiZoom} near={0.1} far={100} />
            )}
            
            {/* Main Bullet Body */}
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
              <cylinderGeometry args={[0.25, 0.25, 0.7, 16]} />
              <meshStandardMaterial color={0xecf0f1} roughness={0.3} />
            </mesh>
            {/* Front Dark Bezel */}
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.15]}>
              <cylinderGeometry args={[0.26, 0.26, 0.1, 16]} />
              <meshStandardMaterial color={0x2c3e50} roughness={0.5} />
            </mesh>
            {/* Glass Face */}
            <mesh position={[0, 0, -0.21]}>
              <circleGeometry args={[0.23, 32]} />
              <meshStandardMaterial color={0x111111} roughness={0.1} metalness={0.9} />
            </mesh>
            {/* Glowing Lens */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.22]}>
              <sphereGeometry args={[0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={0x2ecc71} transparent opacity={0.8} emissive={0x2ecc71} emissiveIntensity={0.5} />
            </mesh>
            {/* Expanded Field of View Cone */}
            <mesh ref={coneRef} position={[0, 0, -8]} rotation={[Math.PI / 2, 0, 0]} userData={{ isLightCone: true }}>
              <coneGeometry args={[5, 16, 32]} />
              <meshBasicMaterial 
                color={0x2ecc71} 
                transparent opacity={0.15} 
                blending={THREE.AdditiveBlending} 
                depthWrite={false} side={THREE.DoubleSide} 
              />
            </mesh>
          </group>
        </group>
      )}

      {/* Mounting pole (Camera, Gateway, Light/Temp) */}
      {!isSoil && (
        <mesh position={[0, -pos[1] / 2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, pos[1], 8]} />
          <meshStandardMaterial color={0x7f8c8d} metalness={0.7} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

/* ─────────────── IOT DEVICES ROOT ─────────────── */
export default function IoTDevices({ animStartRef, aiCameraRef }) {
  const { state } = useFarm();
  const visible = state.currentSection === 3;
  const showStreams = visible;

  return (
    <group>
      {DEVICE_CONFIGS.map((config, idx) => (
        <IoTDevice
          key={idx}
          config={config}
          idx={idx}
          visible={visible}
          animStartRef={animStartRef}
          aiCameraRef={config.dataKey === 'ai' ? aiCameraRef : null}
          aiZoom={state.aiZoom}
        />
      ))}

      {/* Data streams: sensors 0-4 → gateway */}
      {showStreams && DEVICE_CONFIGS.slice(0, 5).map((cfg, i) => (
        <DataStream
          key={i}
          startPos={cfg.pos}
          endPos={GATEWAY_POS}
          color={cfg.color}
        />
      ))}
    </group>
  );
}
