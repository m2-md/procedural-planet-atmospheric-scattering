import { describe, expect, it } from "vitest";
import { cross, dot, normalize, raySphere } from "../src/geometry";
import type { Vec3 } from "../src/geometry";

describe("vector helpers", () => {
  it("normalize gives unit length", () => {
    const v = normalize([3, -4, 12]);
    expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 12);
  });

  it("normalize returns zero for the zero vector (no NaN)", () => {
    const v = normalize([0, 0, 0]);
    expect(v.every(Number.isFinite)).toBe(true);
  });

  it("cross is perpendicular to both inputs", () => {
    const a: Vec3 = normalize([0.3, 0.9, -0.2]);
    const b: Vec3 = normalize([-0.7, 0.1, 0.5]);
    const c = cross(a, b);
    expect(dot(c, a)).toBeCloseTo(0, 12);
    expect(dot(c, b)).toBeCloseTo(0, 12);
  });
});

describe("intersection points really land on the surface", () => {
  it("|ro + rd*t| = radius for five random rays", () => {
    const radius = 3.25;
    // A fixed-seed, repeatable pseudo-random generator.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let k = 0; k < 5; k++) {
      const ro: Vec3 = [rand() * 20 - 10, rand() * 20 - 10, rand() * 20 - 10];
      const target: Vec3 = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
      const rd = normalize([
        target[0] - ro[0],
        target[1] - ro[1],
        target[2] - ro[2],
      ]);
      const hit = raySphere(ro, rd, radius);
      expect(hit[0]).toBeLessThanOrEqual(hit[1]);
      for (const t of hit) {
        const p: Vec3 = [
          ro[0] + rd[0] * t,
          ro[1] + rd[1] * t,
          ro[2] + rd[2] * t,
        ];
        expect(Math.hypot(p[0], p[1], p[2])).toBeCloseTo(radius, 9);
      }
    }
  });
});
