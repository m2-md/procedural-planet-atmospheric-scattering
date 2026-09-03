export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(Math.max(p, 0), 100) / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

// Per-channel RMS difference between two RGBA8 buffers (on the 0-255 scale).
export function rmsDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error("buffer sizes are not equal");
  const pixels = Math.floor(a.length / 4);
  let sum = 0;
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      const d = a[i * 4 + c] - b[i * 4 + c];
      sum += d * d;
    }
  }
  return Math.sqrt(sum / (pixels * 3));
}

/** Largest single-channel difference between two buffers. Alpha is ignored. */
export function maxChannelDiff(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error("buffer sizes are not equal");
  const pixels = Math.floor(a.length / 4);
  let max = 0;
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i * 4 + c] - b[i * 4 + c]);
      if (d > max) max = d;
    }
  }
  return max;
}
