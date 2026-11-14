"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ShaderMaterial } from "three";
import { usePathname } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";

// One liquid-chrome object per page, ray-marched in a fragment shader (no model files).
// Shapes: 0 banana, 1 upload arrow, 2 play, 3 tick. Changing page blends the old shape into the new one.
// Distance functions after Inigo Quilez (iquilezles.org/articles/distfunctions).
const SHAPE_FOR: Record<string, number> = { "/upload": 1, "/clips": 2, "/admin": 3, "/admin/members": 3 };
const MORPH_SECONDS = 0.8;

const frag = /* glsl */ `
precision highp float;
uniform vec2 uRes; uniform vec2 uMouse; uniform float uTime; uniform float uMix; uniform int uFrom; uniform int uTo;
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float capsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r; }
float banana(vec3 p){
  p.xy = rot(-0.5)*p.xy; p.y += 0.55;
  vec2 sc = vec2(sin(1.05), cos(1.05)); float ra = 0.95;
  vec3 q = p; q.x = abs(q.x);
  float k = (sc.y*q.x > sc.x*q.y) ? dot(q.xy, sc) : length(q.xy);
  float t = clamp(atan(q.x, q.y) / 1.05, 0., 1.);
  float d = sqrt(dot(q,q) + ra*ra - 2.*ra*k) - 0.24*(1. - 0.6*t*t);
  return min(d, capsule(p, vec3(-0.85, 0.5, 0.), vec3(-0.98, 0.42, 0.), 0.06)); // stem
}
float arrow(vec3 p){
  float d = capsule(p, vec3(0.,-0.75,0.), vec3(0.,0.55,0.), 0.17);
  d = min(d, capsule(p, vec3(0.,0.78,0.), vec3(-0.52,0.26,0.), 0.17));
  return min(d, capsule(p, vec3(0.,0.78,0.), vec3(0.52,0.26,0.), 0.17));
}
float play(vec3 p){
  p.xy = vec2(-p.y, p.x); // point right
  vec3 q = abs(p); vec2 h = vec2(0.95, 0.22);
  return max(q.z - h.y, max(q.x*0.866025 + p.y*0.5, -p.y) - h.x*0.5) - 0.12;
}
float tick(vec3 p){
  return min(capsule(p, vec3(-0.6,0.05,0.), vec3(-0.15,-0.42,0.), 0.18), capsule(p, vec3(-0.15,-0.42,0.), vec3(0.65,0.55,0.), 0.18));
}
float shape(int i, vec3 p){ return i==1 ? arrow(p) : i==2 ? play(p) : i==3 ? tick(p) : banana(p); }
float hash(float n){ return fract(sin(n)*43758.5453); }
float smin(float a, float b, float k){ k = max(k, 1e-4); float h = clamp(0.5 + 0.5*(b-a)/k, 0., 1.); return mix(b, a, h) - k*h*(1.-h); }
// Sweat: 4 drops, each on its own cycle. A drop beads out of the underside (smooth union), then falls
// with gravity, stretching as it speeds up. Drops use world space, so they fall straight down however the shape turns.
float sweat(vec3 p, float d){
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ph = uTime*0.32 + fi*0.27 + hash(fi)*0.5;
    float cyc = floor(ph), t = fract(ph);
    float x = (hash(cyc*7.13 + fi*3.31) - 0.5) * 1.1;
    float z = (hash(cyc*1.71 + fi*5.17) - 0.5) * 0.3;
    float y = -0.2 - 2.8*t*t;
    float r = 0.032 + 0.022*hash(cyc*3.9 + fi*9.1);
    vec3 q = p - vec3(x, y, z);
    q.y /= 1. + 1.8*t; // stretch into a teardrop while falling
    d = smin(d, length(q) - r, 0.1*(1. - t)*(1. - t)); // a thin neck that pinches off early
  }
  return d;
}
float body(vec3 p){
  vec3 q = p;
  q.xz = rot(0.45*sin(uTime*0.35) + uMouse.x*0.5)*q.xz;
  q.yz = rot(-uMouse.y*0.35)*q.yz;
  return mix(shape(uFrom, q), shape(uTo, q), smoothstep(0., 1., uMix));
}
float map(vec3 p){ return sweat(p, body(p)); }
vec3 normalAt(vec3 p){ vec2 e = vec2(1.,-1.)*0.0015; return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx)); }
// Studio: hard-edged softbox top-left, thin strip lights right and left, banana bounce from below, black elsewhere.
// Sharp light edges + deep black between them is what reads as polished chrome rather than satin.
vec3 env(vec3 r){
  vec3 c = vec3(0.004);
  c += vec3(2.2) * smoothstep(0.72, 0.76, dot(r, normalize(vec3(-0.6, 0.75, 0.3))));
  c += vec3(1.2) * smoothstep(0.90, 0.92, r.y) * smoothstep(0.7, 0.5, abs(r.x));
  c += vec3(1.8) * smoothstep(0.86, 0.88, r.x) * smoothstep(0.6, 0.5, abs(r.y));
  c += vec3(0.9) * smoothstep(0.93, 0.95, -r.x) * smoothstep(0.3, 0.2, abs(r.y - 0.1));
  c += vec3(1.0, 0.88, 0.21) * 1.4 * smoothstep(-0.35, -0.6, r.y);
  c += vec3(0.08) * smoothstep(0.02, 0.0, abs(r.y + 0.05)); // faint horizon line
  return c;
}
void main(){
  vec2 uv = (gl_FragCoord.xy*2. - uRes) / uRes.y;
  vec3 ro = vec3(0., 0., 4.4), rd = normalize(vec3(uv, -1.9));
  float t = 0.; bool hit = false;
  for (int i = 0; i < 110; i++) { float d = map(ro + rd*t); if (d < 0.001) { hit = true; break; } t += d; if (t > 8.) break; }
  if (!hit) { gl_FragColor = vec4(0.); return; }
  vec3 pos = ro + rd*t, n = normalAt(pos);
  float fres = pow(1. - max(dot(n, -rd), 0.), 5.);
  vec3 refl = env(reflect(rd, n));
  float spec = pow(max(dot(reflect(rd, n), normalize(vec3(-0.5, 0.7, 0.5))), 0.), 180.) * 6.;
  if (body(pos) > 0.004) {
    // Sweat: clear water, not chrome. Mostly see-through, a bright rim, a pin-point glint, a hint of refraction.
    float rim = pow(1. - max(dot(n, -rd), 0.), 2.);
    float glint = pow(max(dot(reflect(rd, n), normalize(vec3(-0.5, 0.7, 0.5))), 0.), 40.) * 4.;
    vec3 refr = env(refract(rd, n, 0.75)) * 0.5;
    vec3 col = refr + refl * (0.3 + 0.7*rim) + vec3(0.85, 0.92, 1.) * (rim*0.6 + glint);
    float a = clamp(0.06 + 0.9*rim + glint + dot(refl, vec3(0.3)), 0., 1.);
    gl_FragColor = vec4(pow(col, vec3(0.4545)), a); // blending multiplies by alpha
    return;
  }
  vec3 col = refl * (0.9 + 0.6*fres) + spec;
  col = col / (1. + col*0.25); // soft roll-off so bright highlights don't flatten
  gl_FragColor = vec4(pow(col, vec3(0.4545)), 1.);
}`;
const vert = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0., 1.); }`;

// Starts as the banana, so the first page load morphs from the banana into that page's shape.
const initialUniforms = () => ({
  uRes: { value: [1, 1] }, uMouse: { value: [0, 0] }, uTime: { value: 0 },
  uMix: { value: 1 }, uFrom: { value: 0 }, uTo: { value: 0 },
});

function Scene({ target }: { target: number }) {
  const mat = useRef<ShaderMaterial>(null);
  const [uniforms] = useState(initialUniforms);
  const mouse = useRef([0, 0]);
  useEffect(() => {
    const move = (e: PointerEvent) => { mouse.current = [e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1]; };
    addEventListener("pointermove", move);
    return () => removeEventListener("pointermove", move);
  }, []);
  // Uniforms are written through the material (what the GPU actually reads), never through React state.
  useFrame((state, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    if (u.uTo.value !== target) {
      u.uFrom.value = u.uMix.value < 0.5 ? u.uFrom.value : u.uTo.value;
      u.uTo.value = target;
      u.uMix.value = 0;
    }
    u.uTime.value += dt;
    u.uMix.value = Math.min(1, u.uMix.value + dt / MORPH_SECONDS);
    const [mx, my] = u.uMouse.value;
    u.uMouse.value = [mx + (mouse.current[0] - mx) * 0.06, my + (mouse.current[1] - my) * 0.06];
    const { width, height } = state.gl.domElement;
    u.uRes.value = [width, height];
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent />
    </mesh>
  );
}

const noop = () => () => {};
const hasWebGL = () => { try { return !!document.createElement("canvas").getContext("webgl"); } catch { return false; } };

export default function ChromeShape() {
  const path = usePathname();
  const reduced = useReducedMotion();
  const webgl = useSyncExternalStore(noop, hasWebGL, () => false);
  // The landing page has its own banana showcase (app/_landing/BananaStage.jsx).
  if (path === "/" || path === "/login" || path.startsWith("/privacy") || path.startsWith("/terms")) return null;
  const target = SHAPE_FOR[path] ?? 0;
  return (
    <div className="chrome-shape" aria-hidden="true">
      {webgl && !reduced ? (
        <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: false }} fallback={<img src="/assets/chrome-banana.png" alt="" />}>
          <Scene target={target} />
        </Canvas>
      ) : (
        <img src="/assets/chrome-banana.png" alt="" />
      )}
    </div>
  );
}
