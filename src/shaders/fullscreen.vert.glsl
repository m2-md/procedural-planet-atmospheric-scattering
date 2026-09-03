#version 300 es

// NO vertex buffer. We generate three corners from gl_VertexID:
// 0 -> (-1,-1)   1 -> (3,-1)   2 -> (-1,3)
// This triangle fully covers the NDC square; the hardware clips the overhang.
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
