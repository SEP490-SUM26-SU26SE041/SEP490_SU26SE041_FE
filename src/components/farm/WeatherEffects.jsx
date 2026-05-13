import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFarm } from '../../context/FarmContext';

/* ── Ambient floating particles ── */
function AmbientParticles() {
  const ref = useRef();
  const { positions, colors } = useMemo(() => {
    const count = 100;
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 10 + 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      const c = new THREE.Color().setHSL(0.1 + Math.random() * 0.2, 0.3, 0.7);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = clock.getElapsedTime();
    const pos  = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += Math.sin(time + pos[i]) * 0.002;
      pos[i]     += Math.cos(time * 0.5 + pos[i + 2]) * 0.001;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
        <bufferAttribute attach="attributes-color"    array={colors}    count={colors.length / 3}    itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

/* ── Rain ── */
function Rain({ visible }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const count = 2000;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      arr[i]     = (Math.random() - 0.5) * 40;
      arr[i + 1] = Math.random() * 20;
      arr[i + 2] = (Math.random() - 0.5) * 40;
    }
    return arr;
  }, []);

  useFrame(({ gl, clock }) => {
    if (!ref.current || !visible) return;
    const pos = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] -= 0.5;
      if (pos[i + 1] < 0) pos[i + 1] = 20;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!visible) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={0xaaaaaa} size={0.1} transparent opacity={0.6} />
    </points>
  );
}

/* ── Bugs ── */
function Bugs({ visible }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const count = 100;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      arr[i]     = (Math.random() - 0.5) * 10;
      arr[i + 1] = Math.random() * 3 + 1;
      arr[i + 2] = (Math.random() - 0.5) * 10;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current || !visible) return;
    const time = clock.getElapsedTime();
    const pos  = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i]     += Math.sin(time * 2 + i) * 0.02;
      pos[i + 1] += Math.cos(time * 3 + i) * 0.02;
      pos[i + 2] += Math.sin(time * 1.5 + i) * 0.02;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!visible) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={0x333333} size={0.05} />
    </points>
  );
}

/* ── Disease/Virus Spores ── */
function Disease({ visible }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const count = 150;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      arr[i]     = (Math.random() - 0.5) * 12;
      arr[i + 1] = Math.random() * 4 + 0.5;
      arr[i + 2] = (Math.random() - 0.5) * 6;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current || !visible) return;
    const time = clock.getElapsedTime();
    const pos  = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += Math.sin(time * 0.5 + i) * 0.005;
      pos[i]     += Math.cos(time * 0.2 + i) * 0.002;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!visible) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={0x8eff8e} size={0.12} transparent opacity={0.8} />
    </points>
  );
}

/* ─────────────── WEATHER ROOT ─────────────── */
export default function WeatherEffects() {
  const { state } = useFarm();
  const w = state.currentWeather;

  return (
    <>
      <AmbientParticles />
      <Rain   visible={w === 'rain' || w === 'thunder'} />
      <Bugs   visible={w === 'insects'} />
    </>
  );
}
