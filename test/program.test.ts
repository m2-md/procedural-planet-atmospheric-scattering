import { describe, expect, it } from "vitest";
import fragmentSource from "../src/shaders/planet.frag.glsl?raw";
import { annotateSource, buildFragmentSource } from "../src/program";

const DEFINES = { viewSamples: 8, lightSamples: 4, terrainOctaves: 4 };

describe("buildFragmentSource", () => {
  it("the #version line stays as the first line of the output", () => {
    const out = buildFragmentSource(fragmentSource, DEFINES).split("\n");
    expect(out[0].trim()).toBe("#version 300 es");
  });

  it("lines 2-4 are the three define block", () => {
    const out = buildFragmentSource(fragmentSource, DEFINES).split("\n");
    expect(out[1]).toBe("#define VIEW_SAMPLES 8");
    expect(out[2]).toBe("#define LIGHT_SAMPLES 4");
    expect(out[3]).toBe("#define TERRAIN_OCTAVES 4");
  });

  it("the defines are written as integers (NOT 8.0)", () => {
    const out = buildFragmentSource(fragmentSource, {
      viewSamples: 32,
      lightSamples: 16,
      terrainOctaves: 4,
    });
    expect(out).toContain("#define VIEW_SAMPLES 32\n");
    expect(out).not.toContain("VIEW_SAMPLES 32.0");
  });

  it("throws when #version is not the first line", () => {
    expect(() =>
      buildFragmentSource("// comment\n#version 300 es\n", DEFINES),
    ).toThrow(/#version/);
  });

  it("the defines are NOT DEFINED in the source file (no double definition)", () => {
    expect(fragmentSource).not.toContain("#define VIEW_SAMPLES");
    expect(fragmentSource).not.toContain("#define LIGHT_SAMPLES");
    expect(fragmentSource).not.toContain("#define TERRAIN_OCTAVES");
  });

  it("the source really does use the defines", () => {
    expect(fragmentSource).toContain("i < VIEW_SAMPLES");
    expect(fragmentSource).toContain("i < LIGHT_SAMPLES");
    expect(fragmentSource).toContain("i < TERRAIN_OCTAVES");
  });

  it("the injection grows the line count by exactly 3", () => {
    const before = fragmentSource.split("\n").length;
    const after = buildFragmentSource(fragmentSource, DEFINES).split(
      "\n",
    ).length;
    expect(after - before).toBe(3);
  });
});

describe("annotateSource", () => {
  it("numbering starts at 1", () => {
    const out = annotateSource("one\ntwo").split("\n");
    expect(out[0]).toBe("   1| one");
    expect(out[1]).toBe("   2| two");
  });
});
