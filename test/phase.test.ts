import { describe, expect, it } from "vitest";
import { integrateOverSphere, phaseMie, phaseRayleigh } from "../src/phase";

describe("faz fonksiyonları", () => {
  it("Rayleigh küre üzerinde 1'e integre olur", () => {
    expect(integrateOverSphere(phaseRayleigh, 200_000)).toBeCloseTo(1, 5);
  });

  it("Henyey-Greenstein g = 0.76 için küre üzerinde 1'e integre olur", () => {
    expect(
      integrateOverSphere((mu) => phaseMie(mu, 0.76), 200_000),
    ).toBeCloseTo(1, 3);
  });

  it("g = 0 izotropiktir: her açıda 1/4pi", () => {
    for (const mu of [-1, -0.4, 0, 0.4, 1]) {
      expect(phaseMie(mu, 0)).toBeCloseTo(1 / (4 * Math.PI), 12);
    }
  });

  it("g > 0 ileri saçılmayı geri saçılmadan büyük yapar", () => {
    expect(phaseMie(1, 0.76)).toBeGreaterThan(phaseMie(-1, 0.76));
  });

  it("Rayleigh mu işaretine göre simetriktir", () => {
    expect(phaseRayleigh(0.7)).toBeCloseTo(phaseRayleigh(-0.7), 12);
  });
});

describe("faz fonksiyonları — sınır değerleri", () => {
  it("Rayleigh mu = 0'da 3/(16pi), mu = ±1'de 3/(8pi)", () => {
    expect(phaseRayleigh(0)).toBeCloseTo(3 / (16 * Math.PI), 12);
    expect(phaseRayleigh(1)).toBeCloseTo(3 / (8 * Math.PI), 12);
    expect(phaseRayleigh(-1)).toBeCloseTo(3 / (8 * Math.PI), 12);
  });

  it("g = 0.999 sınırında sonlu ve pozitif kalır (sıfıra bölme koruması)", () => {
    const value = phaseMie(1, 0.999);
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  });
});
