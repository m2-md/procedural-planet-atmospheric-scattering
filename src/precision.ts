import type { Vec3 } from "./camera";
import { localFrame } from "./camera";
import { R_GROUND } from "./constants";
import {
  groundHitFromHeightF32,
  groundHitNaiveF32,
  normalize,
  raySphere,
  toF32,
} from "./geometry";

export interface HorizonSweepOptions {
  /** Kamera irtifası, km. */
  altitudeKm: number;
  /** Ufuk açısının çevresinde taranan yarım aralık, derece. */
  spanDeg: number;
  /** Toplam (konum, yön) çifti sayısı. */
  samples: number;
}

export interface HorizonSweepResult {
  /** `dot(ro,ro) - r*r` biçiminin double referansından en büyük sapması, km. */
  naiveMaxErrKm: number;
  /** `h * (h + 2r)` biçiminin en büyük sapması, km. */
  stableMaxErrKm: number;
  /** naive / stable. 1'in altına inerse kararlı biçim daha kötü demektir. */
  ratio: number;
  /** Gerçekten zemine çarpan, dolayısıyla karşılaştırılabilen örnek sayısı. */
  used: number;
}

/**
 * `c` terimindeki katastrofik iptal, kamera konumuna bağlı bir yuvarlama
 * hatası. Tek bir konumda hata sıfıra denk gelebilir (iki büyük karenin
 * yuvarlamaları birbirini götürür), o yüzden tarama gezegen üzerine dağılmış
 * POSITIONS ayrı kamera konumundan geçiyor. Her konumda ufuk açısının
 * ±spanDeg çevresinde eşit aralıklı yönler taranıyor; toplam yön sayısı
 * `samples`.
 *
 * Referans: aynı kesişimin double duyarlıkla, yuvarlanmamış kamera konumuyla
 * hesaplanmış hâli. Kıyaslanan iki uygulama ise uniform'a giderken float32'ye
 * kırpılmış konum ve yön alıyor — GPU'da olan tam olarak bu.
 */
const POSITIONS = 20;
const GOLDEN_ANGLE_DEG = 137.50776405003785;

export function horizonSweep(options: HorizonSweepOptions): HorizonSweepResult {
  const { altitudeKm, spanDeg, samples } = options;
  const perPosition = Math.max(1, Math.round(samples / POSITIONS));
  const span = (spanDeg * Math.PI) / 180;
  const r = R_GROUND + altitudeKm;
  const dip = Math.acos(R_GROUND / r);

  let naiveMax = 0;
  let stableMax = 0;
  let used = 0;

  for (let p = 0; p < POSITIONS; p++) {
    const latRad = ((((p + 0.5) / POSITIONS) * 140 - 70) * Math.PI) / 180;
    const lonRad = (((p * GOLDEN_ANGLE_DEG) % 360) * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const upDir: Vec3 = [
      cosLat * Math.cos(lonRad),
      Math.sin(latRad),
      cosLat * Math.sin(lonRad),
    ];
    const roExact: Vec3 = [upDir[0] * r, upDir[1] * r, upDir[2] * r];
    const ro32 = toF32(roExact);
    const { up, tangent } = localFrame(roExact);

    for (let i = 0; i < perPosition; i++) {
      // Ufkun altından üstüne doğru tara; teğet nokta tam ortada.
      const theta = -dip - span + ((i + 0.5) / perPosition) * 2 * span;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const rdExact = normalize([
        tangent[0] * ct + up[0] * st,
        tangent[1] * ct + up[1] * st,
        tangent[2] * ct + up[2] * st,
      ]);
      const reference = raySphere(roExact, rdExact, R_GROUND);
      if (reference[0] > reference[1]) continue; // ışın zemini ıskaladı

      const rd32 = toF32(rdExact);
      const naive = groundHitNaiveF32(ro32, rd32, R_GROUND);
      const stable = groundHitFromHeightF32(ro32, rd32, R_GROUND, altitudeKm);
      if (!Number.isFinite(naive) || !Number.isFinite(stable)) continue;

      used++;
      naiveMax = Math.max(naiveMax, Math.abs(naive - reference[0]));
      stableMax = Math.max(stableMax, Math.abs(stable - reference[0]));
    }
  }

  return {
    naiveMaxErrKm: naiveMax,
    stableMaxErrKm: stableMax,
    ratio: stableMax > 0 ? naiveMax / stableMax : Number.POSITIVE_INFINITY,
    used,
  };
}
