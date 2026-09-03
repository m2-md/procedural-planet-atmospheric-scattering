import { describe, expect, it } from "vitest";
import fragmentSource from "../src/shaders/planet.frag.glsl?raw";
import {
  ATMO_THICKNESS,
  BETA_MIE_EXTINCT,
  BETA_MIE_SCATTER,
  BETA_RAYLEIGH,
  H_MIE,
  H_RAYLEIGH,
  R_ATMO,
  R_GROUND,
  SUN_ANGULAR_RADIUS,
} from "../src/constants";
import { MODE_SAMPLE_COUNT, MODE_SHADED } from "../src/modes";

function glslFloat(name: string): number {
  const match = fragmentSource.match(
    new RegExp(`const\\s+float\\s+${name}\\s*=\\s*([^;]+);`),
  );
  if (!match) throw new Error(`GLSL constant not found: ${name}`);
  return Number(match[1].trim());
}

function glslInt(name: string): number {
  const match = fragmentSource.match(
    new RegExp(`const\\s+int\\s+${name}\\s*=\\s*([^;]+);`),
  );
  if (!match) throw new Error(`GLSL constant not found: ${name}`);
  return Number(match[1].trim());
}

function glslVec3(name: string): [number, number, number] {
  const match = fragmentSource.match(
    new RegExp(`const\\s+vec3\\s+${name}\\s*=\\s*vec3\\(([^)]+)\\);`),
  );
  if (!match) throw new Error(`GLSL constant not found: ${name}`);
  const parts = match[1].split(",").map((p) => Number(p.trim()));
  return [parts[0], parts[1], parts[2]];
}

describe("GLSL ↔ TypeScript constant parity", () => {
  it("radii and scale heights are exactly the same", () => {
    expect(glslFloat("R_GROUND")).toBe(R_GROUND);
    expect(glslFloat("R_ATMO")).toBe(R_ATMO);
    expect(glslFloat("ATMO_THICKNESS")).toBe(ATMO_THICKNESS);
    expect(glslFloat("H_RAYLEIGH")).toBe(H_RAYLEIGH);
    expect(glslFloat("H_MIE")).toBe(H_MIE);
  });

  it("scattering coefficients are exactly the same", () => {
    expect(glslVec3("BETA_RAYLEIGH")).toEqual([...BETA_RAYLEIGH]);
    expect(glslFloat("BETA_MIE_SCATTER")).toBe(BETA_MIE_SCATTER);
    expect(glslFloat("BETA_MIE_EXTINCT")).toBe(BETA_MIE_EXTINCT);
  });

  it("the angular radius of the sun disk is exactly the same", () => {
    expect(glslFloat("SUN_ANGULAR_RADIUS")).toBe(SUN_ANGULAR_RADIUS);
  });

  it("mode constants are exactly the same", () => {
    expect(glslInt("MODE_SHADED")).toBe(MODE_SHADED);
    expect(glslInt("MODE_SAMPLE_COUNT")).toBe(MODE_SAMPLE_COUNT);
  });
});

describe("internal consistency of the constants", () => {
  it("shell thickness is the difference of the two radii", () => {
    expect(R_ATMO - R_GROUND).toBeCloseTo(ATMO_THICKNESS, 9);
  });

  it("Mie extinction is larger than Mie scattering", () => {
    expect(BETA_MIE_EXTINCT).toBeGreaterThan(BETA_MIE_SCATTER);
  });

  it("Rayleigh coefficients rise in order from red to blue", () => {
    expect(BETA_RAYLEIGH[0]).toBeLessThan(BETA_RAYLEIGH[1]);
    expect(BETA_RAYLEIGH[1]).toBeLessThan(BETA_RAYLEIGH[2]);
  });

  it("the blue/red ratio matches the 5.705 in the comment", () => {
    expect(BETA_RAYLEIGH[2] / BETA_RAYLEIGH[0]).toBeCloseTo(5.705, 3);
  });

  it("scale height: aerosols stay lower down than the air", () => {
    expect(H_MIE).toBeLessThan(H_RAYLEIGH);
  });
});
