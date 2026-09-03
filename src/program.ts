export interface SceneDefines {
  viewSamples: number;
  lightSamples: number;
  terrainOctaves: number;
}

// In GLSL ES 3.00 nothing is allowed in front of the "#version" line.
export function buildFragmentSource(
  source: string,
  defines: SceneDefines,
): string {
  const lines = source.split("\n");
  if (!lines[0].trim().startsWith("#version")) {
    throw new Error("#version 300 es must be the first line of the source");
  }
  const block = [
    `#define VIEW_SAMPLES ${defines.viewSamples}`,
    `#define LIGHT_SAMPLES ${defines.lightSamples}`,
    `#define TERRAIN_OCTAVES ${defines.terrainOctaves}`,
  ];
  return [lines[0], ...block, ...lines.slice(1)].join("\n");
}

export function annotateSource(source: string): string {
  return source
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4, " ")}| ${line}`)
    .join("\n");
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "(no log)";
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed\n${log}\n${annotateSource(source)}`);
  }
  return shader;
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "(no log)";
    gl.deleteProgram(program);
    throw new Error(
      `Program did not link:\n${log}\n${annotateSource(fragmentSource)}`,
    );
  }
  return program;
}
