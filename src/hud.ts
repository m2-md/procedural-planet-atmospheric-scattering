import type { MeasureReport } from "./measure";
import type { RendererStats } from "./renderer";

export interface HudConfig {
  mieG: number;
  exposure: number;
}

export interface Hud {
  update(stats: RendererStats): void;
  setConfig(config: HudConfig): void;
  setTimerSource(source: "gpu" | "raf"): void;
  setNote(text: string): void;
  showMeasureReport(report: MeasureReport): void;
}

/** ÖLÇÜM: her karede donanımdan/saatten okunan değerler. */
const MEASURED = [
  ["fps", "FPS"],
  ["frame", "kare ms"],
  ["gpu", "GPU ms"],
  ["mean", "ort. örnek/piksel"],
  ["coverage", "kaplama %"],
] as const;

/** YAPISAL: kullanıcının seçtiği, ölçülmeyen ayarlar. */
const STRUCTURAL = [
  ["budget", "N × M"],
  ["altitude", "irtifa"],
  ["sun", "güneş yüksekliği"],
  ["mieg", "Mie g"],
  ["exposure", "pozlama"],
  ["size", "arka tampon"],
] as const;

function group(title: string, kind: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "hud-group";
  const head = document.createElement("div");
  head.className = "hud-group-title";
  head.textContent = title;
  const tag = document.createElement("span");
  tag.className = "hud-tag";
  tag.textContent = kind;
  head.appendChild(tag);
  box.appendChild(head);
  return box;
}

function row(parent: HTMLElement, label: string): HTMLElement {
  const line = document.createElement("div");
  line.className = "hud-row";
  const name = document.createElement("span");
  name.className = "hud-label";
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "hud-value";
  value.textContent = "—";
  line.append(name, value);
  parent.appendChild(line);
  return value;
}

export function createHud(root: HTMLElement): Hud {
  root.textContent = "";
  const cells = new Map<string, HTMLElement>();

  const measured = group("Ölçüm", "ÖLÇÜM");
  for (const [key, label] of MEASURED) cells.set(key, row(measured, label));

  const structural = group("Yapılandırma", "YAPISAL");
  for (const [key, label] of STRUCTURAL) cells.set(key, row(structural, label));

  const note = document.createElement("div");
  note.className = "hud-note";
  note.textContent = "GPU saati: yokluyor…";

  root.append(measured, structural, note);

  let timerSource: "gpu" | "raf" = "raf";

  const set = (key: string, text: string) => {
    const cell = cells.get(key);
    if (cell) cell.textContent = text;
  };

  return {
    update(stats) {
      set("fps", stats.fps.toFixed(0));
      set("frame", `${stats.frameMs.toFixed(2)} ms`);
      if (timerSource === "gpu") {
        set("gpu", stats.gpuMs === null ? "…" : `${stats.gpuMs.toFixed(3)} ms`);
      } else {
        set("gpu", `${stats.frameMs.toFixed(2)} ms (rAF)`);
      }
      set("mean", stats.meanSamples.toFixed(1));
      set("coverage", `${stats.coveragePct.toFixed(1)} %`);
      set("budget", `${stats.viewSamples} × ${stats.lightSamples}`);
      set("altitude", `${stats.altitudeKm.toFixed(0)} km`);
      set("sun", `${stats.sunElevDeg.toFixed(1)}°`);
      set("size", `${stats.width}×${stats.height}`);
    },
    setConfig(config) {
      set("mieg", config.mieG.toFixed(2));
      set("exposure", config.exposure.toFixed(1));
    },
    setTimerSource(source) {
      timerSource = source;
      note.textContent =
        source === "gpu"
          ? "GPU saati: EXT_disjoint_timer_query_webgl2"
          : "GPU saati: uzantı yok → rAF delta medyanı";
    },
    setNote(text) {
      note.textContent = text;
    },
    showMeasureReport(report) {
      const unit = report.timerExt ? "GPU ms" : "kare ms";
      const pick = (i: number) =>
        report.timerExt
          ? report.budgets[i].gpuMsMedian
          : report.budgets[i].wallMsMedian;
      set("fps", "—");
      set("frame", `${report.budgets[1].wallMsMedian.toFixed(2)} ms`);
      set("gpu", `${pick(0).toFixed(3)} → ${pick(2).toFixed(3)} ${unit}`);
      set(
        "mean",
        `${report.budgets[0].meanSamples.toFixed(1)} / ${report.budgets[2].meanSamples.toFixed(1)}`,
      );
      set("coverage", `${report.budgets[1].coveragePct.toFixed(1)} %`);
      set("budget", "8×4 → 32×16");
      set("altitude", `${report.poses.space.altitudeKm} km`);
      set("sun", `${report.poses.space.sunElevDeg}°`);
      set("size", `${report.width}×${report.height}`);
      note.textContent = `ÖLÇÜM bitti · ${report.gpu} · ${report.frames} kare · 32×16 / 8×4 = ${report.ratio32x16over8x4.toFixed(3)}× · ${report.timerExt ? "GPU sorgusu" : "rAF deltası"}`;
    },
  };
}
