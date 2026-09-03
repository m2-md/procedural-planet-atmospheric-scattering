#version 300 es
// DİKKAT: "#version" MUTLAKA ilk satır olmak zorunda.
// VIEW_SAMPLES / LIGHT_SAMPLES / TERRAIN_OCTAVES bu dosyada TANIMLI DEĞİLDİR;
// src/program.ts içindeki buildFragmentSource() onları #version'ın hemen
// ardına enjekte eder. Bu dosyayı tek başına derlemeye çalışmayın.
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform vec3 uCamPos; // gezegen merkezine göre, km
uniform float uCamAltitude; // km — CPU'da double ile hesaplanıp taşınır
uniform mat3 uCamBasis; // sütunlar: right, up, forward
uniform float uFocal; // 1 / tan(fovY / 2)
uniform vec3 uSunDir; // birim, gezegenden güneşe
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
const float SUN_ANGULAR_RADIUS = 0.00465; // radyan (0,266 derece)
const float SUN_DISK_GAIN = 40.0;

// Piksel başına yoğunluk değerlendirmesi sayacı. Yalnızca MODE_SAMPLE_COUNT
// modunda okunuyor; her main() çağrısının başında sıfırlanır.
int gSamples = 0;

// Işın-küre kesişimi. rd birim uzunlukta kabul edilir.
// x = giriş mesafesi, y = çıkış mesafesi. Kesişim yoksa x > y döner.
vec2 raySphere(vec3 ro, vec3 rd, float radius) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1.0, -1.0); // kesişim yok
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

// height = |ro| - radius, CPU'da hesaplanıp taşınıyor.
// c terimini iki büyük sayının farkından değil, doğrudan irtifadan kuruyoruz:
//   |ro|^2 - r^2  =  (|ro| - r)(|ro| + r)  =  h * (h + 2r)
vec2 raySphereFromHeight(vec3 ro, vec3 rd, float radius, float height) {
  float b = dot(ro, rd);
  float c = height * (height + 2.0 * radius);
  float disc = b * b - c;
  if (disc < 0.0) return vec2(1.0, -1.0);
  float s = sqrt(disc);
  return vec2(-b - s, -b + s);
}

// Güneş ışını zemine çarpıyor mu? Mesafeyi hesaplamadan, tek karşılaştırmayla.
bool inPlanetShadow(vec3 p) {
  float b = dot(p, uSunDir);
  if (b > 0.0) return false; // en yakın yaklaşma geride kaldı, ışın uzaklaşıyor
  float c = dot(p, p) - R_GROUND * R_GROUND;
  return b * b - c > 0.0;
}

const float H_RAYLEIGH = 8.0; // km — hava moleküllerinin ölçek yüksekliği
const float H_MIE = 1.2;      // km — aerosoller yere daha yakın durur

// x bileşeni Rayleigh, y bileşeni Mie yoğunluğu. İkisi tek vec2'de gidiyor
// çünkü bütün integral boyunca yan yana taşınıyorlar.
vec2 densityAt(vec3 p) {
  float h = length(p) - R_GROUND;
  return exp(-max(h, 0.0) / vec2(H_RAYLEIGH, H_MIE));
}

// 680 / 550 / 440 nm için saçılma katsayıları, km^-1.
// Oranlar dalga boyunun -4. kuvvetini takip eder:
//   33.1 / 5.802 = 5.705   ve   (680/440)^4 = 5.704
const vec3 BETA_RAYLEIGH = vec3(5.802e-3, 13.558e-3, 33.1e-3);

// Mie renk körü. Saçtığından biraz fazlasını yutar; sönüm katsayısı ayrı.
const float BETA_MIE_SCATTER = 21.0e-3;
const float BETA_MIE_EXTINCT = 23.333e-3;

const float PI = 3.14159265359;

// mu = cos(saçılma açısı). Küre üzerindeki integrali 1'dir.
// mu = 0'da minimum (3/16pi), mu = ±1'de maksimum (3/8pi).
float phaseRayleigh(float mu) {
  return (3.0 / (16.0 * PI)) * (1.0 + mu * mu);
}

// g = ileri saçılmanın gücü. g = 0 izotropik (1/4pi),
// g -> 1 ışığı güneşin etrafında dar bir hâlede toplar.
float phaseMie(float mu, float g) {
  float gg = g * g;
  float denom = 1.0 + gg - 2.0 * g * mu;
  return (1.0 - gg) / (4.0 * PI * denom * sqrt(max(denom, 1e-4)));
}

// Bir noktadan güneşe doğru optik derinlik. LIGHT_SAMPLES orta-nokta örneği.
vec2 opticalDepthToSun(vec3 p) {
  vec2 shell = raySphere(p, uSunDir, R_ATMO);
  float segment = shell.y / float(LIGHT_SAMPLES);
  float t = 0.5 * segment; // orta nokta: uçlara yığılmayan basit kural
  vec2 depth = vec2(0.0);
  for (int i = 0; i < LIGHT_SAMPLES; i++) {
    depth += densityAt(p + uSunDir * t) * segment;
    gSamples++; // yalnızca ölçüm modunda okunuyor
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
    vec2 dRho = densityAt(p) * segment; // yoğunluk × yol = bu dilimin katkısı
    gSamples++;
    viewDepth += dRho;

    if (!inPlanetShadow(p)) {
      vec2 sunDepth = opticalDepthToSun(p);
      // Güneşten örneğe + örnekten kameraya: iki yolun toplam sönümü
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

// iq'nun sinüssüz hash'i: sürücüler arası tutarlı, ucuz.
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f); // smoothstep ile türev sürekliliği
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
    p *= 2.03; // tam 2 değil: oktavların ızgarası üst üste binmesin
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
             smoothstep(0.80, 0.94, lat + h * 0.18)); // kutup kapağı
}

vec3 groundRadiance(vec3 p) {
  vec3 n = normalize(p);
  float ndl = max(dot(n, uSunDir), 0.0);
  vec2 sunDepth = opticalDepthToSun(p);
  vec3 sunT = exp(-(BETA_RAYLEIGH * sunDepth.x
                  + BETA_MIE_EXTINCT * sunDepth.y));
  return groundAlbedo(n) * uSunIntensity * ndl * sunT / PI;
}

// |a - b| = 2 sin(θ/2) ≈ θ  (küçük açılarda). acos'tan çok daha kararlı.
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

// Tonemap + gama. Pozlama bir fizik sabiti değil, bir kadran.
vec3 encode(vec3 hdr) {
  vec3 mapped = vec3(1.0) - exp(-hdr * uExposure);
  return pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));
}

vec3 rayDirection(vec2 fragCoord) {
  // res.y'ye bölmek dikey görüş açısını en-boy oranından bağımsız kılar
  vec2 uv = (fragCoord - 0.5 * uResolution) / uResolution.y;
  return normalize(uCamBasis * vec3(uv, uFocal));
}

void main() {
  gSamples = 0;

  vec3 ro = uCamPos;
  vec3 rd = rayDirection(gl_FragCoord.xy);

  vec2 atmo = raySphereFromHeight(ro, rd, R_ATMO, uCamAltitude - ATMO_THICKNESS);
  if (atmo.x > atmo.y) {
    // Atmosferi ıskaladık: uzay boşluğu ve güneş diski.
    if (uMode == MODE_SAMPLE_COUNT) {
      outColor = vec4(0.0, 0.0, 0.0, 1.0); // sıfır örnek
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

  // Sayaç 255'i aşabilir (32×16 bütçesinde 544'e kadar), o yüzden iki bayt.
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
