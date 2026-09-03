import type { Vec3 } from "./camera";
import { H_MIE, H_RAYLEIGH, R_GROUND } from "./constants";

export interface Density {
  readonly rayleigh: number;
  readonly mie: number;
}

/**
 * GLSL `densityAt` fonksiyonunun CPU ikizi. Fark: orada konumdan yükseklik
 * çıkarılıyor, burada yükseklik doğrudan veriliyor.
 * Yer altı (negatif irtifa) 0'a kırpılır — `max(h, 0.0)` ile aynı kural.
 */
export function densityAt(heightKm: number): Density {
  const h = Math.max(heightKm, 0);
  return {
    rayleigh: Math.exp(-h / H_RAYLEIGH),
    mie: Math.exp(-h / H_MIE),
  };
}

/**
 * a → b doğru parçası boyunca optik derinlik. Shader ile aynı orta-nokta
 * kuralı: dilim ortasında örnekle, yoğunluğu dilim boyuyla çarp.
 */
export function opticalDepth(a: Vec3, b: Vec3, samples: number): Density {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const total = Math.hypot(dx, dy, dz);
  if (total === 0 || samples <= 0) return { rayleigh: 0, mie: 0 };

  const segment = total / samples;
  let rayleigh = 0;
  let mie = 0;
  for (let i = 0; i < samples; i++) {
    const u = (i + 0.5) / samples;
    const px = a[0] + dx * u;
    const py = a[1] + dy * u;
    const pz = a[2] + dz * u;
    const height = Math.hypot(px, py, pz) - R_GROUND;
    const rho = densityAt(height);
    rayleigh += rho.rayleigh * segment;
    mie += rho.mie * segment;
  }
  return { rayleigh, mie };
}

/** Beer-Lambert: T = exp(-β · τ). */
export function transmittance(tau: number, beta: number): number {
  return Math.exp(-beta * tau);
}
