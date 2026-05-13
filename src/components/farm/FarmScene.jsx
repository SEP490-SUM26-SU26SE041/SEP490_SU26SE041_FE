import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { useFarm, TIME_STATES, MAX_SEEDS } from '../../context/FarmContext';
import SceneLighting  from './SceneLighting';
import Ground         from './Ground';
import Plants         from './Plants';
import IoTDevices     from './IoTDevices';
import WeatherEffects from './WeatherEffects';
import FarmProps      from './FarmProps';

/* ── Camera targets per section (matched to original index.js) ── */
const SECTION_CAMERAS = [
  { pos: [0, 6, 18],  lookAt: [0, 1,   0] }, // Overview
  { pos: [0, 8, 10],  lookAt: [0, 0.5, 0] }, // Planting
  { pos: [3, 5, 10],  lookAt: [0, 1.5, 0] }, // Growing
  { pos: [0, 7, 14],  lookAt: [0, 1,   0] }, // Monitoring
];

/* ── Inner scene component (has access to useThree/useFrame) ── */
function SceneInner({
  orbitRef, animStartRef, hoveredRef,
  seedsRef, bagRef, canRef, dropsRef,
  aiCameraRef
}) {
  const { state, dispatch } = useFarm();
  const { camera, raycaster, scene, clock } = useThree();
  const isAutoCam = useRef(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const lastSensorUpdate = useRef(0);

  useEffect(() => {
    setUserInteracted(false);
  }, [state.currentSection]);

  const pipFrameCounter = useRef(0);

  // FBO to store last PiP frame — prevents flicker from throttled render
  const pipTarget = useMemo(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return new THREE.WebGLRenderTarget(320 * dpr, 200 * dpr, {
      format: THREE.RGBAFormat, depthBuffer: true,
    });
  }, []);

  // Simple full-screen quad to blit FBO texture to screen
  const pipBlitScene = useMemo(() => {
    const s = new THREE.Scene();
    const mat = new THREE.MeshBasicMaterial({ map: null, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    s.add(quad);
    return s;
  }, []);
  const orthoCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  const targetPos  = useRef(new THREE.Vector3(0, 6, 18));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const mouse2D    = useRef(new THREE.Vector2());

  // Window-level mouse tracking (works even without a visible mesh)
  const setupMouseListener = useRef(false);
  if (!setupMouseListener.current) {
    setupMouseListener.current = true;
    window.addEventListener('mousemove', (e) => {
      mouse2D.current.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      mouse2D.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  const prevSection = useRef(-1);
  const prevPlantingState = useRef(state.plantingState);
  const lastSectionChange = useRef(0);
  const now = clock.getElapsedTime();

  // 1. SECTION TRANSITION LOGIC
  if (prevSection.current !== state.currentSection) {
    prevSection.current = state.currentSection;
    lastSectionChange.current = now;
    const cam = SECTION_CAMERAS[state.currentSection];
    targetPos.current.set(...cam.pos);
    targetLook.current.set(...cam.lookAt);
    isAutoCam.current = true;

    if (state.currentSection === 2) {
      // Transition to Growing: Show plants
      for (let i = 0; i < 15; i++) {
        const row = Math.floor(i / 5), col = i % 5;
        const delay = i * 60;
        if (i < 5) setTimeout(() => { animStartRef.current[`s_${row}_${col}`] = clock.getElapsedTime(); }, delay);
        else        setTimeout(() => { animStartRef.current[`p_${row}_${col}`] = clock.getElapsedTime(); }, delay);
      }
    }

    if (state.currentSection === 3) {
      // Transition to Monitoring: All plants visible + IoT staggered
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 5; col++)
          animStartRef.current[`p_${row}_${col}`] = now;
      for (let i = 0; i < 6; i++)
        setTimeout(() => { animStartRef.current[`iot_${i}`] = clock.getElapsedTime(); }, i * 150);
    }
  }

  // 2. GERMINATION TRANSITION LOGIC (Random staggered sprouts)
  if (prevPlantingState.current !== state.plantingState && state.plantingState === 'germinated') {
    const indices = Array.from({ length: 15 }, (_, i) => i);
    // Shuffle indices for random sprout order
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    indices.forEach((idx, i) => {
      const row = Math.floor(idx / 5), col = idx % 5;
      const delay = i * 400; // 400ms between each sprout
      setTimeout(() => {
        animStartRef.current[`s_${row}_${col}`] = clock.getElapsedTime();
      }, delay);
    });
  }
  prevPlantingState.current = state.plantingState;

  useFrame(({ gl, scene, camera, clock }) => {
    const time = clock.getElapsedTime();

    // Ensure main camera can see the light cone (layer 1)
    camera.layers.enable(1);

    // 1. RENDER MAIN SCENE
    gl.setViewport(0, 0, window.innerWidth, window.innerHeight);
    gl.setScissor(0, 0, window.innerWidth, window.innerHeight);
    gl.setScissorTest(true);
    gl.clear();
    gl.render(scene, camera);

    // 2. RENDER AI CAMERA PiP — FBO approach: re-render scene every 3 frames, blit every frame
    if (state.currentSection === 3 && state.isAiViewActive && aiCameraRef?.current) {
      const w = 320;
      const h = 200;
      const dpr = gl.getPixelRatio();
      // Fixed position: bottom-right corner (matches CSS)
      const x = window.innerWidth - w - 24;
      const y = 30;

      // Re-render the 3D scene into FBO only every 2nd frame
      pipFrameCounter.current = (pipFrameCounter.current + 1) % 2;
      if (pipFrameCounter.current === 0) {
        if (!window.__cachedLightCones) {
          window.__cachedLightCones = [];
          scene.traverse(child => {
            if (child.userData?.isLightCone) window.__cachedLightCones.push(child);
          });
        }
        window.__cachedLightCones.forEach(c => c.visible = false);
        aiCameraRef.current.aspect = w / h;

        // Apply pan offset (yaw/pitch from drag) as camera rotation
        const pan = window.__aiPanOffset || { yaw: 0, pitch: 0 };
        aiCameraRef.current.rotation.order = 'YXZ';
        aiCameraRef.current.rotation.y = (pan.yaw  * Math.PI) / 180;
        aiCameraRef.current.rotation.x = (pan.pitch * Math.PI) / 180;

        aiCameraRef.current.updateProjectionMatrix();
        
        // Disable shadow map auto-update for PiP render (reuses main scene shadows)
        gl.shadowMap.autoUpdate = false;
        gl.setRenderTarget(pipTarget);
        gl.clear();
        gl.render(scene, aiCameraRef.current);
        gl.setRenderTarget(null);
        gl.shadowMap.autoUpdate = true;
        
        window.__cachedLightCones.forEach(c => c.visible = true);
        // Update blit quad texture
        pipBlitScene.children[0].material.map = pipTarget.texture;
        pipBlitScene.children[0].material.needsUpdate = true;
      }

      // Blit FBO to screen EVERY frame (just a texture copy — very cheap, no flicker)
      if (pipBlitScene.children[0].material.map) {
        gl.setViewport(x * dpr, y * dpr, w * dpr, h * dpr);
        gl.setScissor(x * dpr, y * dpr, w * dpr, h * dpr);
        gl.setScissorTest(true);
        gl.render(pipBlitScene, orthoCam);
        // Reset
        gl.setViewport(0, 0, window.innerWidth * dpr, window.innerHeight * dpr);
        gl.setScissor(0, 0, window.innerWidth * dpr, window.innerHeight * dpr);
      }
    }

    // Auto-camera lerp
    if (isAutoCam.current) {
      camera.position.lerp(targetPos.current, 0.05);
      if (orbitRef.current) orbitRef.current.target.lerp(targetLook.current, 0.05);
      if (camera.position.distanceTo(targetPos.current) < 0.1) {
        isAutoCam.current = false;
      }
    }

    // Seed bag follows mouse (during seeding)
    if (state.plantingState === 'seeding' && bagRef.current) {
      const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), -6);
      raycaster.setFromCamera(mouse2D.current, camera);
      const pt = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeY, pt);
      if (pt.lengthSq() > 0) bagRef.current.position.lerp(pt, 0.1);
    }

    // Thunder lightning flash
    if (state.currentWeather === 'thunder' && Math.random() > 0.98) {
      scene.children.forEach(c => {
        if (c.isDirectionalLight && c.intensity > 0.5) {
          c.intensity = 5;
          setTimeout(() => { c.intensity = TIME_STATES[state.timeOfDay].intensity; }, 50);
        }
      });
    }

    // Raycasting for Tooltips (Section 3)
    if (state.currentSection === 3) {
      raycaster.setFromCamera(mouse2D.current, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const plantIntersect = intersects.find(i => i.object.parent?.userData?.type === 'plant');
      
      if (plantIntersect) {
        const p = plantIntersect.object.parent.userData;
        const id = `p_${p.row}_${p.col}`;
        if (hoveredRef.current !== id) {
          hoveredRef.current = id;
          dispatch({ type: 'NOTIFY', text: `Đang kiểm tra: ${p.variety}`, color: '#2ecc71' });
        }
      } else {
        hoveredRef.current = null;
      }
    }

    // Sensor data updates (section 3) - Throttled to 2fps to prevent React re-render flood
    if (state.currentSection === 3) {
      if (time - lastSensorUpdate.current > 0.5) {
        lastSensorUpdate.current = time;
        const base = TIME_STATES[state.timeOfDay];
        const w = state.currentWeather;
        let sd = { ...state.sensorData };
        let tMoist = base.moisture + (w === 'rain' || w === 'thunder' ? 20 : 0);
        let tTemp  = base.temp    - (w === 'rain' || w === 'thunder' ? 5  : 0);
        let tLight = base.lux    * (w === 'rain' || w === 'thunder' ? 0.3 : 1);
        let tAI    = 98 - (w === 'insects' ? 30 : 0) - (w === 'disease' ? 60 : 0);
        sd.moisture    += (tMoist + Math.sin(time * 0.5) * 2 - sd.moisture)    * 0.05;
        sd.temperature += (tTemp  + Math.sin(time * 0.3) * 1 - sd.temperature) * 0.05;
        sd.light       += (tLight + Math.sin(time * 0.7) * 20 - sd.light)      * 0.05;
        sd.ph           = base.ph + Math.sin(time * 0.2) * 0.1;
        sd.ai          += (tAI   + Math.sin(time * 0.4) * 2 - sd.ai)          * 0.05;
        dispatch({ type: 'UPDATE_SENSORS', payload: sd });
      }
    }
  }, 1); // priority 1 takes over the default render loop

  const onMouseMove = useCallback(() => {}, []); // handled by window listener above

  // Disable auto-cam on manual interaction
  const onInteract = () => {
    // Ignore interactions for 2s during camera transition to avoid false triggers
    if (clock.getElapsedTime() - lastSectionChange.current < 2.0) return;
    
    isAutoCam.current = false;
    setUserInteracted(true);
  };

  // Drop seed on canvas click during seeding
  const onCanvasClick = useCallback(() => {
    if (state.plantingState !== 'seeding') return;
    if (state.seedsPlanted >= MAX_SEEDS) return;

    const idx = state.seedsPlanted;
    const row = Math.floor(idx / 5);
    const col = idx % 5;
    const targetX = (col - 2) * 2.2;
    const targetZ = (row - 1) * 1.8;
    
    // Each click drops 3 tiny seeds into the specific grid pot
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const bx = bagRef.current?.position.x ?? 0;
        const bz = bagRef.current?.position.z ?? 0;
        seedsRef.current.push({
          x: bx + (Math.random() - 0.5) * 0.2,
          y: (bagRef.current?.position.y ?? 6) - 0.5,
          z: bz + (Math.random() - 0.5) * 0.2,
          targetY: 0.58,
          speed: 0.18 + Math.random() * 0.05,
          rx: Math.random() * Math.PI,
          ry: Math.random() * Math.PI,
          rz: Math.random() * Math.PI,
          targetGridX: targetX + (Math.random() - 0.5) * 0.3,
          targetGridZ: targetZ + (Math.random() - 0.5) * 0.3,
          done: false,
          colorIdx: row % 3,
        });
      }, i * 100);
    }

    const nextCount = idx + 1;
    dispatch({ type: 'SET_SEEDS', payload: nextCount });
    
    if (nextCount >= MAX_SEEDS) {
      dispatch({ type: 'SET_PLANTING', payload: 'planted' });
      dispatch({ type: 'NOTIFY', text: 'Gieo hạt hoàn tất! Hãy tưới nước.', color: '#2ecc71' });
    }
  }, [state.plantingState, state.seedsPlanted, dispatch, seedsRef, bagRef]);

  return (
    <>
      {/* Click plane for seed dropping (always slightly visible so events fire) */}
      {state.plantingState === 'seeding' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 6, 0]}
          onClick={onCanvasClick}
        >
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      <SceneLighting />
      <Ground />
      <Plants    animStartRef={animStartRef} hoveredRef={hoveredRef} seedsRef={seedsRef} />
      <IoTDevices animStartRef={animStartRef} aiCameraRef={aiCameraRef} />
      <WeatherEffects />
      <FarmProps bagRef={bagRef} canRef={canRef} dropsRef={dropsRef} />

      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.05}
        enablePan={false}
        autoRotate={userInteracted}
        autoRotateSpeed={0.5}
        minDistance={5}
        maxDistance={40}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        onStart={onInteract}
      />
    </>
  );
}

