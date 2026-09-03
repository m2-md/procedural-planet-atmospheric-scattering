import { describe, expect, it } from "vitest";
import { R_GROUND } from "../src/constants";
import {
  groundHitFromHeightF32,
  groundHitNaiveF32,
  toF32,
} from "../src/geometry";

describe("float32 twins", () => {
  it("both forms agree toward the zenith (the error only blows up at the horizon)", () => {
    // Zenith: disc = b^2 - c is large, the square root derivative is mild.
    const h = 2;
    const ro = toF32([0, R_GROUND + h, 0]);
    const rd = toF32([0, -1, 0]); // straight down
    const naive = groundHitNaiveF32(ro, rd, R_GROUND);
    const stable = groundHitFromHeightF32(ro, rd, R_GROUND, h);
    expect(naive).toBeCloseTo(stable, 3);
    expect(stable).toBeCloseTo(h, 3);
  });

  it("both forms return infinity in a direction that misses", () => {
    const h = 2;
    const ro = toF32([0, R_GROUND + h, 0]);
    const rd = toF32([0, 1, 0]); // looking at the zenith: the hit is behind
    // t is negative because the hit is behind; the miss test needs another direction.
    expect(Number.isFinite(groundHitNaiveF32(ro, rd, R_GROUND))).toBe(true);
    const away = toF32([0.9999999, 0.0004, 0]);
    expect(groundHitNaiveF32(ro, away, R_GROUND)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(groundHitFromHeightF32(ro, away, R_GROUND, h)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("toF32 rounds every component to float32", () => {
    const v = toF32([0.1, 1 / 3, 6371.123456789]);
    for (const x of v) expect(Math.fround(x)).toBe(x);
  });
});
