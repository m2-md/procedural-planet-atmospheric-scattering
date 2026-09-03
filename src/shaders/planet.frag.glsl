#version 300 es
// WARNING: "#version" MUST be the first line.
// VIEW_SAMPLES / LIGHT_SAMPLES / TERRAIN_OCTAVES are NOT DEFINED in this file;
// buildFragmentSource() in src/program.ts injects them right after #version.
// Do not try to compile this file on its own.
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform vec3 uCamPos; // relative to the planet center, km
uniform float uCamAltitude; // km — computed in double on the CPU and carried
uniform mat3 uCamBasis; // columns: right, up, forward
uniform float uFocal; // 1 / tan(fovY / 2)
uniform vec3 uSunDir; // unit, planet to sun
uniform float uSunIntensity;
uniform float uMieG;
uniform float uExposure;
uniform int uMode;

out vec4 outColor;

const int MODE_SHADED = 0;
const int MODE_SAMPLE_COUNT = 1;

const float R_GROUND = 6371.0; // km
const float R_ATMO = 6471.0; // km
const float ATMO_THICKNESS = 100.0; // R_ATMO - R_GROUND
const float SUN_ANGULAR_RADIUS = 0.00465; // radians (0.266 degrees)
const float SUN_DISK_GAIN = 40.0;

// Counter of density evaluations per pixel. Only read in MODE_SAMPLE_COUNT
// mode; reset at the beginning of every main() call.
int gSamples = 0;

// Ray-sphere intersection. rd is assumed to be unit length.
// x = entry distance, y = exit distance. Returns x > y when there is no hit.
vec2 raySphere(vec3 ro, vec3 rd, float radius) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1.0, -1.0); // no intersection
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

// height = |ro| - radius, computed on the CPU and carried over.
// We build the c term straight from the altitude, not from the difference of
// two large numbers:  |ro|^2 - r^2  =  (|ro| - r)(|ro| + r)  =  h * (h + 2r)
vec2 raySphereFromHeight(vec3 ro, vec3 rd, float radius, float height) {
  float b = dot(ro, rd);
  float c = height * (height + 2.0 * radius);
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1.0, -1.0);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

// Does the sun ray hit the ground? One comparison, without computing distance.
bool inPlanetShadow(vec3 p) {
  float b = dot(p, uSunDir);
  if (b > 0.0) return false; // closest approach is behind us, the ray recedes
  float c = dot(p, p) - R_GROUND * R_GROUND;
  return b * b - c > 0.0;
}

const float H_RAYLEIGH = 8.0; // km — scale height of air molecules
const float H_MIE = 1.2;      // km — aerosols stay closer to the ground

// The x component is Rayleigh density, y is Mie. They travel in a single vec2
// because they are carried side by side through the whole integral.
vec2 densityAt(vec3 p) {
  float h = length(p) - R_GROUND;
  return exp(-max(h, 0.0) / vec2(H_RAYLEIGH, H_MIE));
}

// Scattering coefficients for 680 / 550 / 440 nm, km^-1.
// The ratios follow the -4th power of the wavelength:
//   33.1 / 5.802 = 5.705   and   (680/440)^4 = 5.704
const vec3 BETA_RAYLEIGH = vec3(5.802e-3, 13.558e-3, 33.1e-3);

// Mie is color blind. It absorbs a bit more than it scatters; extinction is separate.
const float BETA_MIE_SCATTER = 21.0e-3;
const float BETA_MIE_EXTINCT = 23.333e-3;

const float PI = 3.14159265359;

// mu = cos(scattering angle). Its integral over the sphere is 1.
// Minimum at mu = 0 (3/16pi), maximum at mu = ±1 (3/8pi).
float phaseRayleigh(float mu) {
  return (3.0 / (16.0 * PI)) * (1.0 + mu * mu);
}

// g = strength of forward scattering. g = 0 is isotropic (1/4pi),
// g -> 1 gathers the light into a narrow halo around the sun.
float phaseMie(float mu, float g) {
  float gg = g * g;
  float denom = 1.0 + gg - 2.0 * g * mu;
  return (1.0 - gg) / (4.0 * PI * denom * sqrt(max(denom, 1e-4)));
}

// Optical depth from a point toward the sun. LIGHT_SAMPLES midpoint samples.
vec2 opticalDepthToSun(vec3 p) {
  vec2 shell = raySphere(p, uSunDir, R_ATMO);
  float segment = shell.y / float(LIGHT_SAMPLES);
  float t = 0.5 * segment; // midpoint: a simple rule that does not pile up at the ends
  vec2 depth = vec2(0.0);
  for (int i = 0; i < LIGHT_SAMPLES; i++) {
    depth += densityAt(p + uSunDir * t) * segment;
    gSamples++; // only read in measurement mode
    t += segment;
  }
  return depth;
}

