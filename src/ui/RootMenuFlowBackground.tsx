import { useEffect, useRef } from "react";

// Root-menu fluid layer: a lightweight WebGL fragment shader that paints a
// TRANSPARENT liquid glow (soft cyan scan current + faint amber warning current +
// drifting motes + cursor flowmap + slow facility breathing) which is screen-blended
// over the static CSS facility photo. It does NOT render or displace the image, so it
// can never affect menu alignment. Motion stays on the side walls / floor; the central
// command frames stay calm and readable. No spaghetti lines — soft fbm density, not strokes.
//
// DPR≤1.5; paused on hidden tab; prefers-reduced-motion → one still frame; if WebGL is
// unavailable the canvas is simply transparent and the photo shows unchanged.

const MAX_DPR = 1.5;

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseAmp;
uniform float uReduce;

float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = m * p; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uReduce > 0.5 ? 4.0 : uTime;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // keep the central command column calm; energy lives on side walls + floor
  float sideL = smoothstep(0.30, 0.04, uv.x);
  float sideR = smoothstep(0.70, 0.97, uv.x);
  float floorM = smoothstep(0.32, 0.0, uv.y);
  float m = clamp(max(max(sideL, sideR), floorM * 0.85), 0.0, 1.0);

  // soft liquid cyan scan current (density, not lines) — autonomously flowing
  float warp = fbm(p * 2.0 + vec2(t * 0.07, -t * 0.045));
  float cyanD = smoothstep(0.46, 0.9, fbm(p * 2.4 + vec2(warp * 0.8, t * 0.07)));
  vec3 col = vec3(0.16, 0.78, 1.0) * cyanD * m * 0.6;

  // sparse amber warning current
  float amberD = smoothstep(0.72, 0.97, fbm(p * 1.6 - vec2(t * 0.03, 0.0) + 9.0));
  col += vec3(1.0, 0.6, 0.2) * amberD * m * 0.3;

  // autonomous roaming glows so the room always flows a little (no cursor needed)
  vec2 idleA = vec2(0.13 + 0.09 * sin(t * 0.13), 0.52 + 0.16 * cos(t * 0.17));
  vec2 idleB = vec2(0.87 - 0.08 * sin(t * 0.11), 0.46 + 0.18 * cos(t * 0.15));
  float gA = distance(uv, idleA);
  float gB = distance(uv, idleB);
  col += vec3(0.24, 0.84, 1.0) * (exp(-gA * gA * 17.0) * 0.4 + exp(-gB * gB * 17.0) * 0.34) * m;

  // cursor flowmap glow (sides only)
  float md = distance(uv, uMouse);
  col += vec3(0.3, 0.86, 1.0) * uMouseAmp * exp(-md * md * 22.0) * m * 0.6;

  // drifting specimen motes
  float spark = smoothstep(0.985, 1.0, fbm(p * 9.0 + vec2(0.0, t * 0.12)));
  col += vec3(0.6, 0.92, 1.0) * spark * m * 0.4;

  // slow facility breathing
  float breathe = 0.78 + 0.22 * sin(t * 6.2831 / 6.5);
  col *= breathe;

  gl_FragColor = vec4(col, 1.0); // CSS mix-blend-mode:screen — dark adds nothing
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[rootmenu] shader compile failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function RootMenuFlowBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false }) ||
      canvas.getContext("experimental-webgl", { alpha: true })) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[rootmenu] program link failed:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uMouseAmp = gl.getUniformLocation(program, "uMouseAmp");
    const uReduce = gl.getUniformLocation(program, "uReduce");

    let width = 0;
    let height = 0;
    let rafId = 0;
    let running = false;
    let startTime = 0;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, amp: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const renderFrame = (timeSec: number, reduce: number) => {
      gl.useProgram(program);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, timeSec);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uMouseAmp, mouse.amp);
      gl.uniform1f(uReduce, reduce);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (!running) return;
      rafId = window.requestAnimationFrame(loop);
      if (!startTime) startTime = now;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      mouse.amp *= 0.94;
      renderFrame((now - startTime) / 1000, 0);
    };

    const start = () => {
      if (running) return;
      running = true;
      startTime = 0;
      rafId = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    };
    const renderStill = () => {
      resize();
      renderFrame(4, 1);
    };

    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      stop();
      resize();
      if (reduceQuery.matches || document.hidden) renderStill();
      else start();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!reduceQuery.matches) start();
    };
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(syncMotion, 150);
    };
    const onPointer = (event: PointerEvent) => {
      mouse.tx = event.clientX / window.innerWidth;
      mouse.ty = 1 - event.clientY / window.innerHeight;
      mouse.amp = 1;
    };

    syncMotion();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", syncMotion);
    else reduceQuery.addListener?.(syncMotion);

    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      if (reduceQuery.removeEventListener) reduceQuery.removeEventListener("change", syncMotion);
      else reduceQuery.removeListener?.(syncMotion);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // do not loseContext() — StrictMode dev double-mount would get a dead context
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
