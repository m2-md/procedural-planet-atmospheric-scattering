import { describe, expect, it } from "vitest";
import { MAX_PIXELS, backingSize, fitPixelBudget } from "../src/viewport";

describe("backingSize", () => {
  it("dpr cannot go above 2", () => {
    const a = backingSize(960, 540, 3, 1);
    const b = backingSize(960, 540, 2, 1);
    expect(a).toEqual(b);
  });

  it("scale is clamped between 0.25 and 1", () => {
    expect(backingSize(960, 540, 1, 0.1)).toEqual(
      backingSize(960, 540, 1, 0.25),
    );
    expect(backingSize(960, 540, 1, 2)).toEqual(backingSize(960, 540, 1, 1));
  });

  it("the result is never zero", () => {
    const size = backingSize(1, 1, 1, 0.25);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it("the pixel budget is never exceeded", () => {
    const size = backingSize(3840, 2160, 3, 1);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_PIXELS);
  });
});

describe("fitPixelBudget", () => {
  it("returns the input unchanged below the budget", () => {
    expect(fitPixelBudget(960, 540)).toEqual({ width: 960, height: 540 });
  });

  it("keeps the aspect ratio within 1% above the budget", () => {
    const size = fitPixelBudget(4000, 2250, 1_000_000);
    expect(size.width * size.height).toBeLessThanOrEqual(1_000_000);
    expect(size.width / size.height).toBeCloseTo(4000 / 2250, 1);
  });

  it("the custom budget parameter is honored", () => {
    const size = fitPixelBudget(1000, 1000, 10_000);
    expect(size.width * size.height).toBeLessThanOrEqual(10_000);
  });
});
