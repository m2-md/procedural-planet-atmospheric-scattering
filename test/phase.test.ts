import { describe, expect, it } from "vitest";
import { integrateOverSphere, phaseMie, phaseRayleigh } from "../src/phase";

describe("phase functions", () => {
  it("Rayleigh integrates to 1 over the sphere", () => {
    expect(integrateOverSphere(phaseRayleigh, 200_000)).toBeCloseTo(1, 5);
  });

  it("Henyey-Greenstein integrates to 1 over the sphere for g = 0.76", () => {
    expect(
      integrateOverSphere((mu) => phaseMie(mu, 0.76), 200_000),
    ).toBeCloseTo(1, 3);
  });

  it("g = 0 is isotropic: 1/4pi at every angle", () => {
    for (const mu of [-1, -0.4, 0, 0.4, 1]) {
      expect(phaseMie(mu, 0)).toBeCloseTo(1 / (4 * Math.PI), 12);
    }
  });

  it("g > 0 makes forward scattering larger than back scattering", () => {
    expect(phaseMie(1, 0.76)).toBeGreaterThan(phaseMie(-1, 0.76));
  });

  it("Rayleigh is symmetric in the sign of mu", () => {
    expect(phaseRayleigh(0.7)).toBeCloseTo(phaseRayleigh(-0.7), 12);
  });
});

describe("phase functions — boundary values", () => {
  it("Rayleigh is 3/(16pi) at mu = 0 and 3/(8pi) at mu = ±1", () => {
    expect(phaseRayleigh(0)).toBeCloseTo(3 / (16 * Math.PI), 12);
    expect(phaseRayleigh(1)).toBeCloseTo(3 / (8 * Math.PI), 12);
    expect(phaseRayleigh(-1)).toBeCloseTo(3 / (8 * Math.PI), 12);
  });

  it("stays finite and positive at the g = 0.999 limit (divide-by-zero guard)", () => {
    const value = phaseMie(1, 0.999);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  });
});
