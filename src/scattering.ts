import type { Vec3 } from "./camera";
import { H_MIE, H_RAYLEIGH, R_GROUND } from "./constants";

export interface Density {
  readonly rayleigh: number;
  readonly mie: number;
}

/**
 * CPU twin of the GLSL `densityAt` function. The difference: there the height
 * is derived from the position, here the height is handed in directly.
 * Underground (negative altitude) clamps to 0 — the same `max(h, 0.0)` rule.
 */
export function densityAt(heightKm: number): Density {
  const h = Math.max(heightKm, 0);
  return {
    rayleigh: Math.exp(-h / H_RAYLEIGH),
    mie: Math.exp(-h / H_MIE),
  };
}

/**
 * Optical depth along the segment a → b. The same midpoint rule as the
 * shader: sample at the middle of the slice, multiply density by slice length.
 */
export function opticalDepth(a: Vec3, b: Vec3, samples: number): Density {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const total = Math.hypot(dx, dy, dz);
  if (total === 0 || samples <= 0) return { rayleigh: 0, mie: 0 };

  const segment = total / samples;
  let rayleigh = 0;
  let mie = 0;
  for (let i = 0; i < samples; i++) {
    const u = (i + 0.5) / samples;
    const px = a[0] + dx * u;
    const py = a[1] + dy * u;
    const pz = a[2] + dz * u;
    const height = Math.hypot(px, py, pz) - R_GROUND;
    const rho = densityAt(height);
    rayleigh += rho.rayleigh * segment;
    mie += rho.mie * segment;
  }
  return { rayleigh, mie };
}

/** Beer-Lambert: T = exp(-β · τ). */
export function transmittance(tau: number, beta: number): number {
  return Math.exp(-beta * tau);
}
