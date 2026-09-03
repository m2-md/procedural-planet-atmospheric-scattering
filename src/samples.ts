export interface SampleStats {
  readonly pixels: number;
  readonly mean: number; // atmosfere değen piksellerin ortalaması değil, TÜM piksellerin
  readonly max: number;
  readonly coveragePct: number; // en az bir örnek alan piksellerin yüzdesi
}

export function sampleStats(pixels: Uint8Array): SampleStats {
  const count = Math.floor(pixels.length / 4);
  if (count === 0) return { pixels: 0, mean: 0, max: 0, coveragePct: 0 };

  let sum = 0;
  let max = 0;
  let covered = 0;

  for (let i = 0; i < count; i++) {
    const value = pixels[i * 4] * 256 + pixels[i * 4 + 1];
    sum += value;
    if (value > max) max = value;
    if (value > 0) covered++;
  }

  return {
    pixels: count,
    mean: sum / count,
    max,
    coveragePct: (covered / count) * 100,
  };
}

/**
 * Shader'daki iki baytlık kodlamanın CPU aynası:
 *   hi = n / 256, lo = n - hi * 256
 * Kanallar 0-255 bayt olarak geri geliyor, `sampleStats` bunu çözüyor.
 */
export function encodeCount16(n: number): [number, number] {
  const clamped = Math.min(Math.max(Math.trunc(n), 0), 65535);
  const hi = Math.floor(clamped / 256);
  return [hi, clamped - hi * 256];
}
