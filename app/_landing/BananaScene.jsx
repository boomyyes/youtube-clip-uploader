"use client";
"use no memo"; // three.js mutates objects every frame by design; keep React Compiler out of this file
/* eslint-disable react-hooks/immutability */
// 3D landing scene + ASCII pixel-glyph pass (generated design, used as provided).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

const INK = "#0A0D12";
const YEL = "#F5C842";
const AMB = "#F9B224";
const ORG = "#E8412C";
const MINT = "#B6F36B";
const TIP = "#5C3A14";

const input = { mx: 0, my: 0, scroll: 0 };

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Procedural banana: tapered tube swept along a curved path with end tips */
function createBananaGeometry() {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-1.0, -0.42, 0.0),
      new THREE.Vector3(-0.62, -0.05, 0.05),
      new THREE.Vector3(-0.1, 0.18, 0.0),
      new THREE.Vector3(0.42, 0.22, -0.05),
      new THREE.Vector3(0.95, -0.05, 0.0),
    ],
    false,
    "catmullrom",
    0.5
  );
  const SEG = 48;
  const RAD = 14;
  const frames = curve.computeFrenetFrames(SEG, false);
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const skin = new THREE.Color(YEL);
  const shade = new THREE.Color("#D9A82C");
  const tip = new THREE.Color(TIP);
  const p = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    curve.getPoint(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const taper = Math.pow(Math.sin(Math.PI * Math.min(Math.max(t, 0.001), 0.999)), 0.65);
    const r = 0.045 + 0.185 * taper;
    for (let j = 0; j <= RAD; j++) {
      const a = (j / RAD) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      positions.push(
        p.x + N.x * ca * r + B.x * sa * r * 0.88,
        p.y + N.y * ca * r + B.y * sa * r * 0.88,
        p.z + N.z * ca * r + B.z * sa * r * 0.88
      );
      const c = skin.clone().lerp(shade, ((sa + 1) / 2) * 0.35);
      const tipAmt = t < 0.07 ? 1 - t / 0.07 : t > 0.93 ? (t - 0.93) / 0.07 : 0;
      c.lerp(tip, tipAmt);
      colors.push(c.r, c.g, c.b);
      uvs.push(t, j / RAD);
    }
  }
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j;
      const b = a + RAD + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function Banana({ geo, cfg }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.position.set(cfg.x, cfg.y - input.scroll * cfg.drop + Math.sin(t * cfg.fs + cfg.ph) * cfg.amp, cfg.z);
    ref.current.rotation.set(cfg.rx + t * cfg.sx * cfg.spin, cfg.ry + t * cfg.sy * cfg.spin, cfg.rz + t * cfg.sz * cfg.spin);
  });
  return (
    <group ref={ref} scale={cfg.s}>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[-1.0, -0.42, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={TIP} roughness={0.8} />
      </mesh>
      <mesh position={[0.95, -0.05, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={TIP} roughness={0.8} />
      </mesh>
    </group>
  );
}

function World({ count, offX }) {
  const g = useRef();
  const geo = useMemo(() => createBananaGeometry(), []);
  const bananas = useMemo(() => {
    const rnd = mulberry32(7);
    return Array.from({ length: count }, () => ({
      x: (rnd() - 0.5) * 8,
      y: (rnd() - 0.5) * 5.5,
      z: (rnd() - 0.5) * 4 - 0.5,
      s: 0.7 + rnd() * 0.95,
      fs: 0.4 + rnd() * 0.7,
      ph: rnd() * Math.PI * 2,
      amp: 0.25 + rnd() * 0.35,
      rx: rnd() * Math.PI,
      ry: rnd() * Math.PI,
      rz: rnd() * Math.PI,
      sx: rnd() * 2 - 1,
      sy: rnd() * 2 - 1,
      sz: rnd() * 2 - 1,
      spin: 0.15 + rnd() * 0.3,
      drop: 1.5 + rnd() * 2.5,
    }));
  }, [count]);
  useFrame(() => {
    g.current.rotation.y = input.scroll * 0.55;
  });
  return (
    <group ref={g} position={[offX, 0, 0]}>
      {bananas.map((cfg, i) => (
        <Banana key={i} geo={geo} cfg={cfg} />
      ))}
    </group>
  );
}

function makeFilmTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#10151E";
  ctx.fillRect(0, 0, 1024, 160);
  for (let i = 0; i < 8; i++) {
    const x = i * 128 + 12;
    ctx.fillStyle = i % 2 ? AMB : YEL;
    ctx.fillRect(x, 24, 104, 80);
    ctx.fillStyle = INK;
    const glyph = [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2], [1, 3], [2, 4], [3, 3]];
    glyph.forEach(([gx, gy], k) => {
      if (k % 2 === i % 2) ctx.fillRect(x + 32 + gx * 9, 40 + gy * 12, 8, 10);
    });
  }
  ctx.fillStyle = INK;
  for (let i = 0; i < 32; i++) {
    ctx.fillRect(i * 32 + 10, 6, 12, 8);
    ctx.fillRect(i * 32 + 10, 146, 12, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function FilmStrip({ offX }) {
  const ref = useRef();
  const texture = useMemo(() => makeFilmTexture(), []);
  useFrame((state) => {
    ref.current.rotation.z = state.clock.elapsedTime * 0.08;
  });
  return (
    <group position={[offX, 0, 0]} rotation={[1.18, 0, 0.14]}>
      <mesh ref={ref}>
        <cylinderGeometry args={[3.2, 3.2, 1.05, 96, 1, true]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function UploadSlot({ offX }) {
  const ref = useRef();
  useFrame((state) => {
    ref.current.material.opacity = 0.22 + Math.sin(state.clock.elapsedTime * 1.4) * 0.08 + input.scroll * 0.45;
  });
  return (
    <mesh ref={ref} position={[offX, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.5, 0.045, 8, 64]} />
      <meshBasicMaterial color={MINT} transparent opacity={0.25} toneMapped={false} />
    </mesh>
  );
}

function Rig() {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.x += (input.mx * 1.1 - camera.position.x) * 0.045;
    camera.position.y += (0.4 + input.my * -0.6 - camera.position.y) * 0.045;
    camera.lookAt(0, 0.1, 0);
  });
  return null;
}

/* ASCII / pixel-glyph post pass: renders the scene into a low-res target,
   then draws glyph cells (dark = white ✕, mid = amber tiles, high = orange blocks) */
const ASCIIVERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const ASCIIFRAG = `
precision mediump float;
uniform sampler2D uMap;
uniform vec2 uRes;
varying vec2 vUv;

float crossDist(vec2 p) {
  float d1 = abs(p.x - p.y);
  float d2 = abs(p.x + p.y - 1.0);
  return min(d1, d2);
}

void main() {
  vec2 res = uRes;
  vec2 cellId = floor(vUv * res);
  vec2 cellUv = fract(vUv * res);
  vec2 suv = (cellId + 0.5) / res;
  vec3 src = texture2D(uMap, suv).rgb;
  float lum = dot(src, vec3(0.299, 0.587, 0.114));
  vec3 ink = vec3(0.039, 0.051, 0.071);
  vec3 muted = vec3(0.663, 0.706, 0.780);
  vec3 col = ink;
  if (lum < 0.12) {
    float d = crossDist(cellUv);
    col = ink + muted * step(d, 0.10) * 0.22;
  } else if (lum < 0.36) {
    col = ink * 1.9;
    float d = length(cellUv - 0.5);
    col += muted * step(d, 0.13) * 0.5;
  } else if (lum < 0.62) {
    col = vec3(0.976, 0.698, 0.141);
    float d = length(cellUv - 0.5);
    float ring = step(abs(d - 0.26), 0.07);
    col = mix(col, ink, ring);
  } else {
    col = vec3(0.910, 0.255, 0.173);
  }
  vec2 g = step(0.04, cellUv) * step(cellUv, vec2(0.96));
  col *= mix(0.55, 1.0, g.x * g.y);
  gl_FragColor = vec4(col, 1.0);
}
`;

function AsciiPass({ cell = 9 }) {
  const { gl, scene, camera, size } = useThree();
  const cellPx = useMemo(() => (window.matchMedia("(max-width: 768px)").matches ? cell + 4 : cell), [cell]);
  const target = useMemo(
    () => new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }),
    []
  );
  const { quadScene, quadCam, material } = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: target.texture }, uRes: { value: new THREE.Vector2(1, 1) } },
      vertexShader: ASCIIVERT,
      fragmentShader: ASCIIFRAG,
      depthTest: false,
      depthWrite: false,
    });
    const quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { quadScene, quadCam, material };
  }, [target]);
  useEffect(
    () => () => {
      target.dispose();
      material.dispose();
    },
    [target, material]
  );
  useFrame(() => {
    const dpr = Math.min(gl.getPixelRatio(), 2);
    const w = Math.max(1, Math.floor((size.width * dpr) / cellPx));
    const h = Math.max(1, Math.floor((size.height * dpr) / cellPx));
    if (target.width !== w || target.height !== h) target.setSize(w, h);
    material.uniforms.uRes.value.set(w, h);
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(quadScene, quadCam);
  }, 1);
  return null;
}

