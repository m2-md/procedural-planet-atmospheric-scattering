import { describe, expect, it } from "vitest";
import { raySphere, raySphereFromHeight } from "../src/geometry";

describe("raySphere", () => {
  it("merkeze doğru gelen ışın yarıçap kadar önce girer", () => {
    const hit = raySphere([0, 0, -10], [0, 0, 1], 4);
    expect(hit[0]).toBeCloseTo(6, 10);
    expect(hit[1]).toBeCloseTo(14, 10);
  });

  it("teğet ışın tek noktada değer", () => {
    const hit = raySphere([0, 4, -10], [0, 0, 1], 4);
    expect(hit[1] - hit[0]).toBeCloseTo(0, 6);
  });

  it("ıskalayan ışında giriş çıkıştan büyük döner", () => {
    const hit = raySphere([0, 9, -10], [0, 0, 1], 4);
    expect(hit[0]).toBeGreaterThan(hit[1]);
  });

  it("kürenin içindeki nokta için giriş negatiftir", () => {
    const hit = raySphere([0, 0, 0], [0, 0, 1], 4);
    expect(hit[0]).toBeLessThan(0);
    expect(hit[1]).toBeCloseTo(4, 10);
  });
});

describe("raySphereFromHeight", () => {
  it("irtifadan kurulan c terimi sade biçimle aynı sonucu verir (double)", () => {
    const R = 6371;
    const h = 2;
    const ro: [number, number, number] = [0, R + h, 0];
    const rd: [number, number, number] = [0.9997, -0.0251, 0];
    const a = raySphere(ro, rd, R);
    const b = raySphereFromHeight(ro, rd, R, h);
    expect(b[0]).toBeCloseTo(a[0], 6);
  });
});

describe("raySphereFromHeight — kenar durumları", () => {
  it("zenite bakarken kesişim tamamen geride kalır (iki kök de negatif)", () => {
    const R = 6371;
    const h = 400;
    const ro: [number, number, number] = [0, R + h, 0];
    const rd: [number, number, number] = [0, 1, 0]; // zenit
    const hit = raySphereFromHeight(ro, rd, R, h);
    expect(hit[0]).toBeLessThan(0);
    expect(hit[1]).toBeLessThan(0);
    expect(hit[1]).toBeCloseTo(-h, 6); // en yakın kök yüzeyin h kadar gerisi
  });

  it("gerçekten ıskalayan yönde x > y döner", () => {
    const R = 6371;
    const h = 400;
    const ro: [number, number, number] = [0, R + h, 0];
    // Yerel yatay yön zemini teğet geçmeden ıskalar.
    const rd: [number, number, number] = [1, 0, 0];
    const hit = raySphereFromHeight(ro, rd, R, h);
    expect(hit[0]).toBeGreaterThan(hit[1]);
  });
});
