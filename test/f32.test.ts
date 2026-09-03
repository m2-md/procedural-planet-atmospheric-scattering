import { describe, expect, it } from "vitest";
import { R_GROUND } from "../src/constants";
import {
  groundHitFromHeightF32,
  groundHitNaiveF32,
  toF32,
} from "../src/geometry";

describe("float32 ikizleri", () => {
  it("zenit yönünde iki biçim aynı sonucu verir (hata yalnız ufukta patlar)", () => {
    // Zenit: disc = b^2 - c büyük, karekökün türevi ılımlı.
    const h = 2;
    const ro = toF32([0, R_GROUND + h, 0]);
    const rd = toF32([0, -1, 0]); // doğrudan aşağı
    const naive = groundHitNaiveF32(ro, rd, R_GROUND);
    const stable = groundHitFromHeightF32(ro, rd, R_GROUND, h);
    expect(naive).toBeCloseTo(stable, 3);
    expect(stable).toBeCloseTo(h, 3);
  });

  it("ıskalayan yönde iki biçim de sonsuz döner", () => {
    const h = 2;
    const ro = toF32([0, R_GROUND + h, 0]);
    const rd = toF32([0, 1, 0]); // zenite bakıyor: kesişim geride
    // Kesişim geride kaldığı için t negatif; ıskalama testi ayrı bir yön ister.
    expect(Number.isFinite(groundHitNaiveF32(ro, rd, R_GROUND))).toBe(true);
    const away = toF32([0.9999999, 0.0004, 0]);
    expect(groundHitNaiveF32(ro, away, R_GROUND)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(groundHitFromHeightF32(ro, away, R_GROUND, h)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("toF32 her bileşeni float32'ye kırpar", () => {
    const v = toF32([0.1, 1 / 3, 6371.123456789]);
    for (const x of v) expect(Math.fround(x)).toBe(x);
  });
});
