import { describe, expect, it } from "vitest";
import { encodeCount16, sampleStats } from "../src/samples";

/** Shader'ın yaptığını taklit et: sayacı iki bayta yaz, RGBA piksel kur. */
function pixelsFromCounts(counts: number[]): Uint8Array {
  const out = new Uint8Array(counts.length * 4);
  counts.forEach((n, i) => {
    const [hi, lo] = encodeCount16(n);
    out[i * 4] = hi;
    out[i * 4 + 1] = lo;
    out[i * 4 + 2] = 0;
    out[i * 4 + 3] = 255;
  });
  return out;
}

describe("encodeCount16", () => {
  it("kodla-çöz turu değeri aynen geri getirir", () => {
    for (const n of [0, 1, 255, 256, 544, 2112, 65535]) {
      const [hi, lo] = encodeCount16(n);
      expect(hi * 256 + lo).toBe(n);
      expect(hi).toBeLessThanOrEqual(255);
      expect(lo).toBeLessThanOrEqual(255);
    }
  });
});

describe("sampleStats", () => {
  it("boş tamponda her şey sıfır", () => {
    const stats = sampleStats(new Uint8Array(0));
    expect(stats).toEqual({ pixels: 0, mean: 0, max: 0, coveragePct: 0 });
  });

  it("elle kurulmuş dört pikselde ortalama ve maksimum doğru", () => {
    const stats = sampleStats(pixelsFromCounts([0, 40, 144, 544]));
    expect(stats.pixels).toBe(4);
    expect(stats.mean).toBeCloseTo((0 + 40 + 144 + 544) / 4, 9);
    expect(stats.max).toBe(544);
  });

  it("kaplama yalnızca sıfırdan büyük değerleri sayar", () => {
    const stats = sampleStats(pixelsFromCounts([0, 0, 0, 12]));
    expect(stats.coveragePct).toBeCloseTo(25, 9);
  });

  it("255'i aşan değerler iki bayttan doğru çözülür", () => {
    const stats = sampleStats(pixelsFromCounts([2112]));
    expect(stats.max).toBe(2112);
  });

  it("B ve A kanallarındaki çöp sonucu değiştirmez", () => {
    const clean = pixelsFromCounts([100, 300]);
    const dirty = pixelsFromCounts([100, 300]);
    dirty[2] = 199;
    dirty[3] = 7;
    dirty[6] = 42;
    dirty[7] = 0;
    expect(sampleStats(dirty)).toEqual(sampleStats(clean));
  });
});
