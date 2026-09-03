import { describe, expect, it } from "vitest";
import {
  maxChannelDiff,
  median,
  percentile,
  rmsDifference,
} from "../src/stats";

describe("median / percentile", () => {
  it("gives the middle value for an odd element count", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the middle two for an even element count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("NaN for an empty array", () => {
    expect(percentile([], 50)).toBeNaN();
  });

  it("p = 0 is the minimum, p = 100 is the maximum", () => {
    expect(percentile([5, 1, 9, 3], 0)).toBe(1);
    expect(percentile([5, 1, 9, 3], 100)).toBe(9);
  });

  it("p95 interpolates linearly", () => {
    const values = [0, 10];
    expect(percentile(values, 95)).toBeCloseTo(9.5, 9);
  });

  it("the input array is not mutated", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("rmsDifference", () => {
  it("zero for identical buffers", () => {
    const a = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    expect(rmsDifference(a, a.slice())).toBe(0);
  });

  it("gives the hand-computed value for a known difference", () => {
    // One pixel, channel differences 3 / 4 / 0 → sqrt((9 + 16 + 0) / 3)
    const a = new Uint8Array([10, 20, 30, 255]);
    const b = new Uint8Array([13, 24, 30, 0]);
    expect(rmsDifference(a, b)).toBeCloseTo(Math.sqrt(25 / 3), 12);
  });

  it("ignores the alpha channel", () => {
    const a = new Uint8Array([10, 20, 30, 255]);
    const b = new Uint8Array([10, 20, 30, 0]);
    expect(rmsDifference(a, b)).toBe(0);
  });

  it("throws on a size mismatch", () => {
    expect(() => rmsDifference(new Uint8Array(4), new Uint8Array(8))).toThrow(
      /size/,
    );
  });
});

describe("maxChannelDiff", () => {
  it("finds the largest single-channel difference", () => {
    const a = new Uint8Array([10, 20, 30, 255, 0, 0, 0, 255]);
    const b = new Uint8Array([10, 25, 30, 255, 7, 0, 0, 255]);
    expect(maxChannelDiff(a, b)).toBe(7);
  });

  it("throws on a size mismatch", () => {
    expect(() => maxChannelDiff(new Uint8Array(4), new Uint8Array(8))).toThrow(
      /size/,
    );
  });
});
