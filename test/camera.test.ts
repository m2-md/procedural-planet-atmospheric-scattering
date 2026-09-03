import { describe, expect, it } from "vitest";
import {
  basisMatrix,
  horizonDipRad,
  poseAtAltitude,
  skyProbeRect,
  sunDirection,
} from "../src/camera";
import type { Vec3 } from "../src/camera";
import { R_GROUND } from "../src/constants";
import { dot } from "../src/geometry";

const DEG = Math.PI / 180;

function poses() {
  return [
    poseAtAltitude(2, 18 * DEG, 40 * DEG, 0),
    poseAtAltitude(10, -32 * DEG, 190 * DEG, 5 * DEG),
    poseAtAltitude(100, 61 * DEG, -75 * DEG, -3 * DEG),
    poseAtAltitude(400, 0, 0, 12 * DEG),
    poseAtAltitude(1000, 18 * DEG, 40 * DEG, -28 * DEG),
    poseAtAltitude(20000, -5 * DEG, 120 * DEG, -70 * DEG),
  ];
}

describe("poseAtAltitude", () => {
  it("konumun uzunluğu R + irtifa", () => {
    for (const pose of poses()) {
      const r = Math.hypot(
        pose.position[0],
        pose.position[1],
        pose.position[2],
      );
      expect(r).toBeCloseTo(R_GROUND + pose.altitude, 9);
    }
  });

  it("irtifa girdiyle BİREBİR eşit kalır (konumdan geri hesaplanmaz)", () => {
    for (const altitude of [2, 10.5, 100, 400, 30000]) {
      const pose = poseAtAltitude(altitude, 18 * DEG, 40 * DEG, 0);
      expect(pose.altitude).toBe(altitude);
    }
  });

  it("right/up/forward birim ve karşılıklı dik", () => {
    for (const pose of poses()) {
      for (const v of [pose.right, pose.up, pose.forward]) {
        expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 9);
      }
      expect(dot(pose.right, pose.up)).toBeCloseTo(0, 9);
      expect(dot(pose.right, pose.forward)).toBeCloseTo(0, 9);
      expect(dot(pose.up, pose.forward)).toBeCloseTo(0, 9);
    }
  });

  it("pitch = 0 iken ileri yön yerel yataya oturur", () => {
    const pose = poseAtAltitude(400, 18 * DEG, 40 * DEG, 0);
    const localUp: Vec3 = [
      pose.position[0] / (R_GROUND + 400),
      pose.position[1] / (R_GROUND + 400),
      pose.position[2] / (R_GROUND + 400),
    ];
    expect(dot(pose.forward, localUp)).toBeCloseTo(0, 9);
  });
});

describe("basisMatrix", () => {
  it("sütun-öncelikli: ilk üç eleman right", () => {
    const pose = poseAtAltitude(400, 18 * DEG, 40 * DEG, 0);
    const m = basisMatrix(pose);
    expect(m.length).toBe(9);
    expect(m[0]).toBeCloseTo(pose.right[0], 6);
    expect(m[1]).toBeCloseTo(pose.right[1], 6);
    expect(m[2]).toBeCloseTo(pose.right[2], 6);
    expect(m[3]).toBeCloseTo(pose.up[0], 6);
    expect(m[6]).toBeCloseTo(pose.forward[0], 6);
  });
});

describe("horizonDipRad", () => {
  it("bilinen irtifalarda beklenen dereceleri verir", () => {
    const deg = (h: number) => (horizonDipRad(h) * 180) / Math.PI;
    expect(deg(2)).toBeCloseTo(1.43546, 4);
    expect(deg(10)).toBeCloseTo(3.20812, 4);
    expect(deg(100)).toBeCloseTo(10.08586, 4);
    expect(deg(1000)).toBeCloseTo(30.19335, 4);
    expect(deg(20000)).toBeCloseTo(76.01953, 4);
  });

  it("irtifa arttıkça monoton büyür", () => {
    let previous = -1;
    for (const h of [2, 10, 100, 1000, 20000]) {
      const dip = horizonDipRad(h);
      expect(dip).toBeGreaterThan(previous);
      previous = dip;
    }
  });
});

describe("sunDirection", () => {
  it("birim uzunlukta ve yükseklik arttıkça yerel yukarıya yaklaşır", () => {
    const pose = poseAtAltitude(2, 18 * DEG, 40 * DEG, 0);
    const localUp: Vec3 = [
      pose.position[0] / (R_GROUND + 2),
      pose.position[1] / (R_GROUND + 2),
      pose.position[2] / (R_GROUND + 2),
    ];
    let previous = -2;
    for (const elev of [-10, 0, 10, 30, 60, 89]) {
      const s = sunDirection(pose.position, elev);
      expect(Math.hypot(s[0], s[1], s[2])).toBeCloseTo(1, 9);
      const height = dot(s, localUp);
      expect(height).toBeGreaterThan(previous);
      previous = height;
    }
  });

  it("yükseklik 0 iken güneş yerel yatay düzlemde", () => {
    const pose = poseAtAltitude(2, 18 * DEG, 40 * DEG, 0);
    const localUp: Vec3 = [
      pose.position[0] / (R_GROUND + 2),
      pose.position[1] / (R_GROUND + 2),
      pose.position[2] / (R_GROUND + 2),
    ];
    expect(dot(sunDirection(pose.position, 0), localUp)).toBeCloseTo(0, 9);
  });
});

describe("skyProbeRect", () => {
  const fovY = 50 * DEG;

  it("kadraj içinde kalır", () => {
    for (const alt of [2, 10, 100, 1000, 20000]) {
      const pose = poseAtAltitude(alt, 18 * DEG, 40 * DEG, 0);
      const rect = skyProbeRect(pose, fovY, 960, 540, 2);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(960);
      expect(rect.y + rect.height).toBeLessThanOrEqual(540);
    }
  });

  it("sabit pitch'te irtifa arttıkça dikdörtgen aşağı iner", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const alt of [2, 10, 100]) {
      const pose = poseAtAltitude(alt, 18 * DEG, 40 * DEG, 0);
      const rect = skyProbeRect(pose, fovY, 960, 540, 2);
      expect(rect.y).toBeLessThan(previous);
      previous = rect.y;
    }
  });

  it("pitch = -dip + 2° pozunda blok kadrajın dikey ortasına oturur", () => {
    const alt = 2;
    const pitch = -horizonDipRad(alt) + 2 * DEG;
    const pose = poseAtAltitude(alt, 18 * DEG, 40 * DEG, pitch);
    const rect = skyProbeRect(pose, fovY, 960, 540, 2);
    expect(rect.x).toBe(448);
    expect(rect.width).toBe(64);
    expect(rect.height).toBe(16);
    expect(Math.abs(rect.y + rect.height / 2 - 270)).toBeLessThan(1);
  });
});