export default function BananaScene() {
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(true);
  const mobile = useMemo(() => window.matchMedia("(max-width: 768px)").matches, []);

  useEffect(() => {
    let inView = true;
    let hidden = document.hidden;
    const update = () => setVisible(inView && !hidden);
    const io = new IntersectionObserver(
      (es) => {
        inView = es[0].isIntersecting;
        update();
      },
      { threshold: 0 }
    );
    if (wrapRef.current) io.observe(wrapRef.current);
    const onVis = () => {
      hidden = document.hidden;
      update();
    };
    const onScroll = () => {
      input.scroll = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.85)));
    };
    const onMove = (e) => {
      input.mx = (e.clientX / window.innerWidth) * 2 - 1;
      input.my = (e.clientY / window.innerHeight) * 2 - 1;
    };
    onScroll();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={wrapRef} className="scene-layer" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
        camera={{ fov: 42, position: [0, 0.4, 9], near: 0.1, far: 40 }}
      >
        <color attach="background" args={[INK]} />
        <fog attach="fog" args={[INK, 9, 18]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 5]} intensity={2.4} color="#FFE9A8" />
        <pointLight position={[-6, -2, 2]} intensity={40} color={MINT} distance={14} />
        <pointLight position={[6, 2, -3]} intensity={60} color={ORG} distance={16} />
        <World count={mobile ? 6 : 11} offX={mobile ? 0 : 1.9} />
        <FilmStrip offX={mobile ? 0 : 1.9} />
        <UploadSlot offX={mobile ? 0 : 1.9} />
        <Rig />
        <AsciiPass cell={10} />
      </Canvas>
    </div>
  );
}
