import { describe, expect, it } from "vitest";
import { raySphere, raySphereFromHeight } from "../src/geometry";

describe("raySphere", () => {
  it("a ray heading for the center enters one radius early", () => {
    const hit = raySphere([0, 0, -10], [0, 0, 1], 4);
    expect(hit[0]).toBeCloseTo(6, 10);
    expect(hit[1]).toBeCloseTo(14, 10);
  });

  it("a tangent ray touches at a single point", () => {
    const hit = raySphere([0, 4, -10], [0, 0, 1], 4);
    expect(hit[1] - hit[0]).toBeCloseTo(0, 6);
  });

  it("for a missing ray the entry comes back larger than the exit", () => {
    const hit = raySphere([0, 9, -10], [0, 0, 1], 4);
    expect(hit[0]).toBeGreaterThan(hit[1]);
  });

  it("the entry is negative for a point inside the sphere", () => {
    const hit = raySphere([0, 0, 0], [0, 0, 1], 4);
    expect(hit[0]).toBeLessThan(0);
    expect(hit[1]).toBeCloseTo(4, 10);
  });
});

describe("raySphereFromHeight", () => {
  it("the c term built from the altitude matches the naive form (double)", () => {
    const R = 6371;
    const h = 2;
    const ro: [number, number, number] = [0, R + h, 0];
    const rd: [number, number, number] = [0.9997, -0.0251, 0];
    const a = raySphere(ro, rd, R);
    const b = raySphereFromHeight(ro, rd, R, h);
    expect(b[0]).toBeCloseTo(a[0], 6);
  });
});

describe("raySphereFromHeight — edge cases", () => {
  it("looking at the zenith the hit stays entirely behind (both roots negative)", () => {
    const R = 6371;
    const h = 400;
    const ro: [number, number, number] = [0, R + h, 0];
    const rd: [number, number, number] = [0, 1, 0]; // zenith
    const hit = raySphereFromHeight(ro, rd, R, h);
    expect(hit[0]).toBeLessThan(0);
    expect(hit[1]).toBeLessThan(0);
    expect(hit[1]).toBeCloseTo(-h, 6); // the nearest root is h behind the surface
  });

  it("returns x > y in a direction that genuinely misses", () => {
    const R = 6371;
    const h = 400;
    const ro: [number, number, number] = [0, R + h, 0];
    // The local horizontal direction misses the ground without grazing it.
    const rd: [number, number, number] = [1, 0, 0];
    const hit = raySphereFromHeight(ro, rd, R, h);
    expect(hit[0]).toBeGreaterThan(hit[1]);
  });
});