vec3 scatterAlongRay(
  vec3 ro,
  vec3 rd,
  float tStart,
  float tEnd,
  out vec3 transmittance
) {
  float segment = (tEnd - tStart) / float(VIEW_SAMPLES);
  float t = tStart + 0.5 * segment;

  vec2 viewDepth = vec2(0.0);
  vec3 rayleighSum = vec3(0.0);
  vec3 mieSum = vec3(0.0);

  for (int i = 0; i < VIEW_SAMPLES; i++) {
    vec3 p = ro + rd * t;
    vec2 dRho = densityAt(p) * segment; // density × path = this slice's contribution
    gSamples++;
    viewDepth += dRho;

    if (!inPlanetShadow(p)) {
      vec2 sunDepth = opticalDepthToSun(p);
      // Sun to sample + sample to camera: the total extinction of both paths
      vec3 tau = BETA_RAYLEIGH * (sunDepth.x + viewDepth.x)
               + BETA_MIE_EXTINCT * (sunDepth.y + viewDepth.y);
      vec3 attenuation = exp(-tau);
      rayleighSum += attenuation * dRho.x;
      mieSum += attenuation * dRho.y;
    }
    t += segment;
  }

  transmittance = exp(-(BETA_RAYLEIGH * viewDepth.x
                      + BETA_MIE_EXTINCT * viewDepth.y));

  float mu = dot(rd, uSunDir);
  return uSunIntensity
    * (BETA_RAYLEIGH * phaseRayleigh(mu) * rayleighSum
     + BETA_MIE_SCATTER * phaseMie(mu, uMieG) * mieSum);
}

// iq's sine-free hash: consistent across drivers, and cheap.
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f); // smoothstep gives derivative continuity
  return mix(
    mix(mix(hash31(i + vec3(0, 0, 0)), hash31(i + vec3(1, 0, 0)), f.x),
        mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
        mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < TERRAIN_OCTAVES; i++) {
    sum += amp * valueNoise(p);
    p *= 2.03; // not exactly 2: keeps the octave grids from stacking up
    amp *= 0.5;
  }
  return sum;
}

vec3 groundAlbedo(vec3 n) {
  float h = fbm(n * 3.7);
  float lat = abs(n.y);
  vec3 ocean = mix(vec3(0.012, 0.045, 0.11), vec3(0.02, 0.09, 0.17),
                   smoothstep(0.30, 0.50, h));
  vec3 land = mix(vec3(0.07, 0.12, 0.05), vec3(0.24, 0.20, 0.13),
                  smoothstep(0.50, 0.72, h));
  vec3 col = mix(ocean, land, smoothstep(0.495, 0.515, h));
  return mix(col, vec3(0.72, 0.75, 0.78),
             smoothstep(0.80, 0.94, lat + h * 0.18)); // polar cap
}

vec3 groundRadiance(vec3 p) {
  vec3 n = normalize(p);
  float ndl = max(dot(n, uSunDir), 0.0);
  vec2 sunDepth = opticalDepthToSun(p);
  vec3 sunT = exp(-(BETA_RAYLEIGH * sunDepth.x
                  + BETA_MIE_EXTINCT * sunDepth.y));
  return groundAlbedo(n) * uSunIntensity * ndl * sunT / PI;
}

// |a - b| = 2 sin(θ/2) ≈ θ  (at small angles). Far more stable than acos.
float sunAngle(vec3 rd) {
  return length(rd - uSunDir);
}

vec3 sunDisk(vec3 rd) {
  float a = sunAngle(rd);
  float disk = 1.0 - smoothstep(
    SUN_ANGULAR_RADIUS * 0.92,
    SUN_ANGULAR_RADIUS * 1.08,
    a
  );
  return vec3(disk) * uSunIntensity * SUN_DISK_GAIN;
}

// Tonemap + gamma. Exposure is not a physical constant, it is a dial.
vec3 encode(vec3 hdr) {
  vec3 mapped = vec3(1.0) - exp(-hdr * uExposure);
  return pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));
}

vec3 rayDirection(vec2 fragCoord) {
  // dividing by res.y makes the vertical fov independent of the aspect ratio
  vec2 uv = (fragCoord - 0.5 * uResolution) / uResolution.y;
  return normalize(uCamBasis * vec3(uv, uFocal));
}

void main() {
  gSamples = 0;

  vec3 ro = uCamPos;
  vec3 rd = rayDirection(gl_FragCoord.xy);

  vec2 atmo = raySphereFromHeight(ro, rd, R_ATMO, uCamAltitude - ATMO_THICKNESS);
  if (atmo.x > atmo.y) {
    // We missed the atmosphere: empty space and the sun disk.
    if (uMode == MODE_SAMPLE_COUNT) {
      outColor = vec4(0.0, 0.0, 0.0, 1.0); // zero samples
      return;
    }
    outColor = vec4(encode(sunDisk(rd)), 1.0);
    return;
  }

  float tStart = max(atmo.x, 0.0);
  float tEnd = atmo.y;

  vec2 ground = raySphereFromHeight(ro, rd, R_GROUND, uCamAltitude);
  bool hitGround = ground.x <= ground.y && ground.y > 0.0;
  float tGround = max(ground.x, 0.0);
  if (hitGround) tEnd = min(tEnd, tGround);

  vec3 transmittance;
  vec3 inscatter = scatterAlongRay(ro, rd, tStart, tEnd, transmittance);

  // The counter can pass 255 (up to 544 on the 32×16 budget), hence two bytes.
  if (uMode == MODE_SAMPLE_COUNT) {
    int hi = gSamples / 256;
    int lo = gSamples - hi * 256;
    outColor = vec4(float(hi) / 255.0, float(lo) / 255.0, 0.0, 1.0);
    return;
  }

  vec3 col = inscatter;
  if (hitGround) {
    col += groundRadiance(ro + rd * tGround) * transmittance;
  } else {
    col += sunDisk(rd) * transmittance;
  }
  outColor = vec4(encode(col), 1.0);
}
