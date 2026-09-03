import type { CameraPose } from "./camera";
import { horizonDipRad, skyProbeRect } from "./camera";
import { MODE_SHADED } from "./modes";
import { horizonSweep } from "./precision";
import { PROBE_HEIGHT, PROBE_WIDTH } from "./probe";
import type { Renderer } from "./renderer";
import {
  CAM_LAT_DEG,
  CAM_LON_DEG,
  DEFAULT_EXPOSURE,
  DEFAULT_MIE_G,
  FOV_Y_DEG,
  PITCH_ABOVE_HORIZON_DEG,
  poseForAltitude,
} from "./renderer";
import { maxChannelDiff, median, percentile, rmsDifference } from "./stats";

export const MEASURE_WIDTH = 960;
export const MEASURE_HEIGHT = 540;
export const MEASURE_FRAMES = 180;
export const MEASURE_WARMUP = 30;

export const REFERENCE_VIEW = 64;
export const REFERENCE_LIGHT = 32;

export const SPACE_ALTITUDE_KM = 1000;
export const SPACE_SUN_ELEV_DEG = 25;
export const GROUND_ALTITUDE_KM = 2;
export const GROUND_SUN_ELEV_DEG = 8;

/** Ana bütçe tablosu. */
const BUDGETS: ReadonlyArray<readonly [number, number]> = [
  [8, 4],
  [16, 8],
  [32, 16],
  [64, 32],
];

/** N·M çarpımı sabit (64), bölüşüm değişiyor. */
const EQUAL_PRODUCT: ReadonlyArray<readonly [number, number]> = [
  [32, 2],
  [16, 4],
  [8, 8],
];

const ALTITUDES_KM = [20000, 1000, 100, 10, 2];
const SUNSET_ELEVATIONS_DEG = [30, 10, 0, -2];

export interface RunResult {
  gpuMsMedian: number;
  gpuMsP95: number;
  wallMsMedian: number;
}

export interface BudgetReport extends RunResult {
  view: number;
  light: number;
  ceiling: number;
  meanSamples: number;
  coveragePct: number;
  rmsVsRef: number;
  maxDiff: number;
  compileMs: number;
  firstDrawMs: number;
}

export interface EqualProductReport {
  view: number;
  light: number;
  evals: number;
  gpuMsMedian: number;
  wallMsMedian: number;
  rmsVsRef: number;
}

export interface AltitudeReport {
  altKm: number;
  pitchDeg: number;
  sunElevDeg: number;
  coveragePct: number;
  meanSamples: number;
  gpuMsMedian: number;
  wallMsMedian: number;
}

export interface SunsetReport {
  sunElevDeg: number;
  rgb: [number, number, number];
  redBlueRatio: number;
}

export interface MeasureReport {
  gpu: string;
  timerExt: boolean;
  width: number;
  height: number;
  fovYDeg: number;
  frames: number;
  warmup: number;
  probe: { width: number; height: number };
  reference: { view: number; light: number };
  skyBlock: { x: number; y: number; width: number; height: number };
  poses: {
    space: PoseReport;
    ground: PoseReport;
  };
  budgets: BudgetReport[];
  ratio32x16over8x4: number;
  ratioSource: "gpu" | "wall";
  equalProduct: {
    space: EqualProductReport[];
    ground: EqualProductReport[];
  };
  altitude: AltitudeReport[];
  sunset: SunsetReport[];
  precision: {
    altitudeKm: number;
    spanDeg: number;
    samples: number;
    naiveMaxErrKm: number;
    stableMaxErrKm: number;
    ratio: number;
  };
}

export interface PoseReport {
  altitudeKm: number;
  latDeg: number;
  lonDeg: number;
  pitchDeg: number;
  sunElevDeg: number;
}

