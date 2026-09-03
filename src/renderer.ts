import vertexSource from "./shaders/fullscreen.vert.glsl?raw";
import fragmentSource from "./shaders/planet.frag.glsl?raw";

import type { CameraPose, Vec3 } from "./camera";
import {
  basisMatrix,
  horizonDipRad,
  poseAtAltitude,
  sunDirection,
} from "./camera";
import { SUN_INTENSITY_DEFAULT } from "./constants";
import { MODE_SAMPLE_COUNT, MODE_SHADED } from "./modes";
import { buildFragmentSource, linkProgram } from "./program";
import { PROBE_HEIGHT, PROBE_WIDTH, createProbe } from "./probe";
import type { Probe } from "./probe";
import { sampleStats } from "./samples";
import type { SampleStats } from "./samples";
import { GpuTimer } from "./timer";
import { backingSize } from "./viewport";

export const FOV_Y_DEG = 50;
export const DEFAULT_VIEW_SAMPLES = 16;
export const DEFAULT_LIGHT_SAMPLES = 8;
export const TERRAIN_OCTAVES = 4;
export const DEFAULT_SCALE = 0.5;
export const DEFAULT_MIE_G = 0.76;
export const DEFAULT_EXPOSURE = 2.0;
export const DEFAULT_ALTITUDE_KM = 400;
export const DEFAULT_SUN_ELEV_DEG = 12;
export const CAM_LAT_DEG = 18;
export const CAM_LON_DEG = 40;
/** Margin added so the horizon stays in frame whatever the altitude is. */
export const PITCH_ABOVE_HORIZON_DEG = 2;

export interface RendererStats {
  fps: number;
  frameMs: number;
  gpuMs: number | null;
  width: number;
  height: number;
  viewSamples: number;
  lightSamples: number;
  altitudeKm: number;
  sunElevDeg: number;
  meanSamples: number;
  coveragePct: number;
}

export interface CompileRecord {
  compileMs: number;
  firstDrawMs: number;
}

export interface Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly timer: GpuTimer;
  resize(): void;
  render(timeSeconds: number): void;
  drawOnce(timed: boolean): Promise<void>;
  useBudget(view: number, light: number): void;
  lastCompile(view: number, light: number): CompileRecord | null;
  setPose(pose: CameraPose): void;
  setSunElevation(deg: number): void;
  setMieG(g: number): void;
  setExposure(e: number): void;
  setMode(mode: number): void;
  setScale(scale: number): void;
  setFixedSize(w: number, h: number): void;
  readFrame(): Uint8Array;
  sampleCounts(): SampleStats;
  stats(): RendererStats;
  dispose(): void;
}

/** Standard pose from an altitude: the horizon stays a bit below frame center. */
export function poseForAltitude(altitudeKm: number): CameraPose {
  const pitch =
    -horizonDipRad(altitudeKm) + (PITCH_ABOVE_HORIZON_DEG * Math.PI) / 180;
  return poseAtAltitude(
    altitudeKm,
    (CAM_LAT_DEG * Math.PI) / 180,
    (CAM_LON_DEG * Math.PI) / 180,
    pitch,
  );
}

