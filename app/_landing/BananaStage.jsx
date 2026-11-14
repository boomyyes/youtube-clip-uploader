"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Fixed background showcase for the landing page: the Blender banana, shot in macro close-ups.
// Each section names a camera pose with data-pose; the camera eases between poses, drifts slowly,
// and the key light follows the pointer. Poses mirror the Blender cameras (Blender XYZ -> three X,Z,-Y).
export const POSES = {
  hero: { pos: [-0.6, -0.1, 3.6], target: [0.2, 0.3, 0], lens: 50 },
  stem: { pos: [1.55, 1.15, 1.05], target: [1.05, 0.62, 0], lens: 70 },
  ridge: { pos: [-0.4, 0.75, 1.3], target: [0.25, 0.1, 0], lens: 45 },
  under: { pos: [0.2, -0.9, 1.7], target: [0, 0.02, 0], lens: 55 },
  close: { pos: [0.1, 1.6, 7.5], target: [0.1, 0.25, 0], lens: 60 },
};
const MOVE_SECONDS = 1.4;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// Horizontal framing matches Blender's 36 mm sensor; narrow screens keep that width, so they see less height.
const fovFor = (lens, aspect) => THREE.MathUtils.radToDeg(2 * Math.atan(18 / lens / Math.max(aspect, 0.9)));

// The section whose box crosses the middle of the viewport decides the pose.
function activePose() {
  const mid = innerHeight / 2;
  for (const el of document.querySelectorAll("[data-pose]")) {
    const r = el.getBoundingClientRect();
    if (r.top <= mid && r.bottom > mid) return el.dataset.pose;
  }
  return "hero";
}

function Banana({ onReady }) {
  const gltf = useLoader(GLTFLoader, "/models/banana.glb", (l) => l.setMeshoptDecoder(MeshoptDecoder));
  useEffect(() => {
    gltf.scene.traverse((o) => {
      if (o.isMesh) o.material.envMapIntensity = 0.6;
    });
    onReady();
  }, [gltf, onReady]);
  return <primitive object={gltf.scene} />;
}

function Rig({ pose, pointer, boost }) {
  const key = useRef(null);
  const move = useRef(null);
  const look = useRef(new THREE.Vector3(...POSES.hero.target));
  const light = useRef(new THREE.Vector2());

  // Everything is written through the frame state (what three renders), never through hook return values.
  useFrame(({ clock, camera, size }, dt) => {
    const now = clock.elapsedTime;
    const want = POSES[pose.current] ?? POSES.hero;
    // New pose: tween from wherever the camera is now, so an interrupted move never jumps.
    if (!move.current || move.current.to !== want) {
      move.current = { to: want, t0: now, pos: camera.position.clone(), look: look.current.clone(), fov: camera.fov };
    }
    const m = move.current;
    const e = ease(Math.min(1, (now - m.t0) / MOVE_SECONDS));
    const base = m.pos.clone().lerp(new THREE.Vector3(...m.to.pos), e);
    look.current.copy(m.look).lerp(new THREE.Vector3(...m.to.target), e);

    // Pointer parallax + slow idle drift, damped so it floats rather than tracks.
    const p = pointer.current;
    light.current.x = THREE.MathUtils.damp(light.current.x, p.x, 3, dt);
    light.current.y = THREE.MathUtils.damp(light.current.y, p.y, 3, dt);
    const dist = base.distanceTo(look.current);
    const drift = new THREE.Vector3(Math.sin(now * 0.21) * 0.02, Math.sin(now * 0.17) * 0.015, 0).multiplyScalar(dist);
    const offset = new THREE.Vector3(light.current.x * 0.05, -light.current.y * 0.035, 0).multiplyScalar(dist);
    camera.position.copy(base).add(drift).add(offset);
    // A CTA under the pointer pushes the camera in a touch.
    camera.position.lerp(look.current, boost.current * 0.05);
    camera.lookAt(look.current);
    const fov = fovFor(m.to.lens, size.width / size.height);
    camera.fov = THREE.MathUtils.lerp(m.fov, fov, e);
    camera.updateProjectionMatrix();

    // Raking key from the top left; the pointer slides it across the skin.
    if (key.current) {
      key.current.position.set(-2.6 + light.current.x * 2.2, 2.4 - light.current.y * 1.6, 2.7);
      key.current.intensity = 38 * (1 + boost.current * 0.35);
    }
  });

  return (
    <>
      <spotLight ref={key} color="#fff4e2" angle={0.75} penumbra={1} decay={2} distance={0} position={[-2.6, 2.4, 2.7]} />
      <directionalLight color="#ffffff" intensity={0.22} position={[2.8, 0.6, -0.8]} />
      <pointLight color="#ffd27a" intensity={0.5} position={[0.3, -1.6, 0.5]} />
    </>
  );
}

// Dim studio reflections only; the backdrop itself is CSS behind the transparent canvas.
function studio({ gl, scene }) {
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  gl.toneMappingExposure = 1.0;
  pmrem.dispose();
}

const hasWebGL = () => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } };

export default function BananaStage() {
  const reduced = useReducedMotion();
  const [webgl] = useState(() => typeof window !== "undefined" && hasWebGL());
  const [ready, setReady] = useState(false);
  const [poster, setPoster] = useState("hero");
  const pose = useRef("hero");
  const pointer = useRef({ x: 0, y: 0 });
  const boost = useRef(0);
  const live = webgl && !reduced;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = activePose();
      if (p !== pose.current) { pose.current = p; setPoster(p); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const move = (e) => { pointer.current = { x: e.clientX / innerWidth * 2 - 1, y: e.clientY / innerHeight * 2 - 1 }; };
    const over = (e) => { boost.current = e.target.closest?.(".mag") ? 1 : 0; };
    addEventListener("pointermove", move);
    addEventListener("pointerover", over);
    return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", move); removeEventListener("pointerover", over); };
  }, []);

  return (
    <div className="stage" aria-hidden="true">
      {/* Stills from the same Blender cameras, only when the live scene is off (reduced motion / no WebGL).
          While the model loads the backdrop stays empty, so the banana fades in once instead of over a still. */}
      {Object.keys(POSES).map((k) => (
        <img key={k} src={`/assets/banana-${k}.webp`} alt="" className="stage-poster" data-on={!live && poster === k ? "" : undefined} />
      ))}
      {live && (
        <Canvas className="stage-canvas" data-ready={ready ? "" : undefined} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}
          camera={{ fov: 30, near: 0.05, far: 50, position: POSES.hero.pos }} onCreated={studio}>
          <Suspense fallback={null}>
            <Banana onReady={() => setReady(true)} />
          </Suspense>
          <Rig pose={pose} pointer={pointer} boost={boost} />
        </Canvas>
      )}
      <div className="stage-edge" />
    </div>
  );
}
