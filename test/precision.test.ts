import { describe, expect, it } from "vitest";
import { horizonSweep } from "../src/precision";

describe("horizon precision", () => {
  it("the form built from the altitude deviates less than the naive form", () => {
    // At 2 km altitude, sweep 400 directions ±0.3 degrees around the horizon.
    const sweep = horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 });
    expect(sweep.stableMaxErrKm).toBeLessThan(sweep.naiveMaxErrKm);
    expect(sweep.stableMaxErrKm).toBeLessThan(0.05); // 50 meters
  });
});

describe("horizon sweep — across altitudes", () => {
  it("the sweep really does contain directions that hit the ground", () => {
    const sweep = horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 });
    expect(sweep.used).toBeGreaterThan(100);
  });

  it("the stable form is never worse at any altitude between 2 and 200 km", () => {
    for (const altitudeKm of [2, 5, 10, 25, 50, 100, 150, 200]) {
      const sweep = horizonSweep({ altitudeKm, spanDeg: 0.3, samples: 400 });
      expect(sweep.ratio).toBeGreaterThanOrEqual(1);
      expect(sweep.stableMaxErrKm).toBeLessThan(0.05);
    }
  });
});
