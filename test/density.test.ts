import { describe, expect, it } from "vitest";
import { H_MIE, H_RAYLEIGH } from "../src/constants";
import { densityAt } from "../src/scattering";

describe("two density profiles", () => {
  it("at the Mie scale height the aerosol density drops to 1/e", () => {
    expect(densityAt(H_MIE).mie).toBeCloseTo(Math.E ** -1, 12);
  });

  it("at negative altitude the density clamps to 1 (the max(h, 0) rule)", () => {
    expect(densityAt(-5).rayleigh).toBe(1);
    expect(densityAt(-5).mie).toBe(1);
    expect(densityAt(0).rayleigh).toBe(1);
  });

  it("aerosols thin out faster than the air", () => {
    for (const h of [1, 4, 8, 20]) {
      expect(densityAt(h).mie).toBeLessThan(densityAt(h).rayleigh);
    }
    expect(H_MIE).toBeLessThan(H_RAYLEIGH);
  });

  it("after 10 scale heights the density is below 1e-4", () => {
    expect(densityAt(10 * H_RAYLEIGH).rayleigh).toBeLessThan(1e-4);
  });
});
