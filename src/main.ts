import { createHud } from "./hud";
import { runMeasurement } from "./measure";
import { MODE_SAMPLE_COUNT, MODE_SHADED } from "./modes";
import type { Renderer } from "./renderer";
import {
  DEFAULT_ALTITUDE_KM,
  DEFAULT_EXPOSURE,
  DEFAULT_LIGHT_SAMPLES,
  DEFAULT_MIE_G,
  DEFAULT_SCALE,
  DEFAULT_SUN_ELEV_DEG,
  DEFAULT_VIEW_SAMPLES,
  createRenderer,
  poseForAltitude,
} from "./renderer";

function need<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`no DOM node: ${selector}`);
  return el;
}

const canvas = need<HTMLCanvasElement>("#stage");
const hudRoot = need<HTMLElement>("#hud");
const banner = need<HTMLElement>("#banner");
const toggleButton = need<HTMLButtonElement>("#toggle");
const viewSelect = need<HTMLSelectElement>("#view");
const lightSelect = need<HTMLSelectElement>("#light");
const altitudeInput = need<HTMLInputElement>("#altitude");
const sunInput = need<HTMLInputElement>("#sun");
const mieInput = need<HTMLInputElement>("#mieg");
const exposureInput = need<HTMLInputElement>("#exposure");
const scaleSelect = need<HTMLSelectElement>("#scale");
const modeSelect = need<HTMLSelectElement>("#mode");
const altitudeOut = need<HTMLElement>("#altitude-out");
const sunOut = need<HTMLElement>("#sun-out");
const mieOut = need<HTMLElement>("#mieg-out");
const exposureOut = need<HTMLElement>("#exposure-out");

let renderer: Renderer;
try {
  renderer = createRenderer(canvas);
} catch (error) {
  canvas.remove();
  banner.hidden = false;
  banner.textContent = `This browser has no WebGL2, the demo cannot run. (${String(error)})`;
  throw error;
}

const hud = createHud(hudRoot);
hud.setTimerSource(renderer.timer.available ? "gpu" : "raf");
hud.setConfig({ mieG: DEFAULT_MIE_G, exposure: DEFAULT_EXPOSURE });

canvas.addEventListener(
  "webglcontextlost",
  (event) => {
    event.preventDefault();
    setRunning(false);
    banner.hidden = false;
    banner.textContent = "The WebGL context was lost. Reload the page.";
    console.warn("webglcontextlost");
  },
  false,
);

let running = true;
let frameId = 0;

function loop(now: number) {
  frameId = requestAnimationFrame(loop);
  renderer.render(now * 0.001);
  hud.update(renderer.stats());
}

function setRunning(next: boolean): void {
  if (next === running) return;
  running = next;
  toggleButton.textContent = running ? "Pause" : "Resume";
  if (running) {
    frameId = requestAnimationFrame(loop);
  } else {
    hud.setNote("Loop paused — the counters are frozen.");
    cancelAnimationFrame(frameId);
  }
}

toggleButton.addEventListener("click", () => setRunning(!running));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setRunning(false);
});

/** The slider is linear over 0-1000; the altitude is log over 2-30,000 km. */
const ALT_MIN = 2;
const ALT_MAX = 30000;

function sliderToAltitude(value: number): number {
  const t = value / 1000;
  return ALT_MIN * (ALT_MAX / ALT_MIN) ** t;
}

function altitudeToSlider(altitudeKm: number): number {
  const t = Math.log(altitudeKm / ALT_MIN) / Math.log(ALT_MAX / ALT_MIN);
  return Math.round(t * 1000);
}

function applyAltitude(altitudeKm: number): void {
  renderer.setPose(poseForAltitude(altitudeKm));
  renderer.setSunElevation(Number(sunInput.value));
  altitudeOut.textContent =
    altitudeKm >= 1000
      ? `${(altitudeKm / 1000).toFixed(1)}k km`
      : `${altitudeKm.toFixed(altitudeKm < 10 ? 1 : 0)} km`;
}

function wireControls(): void {
  viewSelect.value = String(DEFAULT_VIEW_SAMPLES);
  lightSelect.value = String(DEFAULT_LIGHT_SAMPLES);
  altitudeInput.value = String(altitudeToSlider(DEFAULT_ALTITUDE_KM));
  sunInput.value = String(DEFAULT_SUN_ELEV_DEG);
  mieInput.value = String(DEFAULT_MIE_G);
  exposureInput.value = String(DEFAULT_EXPOSURE);
  scaleSelect.value = String(DEFAULT_SCALE);
  modeSelect.value = String(MODE_SHADED);
  sunOut.textContent = `${DEFAULT_SUN_ELEV_DEG.toFixed(0)}°`;
  mieOut.textContent = DEFAULT_MIE_G.toFixed(2);
  exposureOut.textContent = DEFAULT_EXPOSURE.toFixed(1);
  applyAltitude(DEFAULT_ALTITUDE_KM);

  const applyBudget = () => {
    hud.setNote("Compiling program…");
    renderer.useBudget(Number(viewSelect.value), Number(lightSelect.value));
    hud.setTimerSource(renderer.timer.available ? "gpu" : "raf");
  };

  viewSelect.addEventListener("change", applyBudget);
  lightSelect.addEventListener("change", applyBudget);

  altitudeInput.addEventListener("input", () => {
    applyAltitude(sliderToAltitude(Number(altitudeInput.value)));
  });
  sunInput.addEventListener("input", () => {
    const deg = Number(sunInput.value);
    renderer.setSunElevation(deg);
    sunOut.textContent = `${deg.toFixed(0)}°`;
  });
  mieInput.addEventListener("input", () => {
    const g = Number(mieInput.value);
    renderer.setMieG(g);
    mieOut.textContent = g.toFixed(2);
    hud.setConfig({ mieG: g, exposure: Number(exposureInput.value) });
  });
  exposureInput.addEventListener("input", () => {
    const e = Number(exposureInput.value);
    renderer.setExposure(e);
    exposureOut.textContent = e.toFixed(1);
    hud.setConfig({ mieG: Number(mieInput.value), exposure: e });
  });
  scaleSelect.addEventListener("change", () => {
    renderer.setScale(Number(scaleSelect.value));
    renderer.resize();
  });
  modeSelect.addEventListener("change", () => {
    renderer.setMode(
      Number(modeSelect.value) === MODE_SAMPLE_COUNT
        ? MODE_SAMPLE_COUNT
        : MODE_SHADED,
    );
  });
}

const measureMode = new URLSearchParams(location.search).get("measure") === "1";

if (measureMode) {
  document.body.classList.add("measuring");
  toggleButton.disabled = true;
  hud.setNote("Deterministic measurement running… (keep the tab in front)");
  running = false;
  runMeasurement(renderer).then((report) => {
    console.log(`MEASURE ${JSON.stringify(report)}`);
    hud.showMeasureReport(report);
  });
} else {
  wireControls();
  window.addEventListener("resize", () => renderer.resize());
  renderer.resize();
  frameId = requestAnimationFrame(loop);
}