/* ─────────────── FARM SCENE (exported) ─────────────── */
export default function FarmScene() {
  // Shared refs across components
  const orbitRef    = useRef();
  const animStartRef = useRef({});  // { 'p_0_0': time, 's_0_0': time, 'iot_0': time }
  const hoveredRef  = useRef(null);
  const seedsRef    = useRef([]);
  const bagRef      = useRef();
  const canRef      = useRef();
  const dropsRef    = useRef([]);
  const aiCameraRef = useRef();

  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, zIndex: 1 }}
      camera={{ position: [0, 6, 18], fov: 45, near: 0.1, far: 200 }}
      shadows
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: 3, // THREE.ACESFilmicToneMapping
        toneMappingExposure: 1.1,
      }}
      onCreated={({ scene, gl }) => {
        scene.background = new THREE.Color(0xf5f3ef);
        scene.fog = new THREE.FogExp2(0xf5f3ef, 0.015);
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.autoClear = false;
      }}
    >
      <SceneInner
        orbitRef={orbitRef}
        animStartRef={animStartRef}
        hoveredRef={hoveredRef}
        seedsRef={seedsRef}
        bagRef={bagRef}
        canRef={canRef}
        dropsRef={dropsRef}
        aiCameraRef={aiCameraRef}
      />
    </Canvas>
  );
}
