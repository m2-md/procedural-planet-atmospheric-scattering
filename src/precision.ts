import type { Vec3 } from "./camera";
import { localFrame } from "./camera";
import { R_GROUND } from "./constants";
import {
  groundHitFromHeightF32,
  groundHitNaiveF32,
  normalize,
  raySphere,
  toF32,
} from "./geometry";

export interface HorizonSweepOptions {
  /** Camera altitude, km. */
  altitudeKm: number;
  /** Half-range swept around the horizon angle, degrees. */
  spanDeg: number;
  /** Total number of (position, direction) pairs. */
  samples: number;
}

export interface HorizonSweepResult {
  /** Largest deviation of the `dot(ro,ro) - r*r` form from the double reference, km. */
  naiveMaxErrKm: number;
  /** Largest deviation of the `h * (h + 2r)` form, km. */
  stableMaxErrKm: number;
  /** naive / stable. Dropping below 1 means the stable form is the worse one. */
  ratio: number;
  /** Number of samples that actually hit the ground and are thus comparable. */
  used: number;
}

/**
 * The catastrophic cancellation in the `c` term is a rounding error that
 * depends on the camera position. At a single position the error can land on
 * zero (the roundings of the two large squares cancel each other out), so the
 * sweep goes through POSITIONS separate camera positions spread over the
 * planet. At each position, evenly spaced directions are swept ±spanDeg around
 * the horizon angle; the total number of directions is `samples`.
 *
 * Reference: the same intersection in double precision with an unrounded
 * camera position. The two implementations compared take a position and
 * direction clamped to float32 on the way into a uniform — what the GPU does.
 */
const POSITIONS = 20;
const GOLDEN_ANGLE_DEG = 137.50776405003785;

export function horizonSweep(options: HorizonSweepOptions): HorizonSweepResult {
  const { altitudeKm, spanDeg, samples } = options;
  const perPosition = Math.max(1, Math.round(samples / POSITIONS));
  const span = (spanDeg * Math.PI) / 180;
  const r = R_GROUND + altitudeKm;
  const dip = Math.acos(R_GROUND / r);

  let naiveMax = 0;
  let stableMax = 0;
  let used = 0;

  for (let p = 0; p < POSITIONS; p++) {
    const latRad = ((((p + 0.5) / POSITIONS) * 140 - 70) * Math.PI) / 180;
    const lonRad = (((p * GOLDEN_ANGLE_DEG) % 360) * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const upDir: Vec3 = [
      cosLat * Math.cos(lonRad),
      Math.sin(latRad),
      cosLat * Math.sin(lonRad),
    ];
    const roExact: Vec3 = [upDir[0] * r, upDir[1] * r, upDir[2] * r];
    const ro32 = toF32(roExact);
    const { up, tangent } = localFrame(roExact);

    for (let i = 0; i < perPosition; i++) {
      // Sweep from below the horizon to above it; the tangent point is dead center.
      const theta = -dip - span + ((i + 0.5) / perPosition) * 2 * span;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const rdExact = normalize([
        tangent[0] * ct + up[0] * st,
        tangent[1] * ct + up[1] * st,
        tangent[2] * ct + up[2] * st,
      ]);
      const reference = raySphere(roExact, rdExact, R_GROUND);
      if (reference[0] > reference[1]) continue; // the ray missed the ground

      const rd32 = toF32(rdExact);
      const naive = groundHitNaiveF32(ro32, rd32, R_GROUND);
      const stable = groundHitFromHeightF32(ro32, rd32, R_GROUND, altitudeKm);
      if (!Number.isFinite(naive) || !Number.isFinite(stable)) continue;

      used++;
      naiveMax = Math.max(naiveMax, Math.abs(naive - reference[0]));
      stableMax = Math.max(stableMax, Math.abs(stable - reference[0]));
    }
  }

  return {
    naiveMaxErrKm: naiveMax,
    stableMaxErrKm: stableMax,
    ratio: stableMax > 0 ? naiveMax / stableMax : Number.POSITIVE_INFINITY,
    used,
  };
}
