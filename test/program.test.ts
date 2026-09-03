import { describe, expect, it } from "vitest";
import fragmentSource from "../src/shaders/planet.frag.glsl?raw";
import { annotateSource, buildFragmentSource } from "../src/program";

const DEFINES = { viewSamples: 8, lightSamples: 4, terrainOctaves: 4 };

describe("buildFragmentSource", () => {
  it("#version satırı çıktının ilk satırı olarak kalır", () => {
    const out = buildFragmentSource(fragmentSource, DEFINES).split("\n");
    expect(out[0].trim()).toBe("#version 300 es");
  });

  it("2-4. satırlar üç define bloğu", () => {
    const out = buildFragmentSource(fragmentSource, DEFINES).split("\n");
    expect(out[1]).toBe("#define VIEW_SAMPLES 8");
    expect(out[2]).toBe("#define LIGHT_SAMPLES 4");
    expect(out[3]).toBe("#define TERRAIN_OCTAVES 4");
  });

  it("define'lar tam sayı olarak yazılır (8.0 DEĞİL)", () => {
    const out = buildFragmentSource(fragmentSource, {
      viewSamples: 32,
      lightSamples: 16,
      terrainOctaves: 4,
    });
    expect(out).toContain("#define VIEW_SAMPLES 32\n");
    expect(out).not.toContain("VIEW_SAMPLES 32.0");
  });

  it("#version ilk satırda değilse fırlatır", () => {
    expect(() =>
      buildFragmentSource("// yorum\n#version 300 es\n", DEFINES),
    ).toThrow(/#version/);
  });

  it("kaynak dosyada define'lar TANIMLI DEĞİL (çift tanım yok)", () => {
    expect(fragmentSource).not.toContain("#define VIEW_SAMPLES");
    expect(fragmentSource).not.toContain("#define LIGHT_SAMPLES");
    expect(fragmentSource).not.toContain("#define TERRAIN_OCTAVES");
  });

  it("kaynak define'ları gerçekten kullanıyor", () => {
    expect(fragmentSource).toContain("i < VIEW_SAMPLES");
    expect(fragmentSource).toContain("i < LIGHT_SAMPLES");
    expect(fragmentSource).toContain("i < TERRAIN_OCTAVES");
  });

  it("enjeksiyon satır sayısını tam olarak 3 artırır", () => {
    const before = fragmentSource.split("\n").length;
    const after = buildFragmentSource(fragmentSource, DEFINES).split(
      "\n",
    ).length;
    expect(after - before).toBe(3);
  });
});

describe("annotateSource", () => {
  it("numaralandırma 1'den başlar", () => {
    const out = annotateSource("bir\niki").split("\n");
    expect(out[0]).toBe("   1| bir");
    expect(out[1]).toBe("   2| iki");
  });
});