interface ProgramBundle {
  program: WebGLProgram;
  viewSamples: number;
  lightSamples: number;
  compileMs: number;
  firstDrawMs: number | null;
  uResolution: WebGLUniformLocation | null;
  uCamPos: WebGLUniformLocation | null;
  uCamAltitude: WebGLUniformLocation | null;
  uCamBasis: WebGLUniformLocation | null;
  uFocal: WebGLUniformLocation | null;
  uSunDir: WebGLUniformLocation | null;
  uSunIntensity: WebGLUniformLocation | null;
  uMieG: WebGLUniformLocation | null;
  uExposure: WebGLUniformLocation | null;
  uMode: WebGLUniformLocation | null;
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function budgetKey(view: number, light: number): string {
  return `${view}x${light}`;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const context = canvas.getContext("webgl2", {
    antialias: false,
    depth: false,
    stencil: false,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!context) throw new Error("no WebGL2");
  const gl: WebGL2RenderingContext = context;

  const bundles = new Map<string, ProgramBundle>();

  function buildBundle(view: number, light: number): ProgramBundle {
    const frag = buildFragmentSource(fragmentSource, {
      viewSamples: view,
      lightSamples: light,
      terrainOctaves: TERRAIN_OCTAVES,
    });
    // compileMs: compile + link + the LINK_STATUS query. The driver may defer
    // the work, which is why the first frame is measured separately.
    const t0 = performance.now();
    const program = linkProgram(gl, vertexSource, frag);
    const compileMs = performance.now() - t0;
    const loc = (name: string) => gl.getUniformLocation(program, name);
    return {
      program,
      viewSamples: view,
      lightSamples: light,
      compileMs,
      firstDrawMs: null,
      uResolution: loc("uResolution"),
      uCamPos: loc("uCamPos"),
      uCamAltitude: loc("uCamAltitude"),
      uCamBasis: loc("uCamBasis"),
      uFocal: loc("uFocal"),
      uSunDir: loc("uSunDir"),
      uSunIntensity: loc("uSunIntensity"),
      uMieG: loc("uMieG"),
      uExposure: loc("uExposure"),
      uMode: loc("uMode"),
    };
  }

  function bundleFor(view: number, light: number): ProgramBundle {
    const key = budgetKey(view, light);
    let bundle = bundles.get(key);
    if (!bundle) {
      bundle = buildBundle(view, light);
      bundles.set(key, bundle);
    }
    return bundle;
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao); // no attributes, just so "some VAO is bound"

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
  // The 16-bit counter encoding breaks with dithering on: the driver reserves
  // the right to nudge a byte, and that turns into errors of 256.
  gl.disable(gl.DITHER);

  const timer = new GpuTimer(gl);
  const probe: Probe = createProbe(gl, PROBE_WIDTH, PROBE_HEIGHT);
  /** One-pixel buffer used to synchronize the first-frame measurement. */
  const syncPixel = new Uint8Array(4);

  let viewSamples = DEFAULT_VIEW_SAMPLES;
  let lightSamples = DEFAULT_LIGHT_SAMPLES;
  let mode = MODE_SHADED;
  let mieG = DEFAULT_MIE_G;
  let exposure = DEFAULT_EXPOSURE;
  let scale = DEFAULT_SCALE;
  let fixedSize: { width: number; height: number } | null = null;

  let pose: CameraPose = poseForAltitude(DEFAULT_ALTITUDE_KM);
  let sunElevDeg = DEFAULT_SUN_ELEV_DEG;
  let sunDir: Vec3 = sunDirection(pose.position, sunElevDeg);

  let lastStats: SampleStats = {
    pixels: 0,
    mean: 0,
    max: 0,
    coveragePct: 0,
  };
  let fps = 0;
  let frameMs = 0;
  let lastFrameStamp = 0;
  let lastProbeStamp = 0;

  // Build the first bundle right away so a shader error blows up at startup.
  bundleFor(viewSamples, lightSamples);

  function applyUniforms(
    bundle: ProgramBundle,
    width: number,
    height: number,
    modeOverride: number,
  ): void {
    gl.useProgram(bundle.program);
    gl.uniform2f(bundle.uResolution, width, height);
    gl.uniform3f(
      bundle.uCamPos,
      pose.position[0],
      pose.position[1],
      pose.position[2],
    );
    // The altitude comes from the POSE; it is not recomputed as length(position) - R_GROUND.
    gl.uniform1f(bundle.uCamAltitude, pose.altitude);
    gl.uniformMatrix3fv(bundle.uCamBasis, false, basisMatrix(pose));
    gl.uniform1f(
      bundle.uFocal,
      1 / Math.tan((0.5 * FOV_Y_DEG * Math.PI) / 180),
    );
    gl.uniform3f(bundle.uSunDir, sunDir[0], sunDir[1], sunDir[2]);
    gl.uniform1f(bundle.uSunIntensity, SUN_INTENSITY_DEFAULT);
    gl.uniform1f(bundle.uMieG, mieG);
    gl.uniform1f(bundle.uExposure, exposure);
    gl.uniform1i(bundle.uMode, modeOverride);
  }

  function drawMain(): void {
    const bundle = bundleFor(viewSamples, lightSamples);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    applyUniforms(bundle, canvas.width, canvas.height, mode);
    gl.bindVertexArray(vao);
    if (bundle.firstDrawMs === null) {
      // Cold compile is a single observation per page: the first frame drawn
      // with this program. gl.finish() is not enough to synchronize (the driver
      // can return with work still queued); a one-pixel readPixels forces a wait.
      const t0 = performance.now();
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncPixel);
      bundle.firstDrawMs = performance.now() - t0;
      return;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize(): void {
    let width: number;
    let height: number;
    if (fixedSize) {
      width = fixedSize.width;
      height = fixedSize.height;
    } else {
      const cssW = canvas.clientWidth || 960;
      const cssH = canvas.clientHeight || 540;
      const size = backingSize(cssW, cssH, window.devicePixelRatio || 1, scale);
      width = size.width;
      height = size.height;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function sampleCounts(): SampleStats {
    const bundle = bundleFor(viewSamples, lightSamples);
    probe.bind();
    applyUniforms(bundle, probe.width, probe.height, MODE_SAMPLE_COUNT);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    lastStats = sampleStats(probe.read());
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    return lastStats;
  }

  function readFrame(): Uint8Array {
    // preserveDrawingBuffer is off: draw and read have to be in the SAME task.
    resize();
    drawMain();
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(
      0,
      0,
      canvas.width,
      canvas.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    return pixels;
  }

  function render(): void {
    resize();

    const now = performance.now();
    if (lastFrameStamp > 0) {
      const dt = now - lastFrameStamp;
      frameMs = frameMs === 0 ? dt : frameMs * 0.9 + dt * 0.1;
      fps = frameMs > 0 ? 1000 / frameMs : 0;
    }
    lastFrameStamp = now;

    timer.poll();
    timer.begin();
    drawMain();
    timer.end();

    if (now - lastProbeStamp > 500) {
      lastProbeStamp = now;
      sampleCounts();
    }
    if (timer.samplesMs.length > 240) {
      timer.samplesMs.splice(0, timer.samplesMs.length - 240);
    }
  }

  async function drawOnce(timed: boolean): Promise<void> {
    timer.poll();
    if (timed) timer.begin();
    drawMain();
    if (timed) timer.end();
    await nextFrame();
    timer.poll();
  }

  function stats(): RendererStats {
    const recent = timer.samplesMs.slice(-30);
    const gpuMs =
      recent.length > 0
        ? recent.reduce((a, b) => a + b, 0) / recent.length
        : null;
    return {
      fps,
      frameMs,
      gpuMs,
      width: canvas.width,
      height: canvas.height,
      viewSamples,
      lightSamples,
      altitudeKm: pose.altitude,
      sunElevDeg,
      meanSamples: lastStats.mean,
      coveragePct: lastStats.coveragePct,
    };
  }

  return {
    gl,
    timer,
    resize,
    render,
    drawOnce,
    useBudget(view, light) {
      viewSamples = view;
      lightSamples = light;
      bundleFor(view, light);
    },
    lastCompile(view, light) {
      const bundle = bundles.get(budgetKey(view, light));
      if (!bundle) return null;
      return {
        compileMs: bundle.compileMs,
        firstDrawMs: bundle.firstDrawMs ?? 0,
      };
    },
    setPose(next) {
      pose = next;
      sunDir = sunDirection(pose.position, sunElevDeg);
    },
    setSunElevation(deg) {
      sunElevDeg = deg;
      sunDir = sunDirection(pose.position, sunElevDeg);
    },
    setMieG(g) {
      mieG = g;
    },
    setExposure(e) {
      exposure = e;
    },
    setMode(next) {
      mode = next;
    },
    setScale(next) {
      scale = next;
    },
    setFixedSize(w, h) {
      fixedSize = { width: w, height: h };
      resize();
    },
    readFrame,
    sampleCounts,
    stats,
    dispose() {
      timer.dispose();
      probe.dispose();
      for (const bundle of bundles.values()) gl.deleteProgram(bundle.program);
      bundles.clear();
      gl.deleteVertexArray(vao);
    },
  };
}