function round(x: number, digits: number): number {
  if (!Number.isFinite(x)) return 0;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

function pitchDegFor(altitudeKm: number): number {
  return (-horizonDipRad(altitudeKm) * 180) / Math.PI + PITCH_ABOVE_HORIZON_DEG;
}

function poseReport(altitudeKm: number, sunElevDeg: number): PoseReport {
  return {
    altitudeKm,
    latDeg: CAM_LAT_DEG,
    lonDeg: CAM_LON_DEG,
    pitchDeg: round(pitchDegFor(altitudeKm), 4),
    sunElevDeg,
  };
}

function rendererName(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  if (!ext) return "bilinmiyor";
  const name = gl.getParameter(
    (ext as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL,
  );
  return typeof name === "string" && name.length > 0 ? name : "bilinmiyor";
}

async function runConfig(
  renderer: Renderer,
  view: number,
  light: number,
): Promise<RunResult> {
  renderer.useBudget(view, light);
  for (let i = 0; i < MEASURE_WARMUP; i++) await renderer.drawOnce(false);

  const wall: number[] = [];
  renderer.timer.reset();
  for (let i = 0; i < MEASURE_FRAMES; i++) {
    const t0 = performance.now();
    await renderer.drawOnce(true);
    wall.push(performance.now() - t0);
  }

  return {
    gpuMsMedian: round(median(renderer.timer.samplesMs), 4),
    gpuMsP95: round(percentile(renderer.timer.samplesMs, 95), 4),
    wallMsMedian: round(median(wall), 4),
  };
}

/** Bir dikdörtgenin kanal ortalaması (RGBA8, GL sol-alt orijin). */
function blockMeanRgb(
  pixels: Uint8Array,
  width: number,
  rect: { x: number; y: number; width: number; height: number },
): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * width + x) * 4;
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      n++;
    }
  }
  if (n === 0) return [0, 0, 0];
  return [r / n, g / n, b / n];
}

/**
 * Deterministik ölçüm modu (`?measure=1`).
 * Arka tampon 960×540'a kilitli, kamera/güneş sabit, animasyon yok.
 * Sonuç TEK satır `MEASURE {json}` olarak dışarı verilir.
 */
