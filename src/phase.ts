export function phaseRayleigh(mu: number): number {
  return (3 / (16 * Math.PI)) * (1 + mu * mu);
}

export function phaseMie(mu: number, g: number): number {
  const gg = g * g;
  const denom = 1 + gg - 2 * g * mu;
  return (1 - gg) / (4 * Math.PI * denom * Math.sqrt(Math.max(denom, 1e-4)));
}

// Küre üzerindeki integral: ∫ p(mu) dΩ = 2π ∫ p(mu) dmu, mu ∈ [-1, 1].
// Orta-nokta kuralı, tek yönlü simetri olduğu için azimut analitik.
export function integrateOverSphere(
  phase: (mu: number) => number,
  samples: number,
): number {
  const step = 2 / samples;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    sum += phase(-1 + (i + 0.5) * step) * step;
  }
  return 2 * Math.PI * sum;
}
