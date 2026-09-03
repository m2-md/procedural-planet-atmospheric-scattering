import { describe, expect, it } from "vitest";
import { BETA_RAYLEIGH, H_RAYLEIGH } from "../src/constants";
import { densityAt, opticalDepth, transmittance } from "../src/scattering";

describe("yoğunluk ve optik derinlik", () => {
  it("yoğunluk irtifayla monoton azalır", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let h = 0; h <= 100; h += 2) {
      const rho = densityAt(h).rayleigh;
      expect(rho).toBeLessThan(previous);
      previous = rho;
    }
  });

  it("ölçek yüksekliğinde yoğunluk tam olarak 1/e'ye iner", () => {
    expect(densityAt(H_RAYLEIGH).rayleigh).toBeCloseTo(Math.E ** -1, 12);
  });

  it("optik derinlik yön değiştirince aynı kalır", () => {
    const a = opticalDepth([0, 6373, 0], [0, 6420, 0], 64);
    const b = opticalDepth([0, 6420, 0], [0, 6373, 0], 64);
    expect(a.rayleigh).toBeCloseTo(b.rayleigh, 9);
  });

  it("geçirgenlik (0, 1] aralığında ve tau ile monoton azalır", () => {
    let previous = 1.0000001;
    for (let tau = 0; tau <= 50; tau += 1) {
      const t = transmittance(tau, BETA_RAYLEIGH[2]);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(previous);
      previous = t;
    }
  });
});

describe("gün batımı", () => {
  it("mavi kırmızıdan daha hızlı tükenir ve fark yolla açılır", () => {
    const short = 1.0;
    const long = 12.0;
    const ratioShort =
      transmittance(short, BETA_RAYLEIGH[0]) /
      transmittance(short, BETA_RAYLEIGH[2]);
    const ratioLong =
      transmittance(long, BETA_RAYLEIGH[0]) /
      transmittance(long, BETA_RAYLEIGH[2]);
    expect(ratioShort).toBeGreaterThan(1);
    expect(ratioLong).toBeGreaterThan(ratioShort);
  });

  it("katsayılar dalga boyunun -4. kuvvetini takip eder", () => {
    const lambda = [680, 550, 440];
    for (let i = 1; i < 3; i++) {
      const expected = (lambda[0] / lambda[i]) ** 4;
      const actual = BETA_RAYLEIGH[i] / BETA_RAYLEIGH[0];
      expect(actual / expected).toBeCloseTo(1, 2); // %1 tolerans
    }
  });
});

describe("optik derinlik — ek kontroller", () => {
  it("örnek sayısı artınca optik derinlik yakınsar", () => {
    const coarse = opticalDepth([0, 6373, 0], [0, 6420, 0], 64);
    const fine = opticalDepth([0, 6373, 0], [0, 6420, 0], 256);
    expect(Math.abs(coarse.rayleigh / fine.rayleigh - 1)).toBeLessThan(0.01);
  });

  it("sıfır uzunlukta yolda optik derinlik sıfır", () => {
    const zero = opticalDepth([0, 6373, 0], [0, 6373, 0], 64);
    expect(zero.rayleigh).toBe(0);
    expect(zero.mie).toBe(0);
  });

  it("tau = 0 iken geçirgenlik tam olarak 1", () => {
    expect(transmittance(0, BETA_RAYLEIGH[0])).toBe(1);
    expect(transmittance(0, BETA_RAYLEIGH[2])).toBe(1);
  });
});
