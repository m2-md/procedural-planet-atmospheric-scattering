import { describe, expect, it } from "vitest";
import {
  maxChannelDiff,
  median,
  percentile,
  rmsDifference,
} from "../src/stats";

describe("median / percentile", () => {
  it("tek eleman sayısında ortadaki değeri verir", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("çift eleman sayısında ortadaki ikisinin ortalaması", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("boş dizide NaN", () => {
    expect(percentile([], 50)).toBeNaN();
  });

  it("p = 0 minimum, p = 100 maksimum", () => {
    expect(percentile([5, 1, 9, 3], 0)).toBe(1);
    expect(percentile([5, 1, 9, 3], 100)).toBe(9);
  });

  it("p95 doğrusal interpolasyon yapar", () => {
    const values = [0, 10];
    expect(percentile(values, 95)).toBeCloseTo(9.5, 9);
  });

  it("girdi dizisi mutasyona uğramaz", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("rmsDifference", () => {
  it("aynı tamponda sıfır", () => {
    const a = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    expect(rmsDifference(a, a.slice())).toBe(0);
  });

  it("bilinen farkta elle hesaplanan değeri verir", () => {
    // Tek piksel, kanal farkları 3 / 4 / 0 → sqrt((9 + 16 + 0) / 3)
    const a = new Uint8Array([10, 20, 30, 255]);
    const b = new Uint8Array([13, 24, 30, 0]);
    expect(rmsDifference(a, b)).toBeCloseTo(Math.sqrt(25 / 3), 12);
  });

  it("alfa kanalını yok sayar", () => {
    const a = new Uint8Array([10, 20, 30, 255]);
    const b = new Uint8Array([10, 20, 30, 0]);
    expect(rmsDifference(a, b)).toBe(0);
  });

  it("boyut uyuşmazlığında fırlatır", () => {
    expect(() => rmsDifference(new Uint8Array(4), new Uint8Array(8))).toThrow(
      /boyut/,
    );
  });
});

describe("maxChannelDiff", () => {
  it("en büyük tek kanal farkını bulur", () => {
    const a = new Uint8Array([10, 20, 30, 255, 0, 0, 0, 255]);
    const b = new Uint8Array([10, 25, 30, 255, 7, 0, 0, 255]);
    expect(maxChannelDiff(a, b)).toBe(7);
  });

  it("boyut uyuşmazlığında fırlatır", () => {
    expect(() => maxChannelDiff(new Uint8Array(4), new Uint8Array(8))).toThrow(
      /boyut/,
    );
  });
});
