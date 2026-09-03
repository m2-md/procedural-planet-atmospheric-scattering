import { describe, expect, it } from "vitest";
import { horizonSweep } from "../src/precision";

describe("ufuk hassasiyeti", () => {
  it("irtifadan kurulan biçim sade biçimden daha az sapar", () => {
    // 2 km irtifada, ufkun ±0.3 derece çevresinde 400 yön tara.
    const sweep = horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 });
    expect(sweep.stableMaxErrKm).toBeLessThan(sweep.naiveMaxErrKm);
    expect(sweep.stableMaxErrKm).toBeLessThan(0.05); // 50 metre
  });
});

describe("ufuk taraması — irtifa boyunca", () => {
  it("taramada gerçekten zemine çarpan yönler var", () => {
    const sweep = horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 });
    expect(sweep.used).toBeGreaterThan(100);
  });

  it("kararlı biçim 2-200 km arasında hiçbir irtifada daha kötü değil", () => {
    for (const altitudeKm of [2, 5, 10, 25, 50, 100, 150, 200]) {
      const sweep = horizonSweep({ altitudeKm, spanDeg: 0.3, samples: 400 });
      expect(sweep.ratio).toBeGreaterThanOrEqual(1);
      expect(sweep.stableMaxErrKm).toBeLessThan(0.05);
    }
  });
});
