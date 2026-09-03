import { R_GROUND } from "./constants";
import { cross, normalize } from "./geometry";

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly position: Vec3; // gezegen merkezine göre, km
  readonly altitude: number; // km — konumdan GERİ HESAPLANMAZ, taşınır
  readonly right: Vec3;
  readonly up: Vec3;
  readonly forward: Vec3;
}

// latitude/longitude bir yüzey noktası verir; irtifa o noktanın üstüne çıkar.
// pitch = 0 ufka bakar, pozitif değer burnu yukarı kaldırır.
export function poseAtAltitude(
  altitudeKm: number,
  latRad: number,
  lonRad: number,
  pitchRad: number,
): CameraPose {
  const cosLat = Math.cos(latRad);
  const up: Vec3 = [
    cosLat * Math.cos(lonRad),
    Math.sin(latRad),
    cosLat * Math.sin(lonRad),
  ];
  const r = R_GROUND + altitudeKm;
  const position: Vec3 = [up[0] * r, up[1] * r, up[2] * r];

  // Kuzeyi referans alıp yüzeye teğet bir doğu vektörü kur.
  const north: Vec3 = [0, 1, 0];
  const east = normalize(cross(north, up));
  const tangent = cross(up, east); // ufka bakan yön

  const cp = Math.cos(pitchRad);
  const sp = Math.sin(pitchRad);
  const forward = normalize([
    tangent[0] * cp + up[0] * sp,
    tangent[1] * cp + up[1] * sp,
    tangent[2] * cp + up[2] * sp,
  ]);
  const right = normalize(cross(forward, up));
  const camUp = cross(right, forward);

  return { position, altitude: altitudeKm, right, up: camUp, forward };
}

/**
 * GLSL `mat3` sütun-öncelikli: ilk üç eleman `right`, sonraki üç `up`,
 * son üç `forward`. `uniformMatrix3fv(loc, false, ...)` ile gönderilir.
 */
export function basisMatrix(pose: CameraPose): Float32Array {
  return new Float32Array([
    pose.right[0],
    pose.right[1],
    pose.right[2],
    pose.up[0],
    pose.up[1],
    pose.up[2],
    pose.forward[0],
    pose.forward[1],
    pose.forward[2],
  ]);
}

/** Ufkun yerel yataydan ne kadar aşağıda kaldığı: acos(R / (R + h)). */
export function horizonDipRad(altitudeKm: number): number {
  return Math.acos(R_GROUND / (R_GROUND + altitudeKm));
}

/** Yerel çerçeve: yukarı (yüzey normali), doğu, kuzeye teğet yön. */
export interface LocalFrame {
  readonly up: Vec3;
  readonly east: Vec3;
  readonly tangent: Vec3;
}

export function localFrame(position: Vec3): LocalFrame {
  const up = normalize(position);
  const east = normalize(cross([0, 1, 0], up));
  const tangent = cross(up, east);
  return { up, east, tangent };
}

/**
 * Güneş azimutu kameranın baktığı yönden (yerel teğet) doğuya doğru sapma.
 * 0 seçilirse güneş tam kadraj ortasına, dolayısıyla gökyüzü ölçüm bloğunun
 * içine düşerdi; 18° hem diski kadrajda tutuyor hem bloğun dışında bırakıyor.
 */
export const SUN_AZIMUTH_DEG = 18;

export function sunDirection(
  position: Vec3,
  elevationDeg: number,
  azimuthDeg: number = SUN_AZIMUTH_DEG,
): Vec3 {
  const { up, east, tangent } = localFrame(position);
  const e = (elevationDeg * Math.PI) / 180;
  const a = (azimuthDeg * Math.PI) / 180;
  const ce = Math.cos(e);
  const se = Math.sin(e);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return normalize([
    tangent[0] * ce * ca + east[0] * ce * sa + up[0] * se,
    tangent[1] * ce * ca + east[1] * ce * sa + up[1] * se,
    tangent[2] * ce * ca + east[2] * ce * sa + up[2] * se,
  ]);
}

export interface ProbeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const SKY_PROBE_WIDTH = 64;
export const SKY_PROBE_HEIGHT = 16;

/**
 * Ufkun `aboveHorizonDeg` kadar üstündeki gökyüzü şeridine denk gelen piksel
 * dikdörtgeni. Koordinatlar GL düzeninde (sol-alt orijin).
 *
 * Işın kurulumu shader'daki ile aynı: uv = (frag - 0.5*res) / res.y,
 * dolayısıyla dikey açı `atan(uv.y / focal)` kadar ileri yönün üstünde.
 */
export function skyProbeRect(
  pose: CameraPose,
  fovYRad: number,
  width: number,
  height: number,
  aboveHorizonDeg: number,
): ProbeRect {
  const localUp = normalize(pose.position);
  const dotFwdUp =
    pose.forward[0] * localUp[0] +
    pose.forward[1] * localUp[1] +
    pose.forward[2] * localUp[2];
  const forwardElev = Math.asin(Math.min(Math.max(dotFwdUp, -1), 1));
  const target =
    -horizonDipRad(pose.altitude) + (aboveHorizonDeg * Math.PI) / 180;

  const focal = 1 / Math.tan(0.5 * fovYRad);
  const uvY = Math.tan(target - forwardElev) * focal;

  const centerX = 0.5 * width;
  const centerY = uvY * height + 0.5 * height;

  const w = Math.min(SKY_PROBE_WIDTH, width);
  const h = Math.min(SKY_PROBE_HEIGHT, height);
  const x = Math.min(Math.max(Math.round(centerX - w / 2), 0), width - w);
  const y = Math.min(Math.max(Math.round(centerY - h / 2), 0), height - h);
  return { x, y, width: w, height: h };
}
