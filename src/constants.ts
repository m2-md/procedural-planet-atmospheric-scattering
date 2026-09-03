/**
 * Fiziksel sabitler. Her biri `src/shaders/planet.frag.glsl` içindeki eşiyle
 * BİREBİR aynı sayı olmak zorunda — `test/constants.test.ts` GLSL kaynağını
 * regex ile okuyup buradaki değerlerle karşılaştırıyor.
 */

/** Gezegen yarıçapı, km. */
export const R_GROUND = 6371.0;

/** Atmosfer kabuğunun dış yarıçapı, km. */
export const R_ATMO = 6471.0;

/** Kabuk kalınlığı, km. R_ATMO - R_GROUND. */
export const ATMO_THICKNESS = 100.0;

/** Hava moleküllerinin ölçek yüksekliği, km. */
export const H_RAYLEIGH = 8.0;

/** Aerosollerin ölçek yüksekliği, km. */
export const H_MIE = 1.2;

/** 680 / 550 / 440 nm için Rayleigh saçılma katsayıları, km^-1. */
export const BETA_RAYLEIGH: readonly [number, number, number] = [
  5.802e-3, 13.558e-3, 33.1e-3,
];

/** Mie saçılma katsayısı, km^-1. Renk körü. */
export const BETA_MIE_SCATTER = 21.0e-3;

/** Mie sönüm katsayısı, km^-1. Saçtığından fazlasını yutar. */
export const BETA_MIE_EXTINCT = 23.333e-3;

/** Güneş diskinin açısal yarıçapı, radyan (0,266 derece). */
export const SUN_ANGULAR_RADIUS = 0.00465;

/** Güneş ışınımı — fiziksel birim değil, pozlamayla birlikte ayarlanan kadran. */
export const SUN_INTENSITY_DEFAULT = 22;

export const PI = Math.PI;
