import type { Vec3 } from "./camera";

export type { Vec3 };

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/**
 * Ray-sphere intersection, the same math as `raySphere` in the GLSL.
 * Returns `[1, -1]` when there is no intersection (entry > exit).
 */
export function raySphere(
  ro: Vec3,
  rd: Vec3,
  radius: number,
): [number, number] {
  const b = dot(ro, rd);
  const c = dot(ro, ro) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return [1, -1];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

/**
 * The same intersection, except the `c` term is built straight from the
 * altitude instead of the difference of two large numbers: |ro|^2 - r^2 = h * (h + 2r).
 */
export function raySphereFromHeight(
  ro: Vec3,
  rd: Vec3,
  radius: number,
  height: number,
): [number, number] {
  const b = dot(ro, rd);
  const c = height * (height + 2 * radius);
  const disc = b * b - c;
  if (disc < 0) return [1, -1];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

const f = Math.fround; // clamp every intermediate result to float32

export function groundHitNaiveF32(ro: Vec3, rd: Vec3, radius: number): number {
  const b = f(f(f(ro[0] * rd[0]) + f(ro[1] * rd[1])) + f(ro[2] * rd[2]));
  const dotRo = f(f(f(ro[0] * ro[0]) + f(ro[1] * ro[1])) + f(ro[2] * ro[2]));
  const c = f(dotRo - f(radius * radius));
  const disc = f(f(b * b) - c);
  if (disc < 0) return Number.POSITIVE_INFINITY;
  return f(f(-b) - f(Math.sqrt(disc)));
}

export function groundHitFromHeightF32(
  ro: Vec3,
  rd: Vec3,
  radius: number,
  height: number,
): number {
  const b = f(f(f(ro[0] * rd[0]) + f(ro[1] * rd[1])) + f(ro[2] * rd[2]));
  const c = f(height * f(height + f(2 * radius)));
  const disc = f(f(b * b) - c);
  if (disc < 0) return Number.POSITIVE_INFINITY;
  return f(f(-b) - f(Math.sqrt(disc)));
}

/** Runs a vector through the float32 rounding it meets on its way to a uniform. */
export function toF32(v: Vec3): Vec3 {
  return [f(v[0]), f(v[1]), f(v[2])];
}
