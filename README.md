# Procedural Planet + Atmospheric Scattering — Rayleigh and Mie in a single pass

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/procedural-planet-atmospheric-scattering/)** · [Source](https://github.com/m2-md/procedural-planet-atmospheric-scattering)
<!-- LINKS:END -->

> Single-pass atmospheric scattering shader for planetary rendering: analytic optical depth integration, Rayleigh blue sky diffusion, Mie forward haze, and aerial perspective.

The working code for the article "A Planet You Can Fly Into: Rayleigh and Mie
in a Single Pass, 8×4 vs 32×16". Raw WebGL2 (GLSL ES 3.00), TypeScript, Vite,
vitest. No `three.js`, no shader/math library, **no sky texture**.

There is a single triangle in the scene (a fullscreen quad produced with the
`gl_VertexID` bit trick). The blue of the sky, the red of the sunset, the thin
blue rim seen from space and the haze over distant ground — all of it comes out
of the scattering integral inside one fragment shader.

## What it contains

- **Pure logic layer** (`src/geometry.ts`, `src/camera.ts`, `src/phase.ts`,
  `src/scattering.ts`, `src/precision.ts`, `src/samples.ts`, `src/viewport.ts`,
  `src/stats.ts`, `src/program.ts`) — knows nothing about the browser, tested
  with `vitest`.
- **Fragment shader** (`src/shaders/planet.frag.glsl`) — analytic ray-sphere
  intersection, two exponential density profiles, Rayleigh + Henyey-Greenstein
  phase functions, planet shadow, procedural ground (value noise + fbm),
  aerial perspective, tonemap. `VIEW_SAMPLES` / `LIGHT_SAMPLES` /
  `TERRAIN_OCTAVES` are **not defined** in that file; `buildFragmentSource()`
  injects them as `#define`s right after the `#version` line.
- **Sample counter** (`src/probe.ts` + `src/samples.ts`) — how many density
  evaluations were done per pixel is written into the color channels as 16 bits
  and read back (`gl.disable(gl.DITHER)` is mandatory because of it).
- **GPU clock** (`src/timer.ts`) — `EXT_disjoint_timer_query_webgl2`, a query
  queue, a `GPU_DISJOINT_EXT` check. When the extension is missing the output
  says so plainly (`timerExt: false`) and reports frame time instead of GPU ms.
- **Deterministic measurement mode** (`src/measure.ts`) — `?measure=1`.

## Setup

```bash
npm install
```

## Test (no browser, deterministic)

```bash
npm test
```

**91 tests green** (13 files):

| File                      | What it tests                                                                        | Tests |
| ------------------------- | ------------------------------------------------------------------------------------ | ----- |
| `test/geometry.test.ts`   | ray-sphere intersection, tangent/miss/from-inside edge cases                         | 7     |
| `test/vectors.test.ts`    | `normalize`/`cross`/`dot`, is the intersection point on the surface                  | 4     |
| `test/precision.test.ts`  | horizon sweep: stable form vs naive form, 2–200 km                                   | 3     |
| `test/f32.test.ts`        | float32 twins: no difference at the zenith, infinity on a miss                       | 3     |
| `test/phase.test.ts`      | sphere integral = 1, `g = 0` → `1/4π`, symmetry, `g → 1` guard                       | 7     |
| `test/scattering.test.ts` | density monotonicity, optical depth symmetry, Beer-Lambert, sunset, `λ⁻⁴`            | 9     |
| `test/density.test.ts`    | the two scale heights, the `max(h, 0)` rule                                          | 4     |
| `test/camera.test.ts`     | pose orthonormality, altitude being carried, `basisMatrix`, horizon angle, sky block | 12    |
| `test/program.test.ts`    | does `#version` stay on the first line, define injection                             | 8     |
| `test/constants.test.ts`  | **GLSL ↔ TypeScript constant parity** (reads the GLSL source with a regex)           | 9     |
| `test/samples.test.ts`    | 16-bit counter encode/decode round trip, `sampleStats`                               | 6     |
| `test/viewport.test.ts`   | dpr/scale clamps, pixel budget                                                       | 7     |
| `test/stats.test.ts`      | median/percentile edge cases, RMS, max channel difference                            | 12    |

No test file contains a reference to `document`, `window`, `navigator`,
`WebGL2RenderingContext` or `performance`.

## Demo

```bash
npm run dev
```

Do not open it with `file://` — you get a blank screen (Vite resolves bare
module specifiers).

The canvas is **not fullscreen**: a 16:9 box 960 pixels wide. The default
budget is 16 view × 8 light samples, resolution scale 0.5, `devicePixelRatio`
clamped to 2 and the total backbuffer kept under 1,400,000 pixels. Nobody falls
into the oven on first load.

| Control          | Values                  | Default |
| ---------------- | ----------------------- | ------- |
| View samples N   | 8 / 16 / 32 / 64        | **16**  |
| Light samples M  | 2 / 4 / 8 / 16 / 32     | **8**   |
| Altitude (log)   | 2 – 30,000 km           | 400 km  |
| Sun elevation    | −10° – 60°              | 12°     |
| Mie `g`          | 0 – 0.95                | 0.76    |
| Exposure         | 0.5 – 6                 | 2.0     |
| Resolution scale | 0.35 / 0.5 / 0.75 / 1.0 | **0.5** |
| Mode             | Shaded / Sample count   | Shaded  |
| Pause/Resume     | —                       | Running |

When the tab goes to the background the loop stops on its own
(`visibilitychange`); `requestAnimationFrame` slowing down in a hidden tab does
not mean "it shut off".

The HUD is split into two groups: **MEASURED** (FPS, frame ms, GPU ms, avg.
samples/pixel, coverage %) and **STRUCTURAL** (N × M, altitude, sun elevation,
`g`, exposure, backbuffer size). What is measured and what was picked do not
get mixed in the same box.

### Things to look at

1. **400 km, sun at 12°** (default): a thin blue ring on the planet's edge,
   fading outward.
2. **Drag the sun elevation slider 40° → 0° → −5°**: at 2 km altitude the
   horizon turns orange, the sun disk is on the right of the frame; this is the
   opening claim of the article.
3. **Mie `g` 0 → 0.95**: the halo around the sun grows and thickens.
4. **Bring the altitude down from 30,000 km to 2 km**: the horizon line settles
   without shimmering. (It would boil if `uCamAltitude` were recomputed from
   the position.)
5. **20,000 km**: the procedural continent/ocean pattern and polar caps at a
   visible scale. At low altitude the ground stays entirely under the aerial
   perspective — that is how the noise scale (~1/4 of the radius) behaves.
6. **Mode = Sample count**: in space the region that misses the atmosphere is
   completely black (0 samples), and every pixel touching the atmosphere is
   **flat** green (144 = the ceiling for 16×8). That flatness is the visual
   proof of the article's claim: the loop count depends on `VIEW_SAMPLES`, not
   on the path length.

## Deterministic measurement mode

```
http://localhost:5173/?measure=1
```

At this address the demo drops interactive mode entirely:

- The backbuffer locks to **960×540** (`devicePixelRatio` and scale are ignored).
- The rAF loop is off; frames are driven one after another with `drawOnce()`,
  no animation.
- For every configuration **30 warmup frames** are thrown away, then **180
  frames** are measured.
- When it finishes, a **SINGLE LINE** `MEASURE {json}` lands in the console.
- A full run takes ~27 seconds on this machine. Keep the tab in the foreground
  throughout the run; in a hidden tab rAF slows down and the measurement drags.

Measurement URLs:

| Purpose                         | URL                                                                     |
| ------------------------------- | ----------------------------------------------------------------------- |
| Interactive demo                | `http://localhost:5173/`                                                |
| Deterministic measurement       | `http://localhost:5173/?measure=1`                                      |
| Measurement over the prod build | `npm run build && npm run preview` → `http://localhost:4173/?measure=1` |

### Fixed poses

`fovY = 50°`, `lat = 18°`, `lon = 40°`, Mie `g = 0.76`, exposure `2.0`,
`TERRAIN_OCTAVES = 4`. The pitch rule is `-dip + 2°` at every altitude
(`dip = acos(R_GROUND / (R_GROUND + h))`), so the horizon stays in frame.

| Pose     | Altitude | pitch    | Sun elevation |
| -------- | -------- | -------- | ------------- |
| `space`  | 1,000 km | −28.193° | 25°           |
| `ground` | 2 km     | +0.565°  | 8°            |

The sun azimuth is **18°** east of the direction the camera looks at. Had it
been zero, the sun disk would land dead center in the frame, that is, inside the
sky measurement block, and would ruin the R/B ratio; at 90° the disk would leave
the frame entirely.

### Run list

| Run   | Pose                             | N×M                                | Measured                                                                                                 |
| ----- | -------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A1–A4 | space                            | 8×4, 16×8, 32×16, 64×32            | GPU ms median/p95, frame ms median, `compileMs`, `firstDrawMs`, `meanSamples`, `coveragePct`, `rmsVsRef` |
| B1–B3 | space                            | 32×2, 16×4, 8×8                    | GPU ms median, RMS (against the A4 frame)                                                                |
| C0–C3 | ground                           | 64×32 (reference), 32×2, 16×4, 8×8 | GPU ms median, RMS (against C0)                                                                          |
| D1–D5 | 20000 / 1000 / 100 / 10 / 2 km   | 16×8                               | GPU ms median, `coveragePct`, `meanSamples`                                                              |
| E1–E4 | ground, sun 30° / 10° / 0° / −2° | 16×8                               | sky block mean RGB + R/B ratio                                                                           |
| F     | —                                | —                                  | `horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 })` (pure CPU)                                 |

The reference frame (64×32) is taken **first** at every pose; the RMS
comparisons are done at the same pose, on the same backbuffer, over RGBA8
buffers taken with `readFrame()`.

Sky block: `skyProbeRect(groundPose, 50°, 960, 540, 2°)` →
`{ x: 448, y: 262, width: 64, height: 16 }` (GL, bottom-left origin). Exactly 2°
above the horizon, 18° away from the sun disk.

### `MEASURE {json}` → article mapping

| Field in the article                                | JSON path                                              |
| --------------------------------------------------- | ------------------------------------------------------ |
| GPU name                                            | `gpu`                                                  |
| number of measured frames                           | `frames`                                               |
| max deviation of the stable / naive form            | `precision.stableMaxErrKm` / `precision.naiveMaxErrKm` |
| budget table (mean samples, median/p95 GPU ms, RMS) | `budgets[]` (keyed by `view`, `light`)                 |
| 32×16 / 8×4 ratio                                   | `ratio32x16over8x4`                                    |
| compile + link / first frame                        | `budgets[].compileMs` / `budgets[].firstDrawMs`        |
| equal-product table                                 | `equalProduct.space[]` / `equalProduct.ground[]`       |
| altitude table                                      | `altitude[]`                                           |
| sunset R/B table                                    | `sunset[].redBlueRatio`                                |

If `timerExt: false` comes back, the GPU ms columns are **left empty**;
`wallMsMedian` is written in their place and the column header becomes
"frame time (ms)". The `ratioSource` field says which clock the ratio came from.

`WEBGL_debug_renderer_info` is attempted for `gpu`; when the browser does not
hand it over, `"unknown"` is written.

### Raw run log

After a measurement the raw `MEASURE` lines are kept at the repository root as
`measurements-YYYY-MM-DD.jsonl` (one line per run). The cold-compile lines
(`compileMs`, `firstDrawMs`) are **a single observation per page** and are
flagged with `"cold": true` in the file. If the GPU timestamps come back
quantized (e.g. multiples of 65.5 µs) the line gets a `"quantized": true` note;
the `MEASURE` output gives the raw median, it makes no stability judgement.

## Known limits

- **No ozone.** In the real atmosphere there is a layer around 25 km that
  absorbs light without scattering it; at twilight it is largely what builds the
  deep blue at the top of the sky. Here, once the sun drops below the horizon,
  the sky falls to gray faster than it should.
- **No multiple scattering.** A single-pass model: light bends once and reaches
  the eye.
- **Evenly spaced view sampling.** Looking at the limb from space, the ray
  travels more than 2,000 km inside the shell; with 8 samples the slice length
  passes 250 km while the scale height is 8 km. That is where the RMS column
  comes out large. The right fix is importance sampling or a precomputed
  transmittance table.
- **The daytime view at low altitude saturates to white.** At 2 km altitude,
  looking near the horizon, the view ray passes through hundreds of kilometers
  of dense air; single scattering + a simple exp tonemap leaves that saturated.
  There is an exposure slider, but the source of the problem is not exposure,
  it is the model itself.

## File map

```
src/
  constants.ts    physical constants (parity test against the GLSL)
  geometry.ts     vectors, ray-sphere, float32 twins
  camera.ts       CameraPose, poseAtAltitude, basisMatrix, horizon angle, sun direction
  precision.ts    horizon sweep: stable vs naive intersection form
  phase.ts        Rayleigh + Henyey-Greenstein, sphere integral
  scattering.ts   density, optical depth, Beer-Lambert (CPU twins)
  program.ts      define injection, compile/link, line-numbered error dump
  modes.ts        MODE_SHADED / MODE_SAMPLE_COUNT
  probe.ts        240×135 RGBA8 FBO, sample counter readback
  samples.ts      16-bit counter decoding, SampleStats
  viewport.ts     dpr/scale clamps, pixel budget
  timer.ts        GpuTimer (EXT_disjoint_timer_query_webgl2)
  stats.ts        median, percentile, RMS, max channel difference
  renderer.ts     program cache, uniforms, probe, readFrame
  measure.ts      ?measure=1 run list → MEASURE {json}
  hud.ts          MEASURED / STRUCTURAL split
  main.ts         bootstrap, controls, Pause/Resume, visibilitychange
  shaders/
    fullscreen.vert.glsl   three corners from gl_VertexID
    planet.frag.glsl       the whole scattering computation
```

## Tech stack

- TypeScript, Vite, Vitest, npm.
- Raw WebGL2 (GLSL ES 3.00). No three.js, no shader/math library, no sky texture.

## License

MIT — see `LICENSE`.