export async function runMeasurement(
  renderer: Renderer,
): Promise<MeasureReport> {
  renderer.setFixedSize(MEASURE_WIDTH, MEASURE_HEIGHT);
  renderer.setMode(MODE_SHADED);
  renderer.setMieG(DEFAULT_MIE_G);
  renderer.setExposure(DEFAULT_EXPOSURE);

  const spacePose: CameraPose = poseForAltitude(SPACE_ALTITUDE_KM);
  const groundPose: CameraPose = poseForAltitude(GROUND_ALTITUDE_KM);
  const fovY = (FOV_Y_DEG * Math.PI) / 180;
  const skyRect = skyProbeRect(
    groundPose,
    fovY,
    MEASURE_WIDTH,
    MEASURE_HEIGHT,
    PITCH_ABOVE_HORIZON_DEG,
  );

  // --- Uzay pozu: referans kare önce çekilir (RMS tabanı) -------------------
  renderer.setPose(spacePose);
  renderer.setSunElevation(SPACE_SUN_ELEV_DEG);
  renderer.useBudget(REFERENCE_VIEW, REFERENCE_LIGHT);
  const spaceReference = renderer.readFrame();

  const budgets: BudgetReport[] = [];
  for (const [view, light] of BUDGETS) {
    renderer.useBudget(view, light);
    const run = await runConfig(renderer, view, light);
    const counts = renderer.sampleCounts();
    const frame = renderer.readFrame();
    const compile = renderer.lastCompile(view, light);
    budgets.push({
      view,
      light,
      ceiling: view + view * light,
      meanSamples: round(counts.mean, 3),
      coveragePct: round(counts.coveragePct, 3),
      gpuMsMedian: run.gpuMsMedian,
      gpuMsP95: run.gpuMsP95,
      wallMsMedian: run.wallMsMedian,
      rmsVsRef: round(rmsDifference(frame, spaceReference), 4),
      maxDiff: maxChannelDiff(frame, spaceReference),
      compileMs: round(compile?.compileMs ?? 0, 4),
      firstDrawMs: round(compile?.firstDrawMs ?? 0, 4),
    });
  }

  const equalSpace: EqualProductReport[] = [];
  for (const [view, light] of EQUAL_PRODUCT) {
    renderer.useBudget(view, light);
    const run = await runConfig(renderer, view, light);
    const frame = renderer.readFrame();
    equalSpace.push({
      view,
      light,
      evals: view + view * light,
      gpuMsMedian: run.gpuMsMedian,
      wallMsMedian: run.wallMsMedian,
      rmsVsRef: round(rmsDifference(frame, spaceReference), 4),
    });
  }

  // --- Yer pozu -------------------------------------------------------------
  renderer.setPose(groundPose);
  renderer.setSunElevation(GROUND_SUN_ELEV_DEG);
  renderer.useBudget(REFERENCE_VIEW, REFERENCE_LIGHT);
  const groundReference = renderer.readFrame();

  const equalGround: EqualProductReport[] = [];
  for (const [view, light] of EQUAL_PRODUCT) {
    renderer.useBudget(view, light);
    const run = await runConfig(renderer, view, light);
    const frame = renderer.readFrame();
    equalGround.push({
      view,
      light,
      evals: view + view * light,
      gpuMsMedian: run.gpuMsMedian,
      wallMsMedian: run.wallMsMedian,
      rmsVsRef: round(rmsDifference(frame, groundReference), 4),
    });
  }

  // --- İrtifa taraması (sabit 16×8) ----------------------------------------
  const altitude: AltitudeReport[] = [];
  for (const altKm of ALTITUDES_KM) {
    renderer.setPose(poseForAltitude(altKm));
    renderer.setSunElevation(SPACE_SUN_ELEV_DEG);
    renderer.useBudget(16, 8);
    const run = await runConfig(renderer, 16, 8);
    const counts = renderer.sampleCounts();
    altitude.push({
      altKm,
      pitchDeg: round(pitchDegFor(altKm), 4),
      sunElevDeg: SPACE_SUN_ELEV_DEG,
      coveragePct: round(counts.coveragePct, 3),
      meanSamples: round(counts.mean, 3),
      gpuMsMedian: run.gpuMsMedian,
      wallMsMedian: run.wallMsMedian,
    });
  }

  // --- Gün batımı: ufkun 2 derece üstündeki gökyüzü bloğu -------------------
  renderer.setPose(groundPose);
  renderer.useBudget(16, 8);
  const sunset: SunsetReport[] = [];
  for (const elev of SUNSET_ELEVATIONS_DEG) {
    renderer.setSunElevation(elev);
    const frame = renderer.readFrame();
    const rgb = blockMeanRgb(frame, MEASURE_WIDTH, skyRect);
    sunset.push({
      sunElevDeg: elev,
      rgb: [round(rgb[0], 2), round(rgb[1], 2), round(rgb[2], 2)],
      redBlueRatio: round(rgb[2] > 0 ? rgb[0] / rgb[2] : 0, 4),
    });
  }

  // --- Saf CPU: ufuk hassasiyeti -------------------------------------------
  const sweep = horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 });

  const timerExt = renderer.timer.available;
  const small = budgets[0];
  const large = budgets[2];
  const base = timerExt ? small.gpuMsMedian : small.wallMsMedian;
  const heavy = timerExt ? large.gpuMsMedian : large.wallMsMedian;

  return {
    gpu: rendererName(renderer.gl),
    timerExt,
    width: MEASURE_WIDTH,
    height: MEASURE_HEIGHT,
    fovYDeg: FOV_Y_DEG,
    frames: MEASURE_FRAMES,
    warmup: MEASURE_WARMUP,
    probe: { width: PROBE_WIDTH, height: PROBE_HEIGHT },
    reference: { view: REFERENCE_VIEW, light: REFERENCE_LIGHT },
    skyBlock: skyRect,
    poses: {
      space: poseReport(SPACE_ALTITUDE_KM, SPACE_SUN_ELEV_DEG),
      ground: poseReport(GROUND_ALTITUDE_KM, GROUND_SUN_ELEV_DEG),
    },
    budgets,
    ratio32x16over8x4: round(base > 0 ? heavy / base : 0, 4),
    ratioSource: timerExt ? "gpu" : "wall",
    equalProduct: { space: equalSpace, ground: equalGround },
    altitude,
    sunset,
    precision: {
      altitudeKm: 2,
      spanDeg: 0.3,
      samples: 400,
      naiveMaxErrKm: round(sweep.naiveMaxErrKm, 6),
      stableMaxErrKm: round(sweep.stableMaxErrKm, 6),
      ratio: round(sweep.ratio, 3),
    },
  };
}
