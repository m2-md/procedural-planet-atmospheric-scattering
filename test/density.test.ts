import { describe, expect, it } from "vitest";
import { H_MIE, H_RAYLEIGH } from "../src/constants";
import { densityAt } from "../src/scattering";

describe("iki yoğunluk profili", () => {
  it("Mie ölçek yüksekliğinde aerosol yoğunluğu 1/e'ye iner", () => {
    expect(densityAt(H_MIE).mie).toBeCloseTo(Math.E ** -1, 12);
  });

  it("negatif irtifada yoğunluk 1'e sıkışır (max(h, 0) kuralı)", () => {
    expect(densityAt(-5).rayleigh).toBe(1);
    expect(densityAt(-5).mie).toBe(1);
    expect(densityAt(0).rayleigh).toBe(1);
  });

  it("aerosoller havadan daha hızlı seyrelir", () => {
    for (const h of [1, 4, 8, 20]) {
      expect(densityAt(h).mie).toBeLessThan(densityAt(h).rayleigh);
    }
    expect(H_MIE).toBeLessThan(H_RAYLEIGH);
  });

  it("10 ölçek yüksekliği sonrası yoğunluk 1e-4'ün altında", () => {
    expect(densityAt(10 * H_RAYLEIGH).rayleigh).toBeLessThan(1e-4);
  });
});
