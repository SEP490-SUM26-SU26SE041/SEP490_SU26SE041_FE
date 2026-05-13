import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFarm, TIME_STATES } from '../../context/FarmContext';

export default function SceneLighting() {
  const { state } = useFarm();
  const mainRef  = useRef();
  const ambRef   = useRef();
  const fillRef  = useRef();
  const rimRef   = useRef();
  const { scene } = useThree();

  const _bgColor  = useRef(new THREE.Color(0xf5f3ef));
  const _fogColor = useRef(new THREE.Color(0xf5f3ef));
  const _litColor = useRef(new THREE.Color(0xfff5e6));

  useFrame(() => {
    const ts = TIME_STATES[state.timeOfDay];
    const isGloomy = state.currentWeather === 'rain' || state.currentWeather === 'thunder';

    // Background + fog
    const bgTarget  = isGloomy ? 0x444455 : ts.bgHex;
    const fogTarget = isGloomy ? 0x444455 : ts.fogHex;
    _bgColor.current.lerp(new THREE.Color(bgTarget), 0.03);
    _fogColor.current.lerp(new THREE.Color(fogTarget), 0.03);
    scene.background.copy(_bgColor.current);
    if (scene.fog) scene.fog.color.copy(_fogColor.current);

    // Main directional light
    if (mainRef.current) {
      _litColor.current.lerp(new THREE.Color(ts.lightHex), 0.03);
      mainRef.current.color.copy(_litColor.current);
      const targetIntensity = isGloomy ? ts.intensity * 0.4 : ts.intensity;
      mainRef.current.intensity += (targetIntensity - mainRef.current.intensity) * 0.05;
    }
    if (ambRef.current) {
      const targetAmb = isGloomy ? 0.3 : 0.6;
      ambRef.current.intensity += (targetAmb - ambRef.current.intensity) * 0.05;
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} color={0xfff5e6} intensity={0.6} />
      <directionalLight
        ref={mainRef}
        color={0xfff8f0}
        intensity={1.2}
        position={[10, 20, 10]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.001}
      />
      <directionalLight ref={fillRef} color={0xe8f0ff} intensity={0.3} position={[-8, 10, -5]} />
      <directionalLight ref={rimRef}  color={0xffd4a6} intensity={0.4} position={[-5, 5, -10]} />
    </>
  );
}
