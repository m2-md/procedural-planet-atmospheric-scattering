/**
 * Physical constants. Each one has to be the EXACT same number as its
 * counterpart in `src/shaders/planet.frag.glsl` — `test/constants.test.ts`
 * reads the GLSL source with a regex and compares it to the values here.
 */

/** Planet radius, km. */
export const R_GROUND = 6371.0;

/** Outer radius of the atmosphere shell, km. */
export const R_ATMO = 6471.0;

/** Shell thickness, km. R_ATMO - R_GROUND. */
export const ATMO_THICKNESS = 100.0;

/** Scale height of air molecules, km. */
export const H_RAYLEIGH = 8.0;

/** Scale height of aerosols, km. */
export const H_MIE = 1.2;

/** Rayleigh scattering coefficients for 680 / 550 / 440 nm, km^-1. */
export const BETA_RAYLEIGH: readonly [number, number, number] = [
  5.802e-3, 13.558e-3, 33.1e-3,
];

/** Mie scattering coefficient, km^-1. Color blind. */
export const BETA_MIE_SCATTER = 21.0e-3;

/** Mie extinction coefficient, km^-1. Absorbs more than it scatters. */
export const BETA_MIE_EXTINCT = 23.333e-3;

/** Angular radius of the sun disk, radians (0.266 degrees). */
export const SUN_ANGULAR_RADIUS = 0.00465;

/** Sun irradiance — not a physical unit, a dial tuned along with exposure. */
export const SUN_INTENSITY_DEFAULT = 22;

export const PI = Math.PI;
