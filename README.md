# Prosedürel Gezegen + Atmosferik Saçılım — tek geçişte Rayleigh ve Mie

"İçine Uçabileceğiniz Bir Gezegen: Tek Geçişte Rayleigh ve Mie, 8×4'e Karşı
32×16" makalesinin çalışan kodu. Ham WebGL2 (GLSL ES 3.00), TypeScript, Vite,
vitest. `three.js` yok, shader/matematik kütüphanesi yok, **gökyüzü dokusu yok**.

Sahnede tek bir üçgen var (`gl_VertexID` bit hilesiyle üretilen tam ekran quad).
Gökyüzünün mavisi, gün batımının kızıllığı, uzaydan görünen ince mavi kenar ve
uzaktaki zeminin puslanması — hepsi tek bir fragment shader'ının içindeki
saçılım integralinden çıkıyor.

## Ne içerir

- **Saf mantık katmanı** (`src/geometry.ts`, `src/camera.ts`, `src/phase.ts`,
  `src/scattering.ts`, `src/precision.ts`, `src/samples.ts`, `src/viewport.ts`,
  `src/stats.ts`, `src/program.ts`) — tarayıcı tanımıyor, `vitest` ile test
  ediliyor.
- **Fragment shader** (`src/shaders/planet.frag.glsl`) — analitik ışın-küre
  kesişimi, iki üstel yoğunluk profili, Rayleigh + Henyey-Greenstein faz
  fonksiyonları, gezegen gölgesi, prosedürel zemin (value noise + fbm),
  aerial perspective, tonemap. `VIEW_SAMPLES` / `LIGHT_SAMPLES` /
  `TERRAIN_OCTAVES` bu dosyada **tanımlı değildir**; `buildFragmentSource()`
  onları `#version` satırının hemen ardına `#define` olarak enjekte eder.
- **Örnek sayacı** (`src/probe.ts` + `src/samples.ts`) — piksel başına kaç
  yoğunluk değerlendirmesi yapıldığı 16 bit olarak renk kanallarına yazılıp
  geri okunuyor (`gl.disable(gl.DITHER)` bu yüzden zorunlu).
- **GPU saati** (`src/timer.ts`) — `EXT_disjoint_timer_query_webgl2`, sorgu
  kuyruğu, `GPU_DISJOINT_EXT` kontrolü. Uzantı yoksa çıktı bunu açıkça söyler
  (`timerExt: false`) ve GPU ms yerine kare süresi raporlanır.
- **Deterministik ölçüm modu** (`src/measure.ts`) — `?measure=1`.

## Kurulum

```bash
npm install
```

## Test (tarayıcısız, deterministik)

```bash
npm test
```

**91 test yeşil** (13 dosya):

| Dosya                     | Ne sınıyor                                                                        | Test |
| ------------------------- | --------------------------------------------------------------------------------- | ---- |
| `test/geometry.test.ts`   | ışın-küre kesişimi, teğet/ıskalama/içeriden kenar durumları                       | 7    |
| `test/vectors.test.ts`    | `normalize`/`cross`/`dot`, kesişim noktası yüzeyde mi                             | 4    |
| `test/precision.test.ts`  | ufuk taraması: kararlı biçim vs sade biçim, 2–200 km                              | 3    |
| `test/f32.test.ts`        | float32 ikizleri: zenitte fark yok, ıskalamada sonsuz                             | 3    |
| `test/phase.test.ts`      | küre integrali = 1, `g = 0` → `1/4π`, simetri, `g → 1` koruması                   | 7    |
| `test/scattering.test.ts` | yoğunluk monotonluğu, optik derinlik simetrisi, Beer-Lambert, gün batımı, `λ⁻⁴`   | 9    |
| `test/density.test.ts`    | iki ölçek yüksekliği, `max(h, 0)` kuralı                                          | 4    |
| `test/camera.test.ts`     | poz ortonormalliği, irtifanın taşınması, `basisMatrix`, ufuk açısı, gökyüzü bloğu | 12   |
| `test/program.test.ts`    | `#version` ilk satırda kalıyor mu, define enjeksiyonu                             | 8    |
| `test/constants.test.ts`  | **GLSL ↔ TypeScript sabit paritesi** (regex ile GLSL kaynağından okur)            | 9    |
| `test/samples.test.ts`    | 16 bitlik sayaç kodlama/çözme turu, `sampleStats`                                 | 6    |
| `test/viewport.test.ts`   | dpr/ölçek kelepçeleri, piksel bütçesi                                             | 7    |
| `test/stats.test.ts`      | medyan/yüzdelik kenar durumları, RMS, maks kanal farkı                            | 12   |

Hiçbir test dosyası `document`, `window`, `navigator`, `WebGL2RenderingContext`
ya da `performance` referansı içermez.

## Demo

```bash
npm run dev
```

`file://` ile açmayın — boş ekran verir (Vite bare module specifier'ları çözer).

Canvas **tam ekran değil**: 960 piksel genişliğinde 16:9 bir kutu. Varsayılan
bütçe 16 görüş × 8 ışık örneği, çözünürlük ölçeği 0.5, `devicePixelRatio` 2'ye
kelepçeli ve toplam arka tampon 1.400.000 pikselin altında tutuluyor. İlk
açılışta kimse fırının içine düşmüyor.

| Kontrol            | Değerler                | Varsayılan |
| ------------------ | ----------------------- | ---------- |
| Görüş örneği N     | 8 / 16 / 32 / 64        | **16**     |
| Işık örneği M      | 2 / 4 / 8 / 16 / 32     | **8**      |
| İrtifa (log ölçek) | 2 – 30.000 km           | 400 km     |
| Güneş yüksekliği   | −10° – 60°              | 12°        |
| Mie `g`            | 0 – 0.95                | 0.76       |
| Pozlama            | 0.5 – 6                 | 2.0        |
| Çözünürlük ölçeği  | 0.35 / 0.5 / 0.75 / 1.0 | **0.5**    |
| Mod                | Gölgeli / Örnek sayısı  | Gölgeli    |
| Dur/Devam          | —                       | Çalışıyor  |

Sekme arkaya geçtiğinde döngü kendiliğinden duruyor (`visibilitychange`);
gizli sekmede `requestAnimationFrame`'in yavaşlaması "kapandı" demek değil.

HUD iki gruba ayrılmış: **ÖLÇÜM** (FPS, kare ms, GPU ms, ortalama örnek/piksel,
kaplama %) ve **YAPISAL** (N × M, irtifa, güneş yüksekliği, `g`, pozlama, arka
tampon boyutu). Ölçülen ile seçilen aynı kutuda karışmıyor.

### Gözle bakılacaklar

1. **400 km, güneş 12°** (varsayılan): gezegenin kenarında dışa doğru sönen
   ince mavi bir halka.
2. **Güneş yüksekliği sürgüsünü 40° → 0° → −5°**: 2 km irtifada ufuk turuncuya
   dönüyor, güneş diski kadrajın sağında; makalenin açılış iddiası bu.
3. **Mie `g` 0 → 0.95**: güneşin çevresindeki hâle büyüyüp yoğunlaşıyor.
4. **İrtifayı 30.000 km'den 2 km'ye indirin**: ufuk çizgisi titremeden
   oturuyor. (`uCamAltitude` konumdan yeniden hesaplansaydı kaynardı.)
5. **20.000 km**: prosedürel kıta/okyanus deseni ve kutup kapakları görünür
   ölçekte. Alçak irtifada zemin tamamen aerial perspective'in altında kalır —
   gürültü ölçeği (yarıçapın ~1/4'ü) böyle davranıyor.
6. **Mod = Örnek sayısı**: uzayda atmosferi ıskalayan bölge tamamen siyah
   (0 örnek), atmosfere değen her piksel **düz** yeşil (16×8 için 144 = tavan).
   Düz olması makalenin iddiasının görsel kanıtı: döngü sayısı yol uzunluğuna
   değil `VIEW_SAMPLES`'a bağlı.

## Deterministik ölçüm modu

```
http://localhost:5173/?measure=1
```

Bu adreste demo interaktif modu tamamen bırakır:

- Arka tampon **960×540**'a kilitlenir (`devicePixelRatio` ve ölçek yok sayılır).
- rAF döngüsü kapalı; kareler `drawOnce()` ile sırayla sürülür, animasyon yok.
- Her yapılandırma için **30 ısınma karesi** atılır, sonra **180 kare** ölçülür.
- Bitince konsola **TEK SATIR** `MEASURE {json}` düşer.
- Tam koşu bu makinede ~27 saniye sürüyor. Koşu boyunca sekmeyi ön planda
  tutun; gizli sekmede rAF yavaşlar ve ölçüm uzar.

Ölçüm URL'leri:

| Amaç                             | URL                                                                     |
| -------------------------------- | ----------------------------------------------------------------------- |
| Etkileşimli demo                 | `http://localhost:5173/`                                                |
| Deterministik ölçüm              | `http://localhost:5173/?measure=1`                                      |
| Üretim derlemesi üzerinden ölçüm | `npm run build && npm run preview` → `http://localhost:4173/?measure=1` |

### Sabit pozlar

`fovY = 50°`, `lat = 18°`, `lon = 40°`, Mie `g = 0.76`, pozlama `2.0`,
`TERRAIN_OCTAVES = 4`. Pitch kuralı her irtifada `-dip + 2°`
(`dip = acos(R_GROUND / (R_GROUND + h))`), böylece ufuk kadrajda kalır.

| Poz      | İrtifa   | pitch    | Güneş yüksekliği |
| -------- | -------- | -------- | ---------------- |
| `space`  | 1.000 km | −28,193° | 25°              |
| `ground` | 2 km     | +0,565°  | 8°               |

Güneş azimutu kameranın baktığı yönden doğuya **18°** sapmalı. Sıfır olsaydı
güneş diski tam kadraj ortasına, yani gökyüzü ölçüm bloğunun içine düşer ve
R/B oranını bozardı; 90° olsaydı disk kadrajdan tamamen çıkardı.

### Koşu listesi

| Koşu  | Poz                                | N×M                               | Ölçülen                                                                                                 |
| ----- | ---------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A1–A4 | space                              | 8×4, 16×8, 32×16, 64×32           | GPU ms medyan/p95, kare ms medyan, `compileMs`, `firstDrawMs`, `meanSamples`, `coveragePct`, `rmsVsRef` |
| B1–B3 | space                              | 32×2, 16×4, 8×8                   | GPU ms medyan, RMS (A4 karesine göre)                                                                   |
| C0–C3 | ground                             | 64×32 (referans), 32×2, 16×4, 8×8 | GPU ms medyan, RMS (C0'a göre)                                                                          |
| D1–D5 | 20000 / 1000 / 100 / 10 / 2 km     | 16×8                              | GPU ms medyan, `coveragePct`, `meanSamples`                                                             |
| E1–E4 | ground, güneş 30° / 10° / 0° / −2° | 16×8                              | gökyüzü bloğu ortalama RGB + R/B oranı                                                                  |
| F     | —                                  | —                                 | `horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 })` (saf CPU)                                 |

Referans kare (64×32) her pozda **ilk** çekilir; RMS karşılaştırmaları aynı
pozda, aynı arka tamponda, `readFrame()` ile alınan RGBA8 tamponlar üzerinden
yapılır.

Gökyüzü bloğu: `skyProbeRect(groundPose, 50°, 960, 540, 2°)` →
`{ x: 448, y: 262, width: 64, height: 16 }` (GL, sol-alt orijin). Ufkun tam 2°
üstü, güneş diskinden 18° uzakta.

### `MEASURE {json}` → makale eşlemesi

| Makaledeki alan                                        | JSON yolu                                              |
| ------------------------------------------------------ | ------------------------------------------------------ |
| GPU adı                                                | `gpu`                                                  |
| ölçülen kare sayısı                                    | `frames`                                               |
| kararlı / sade biçim maks sapma                        | `precision.stableMaxErrKm` / `precision.naiveMaxErrKm` |
| bütçe tablosu (ortalama örnek, medyan/p95 GPU ms, RMS) | `budgets[]` (`view`, `light` ile eşleşir)              |
| 32×16 / 8×4 oranı                                      | `ratio32x16over8x4`                                    |
| derleme + link / ilk kare                              | `budgets[].compileMs` / `budgets[].firstDrawMs`        |
| eşit çarpım tablosu                                    | `equalProduct.space[]` / `equalProduct.ground[]`       |
| irtifa tablosu                                         | `altitude[]`                                           |
| gün batımı R/B tablosu                                 | `sunset[].redBlueRatio`                                |

`timerExt: false` gelirse GPU ms sütunları **doldurulmaz**; yerlerine
`wallMsMedian` yazılır ve sütun başlığı "kare süresi (ms)" olur.
`ratioSource` alanı oranın hangi saatten çıktığını söyler.

`gpu` için `WEBGL_debug_renderer_info` denenir; tarayıcı vermezse
`"bilinmiyor"` yazılır.

### Ham koşu kaydı

Ölçüm sonrası ham `MEASURE` satırları depo kökünde
`measurements-YYYY-MM-DD.jsonl` olarak saklanır (her satır bir koşu).
Soğuk derleme satırları (`compileMs`, `firstDrawMs`) **sayfa başına tek
gözlemdir** ve dosyada `"cold": true` ile işaretlenir. GPU zaman damgaları
kuantize gelirse (örn. 65,5 µs'nin katları) satıra `"quantized": true` notu
düşülür; `MEASURE` çıktısı ham medyanı verir, kararlılık yorumu yapmaz.

## Bilinen sınırlar

- **Ozon yok.** Gerçek atmosferde 25 km civarında ışığı yutan ama saçmayan bir
  katman var; alacakaranlıkta gökyüzünün tepesindeki derin maviyi büyük ölçüde o
  kuruyor. Burada güneş ufkun altına inince gökyüzü olması gerekenden çabuk
  griye düşüyor.
- **Çoklu saçılma yok.** Tek geçişli model: ışık bir kez sapıp göze geliyor.
- **Eşit aralıklı görüş örneklemesi.** Uzaydan limb'e bakarken ışın kabuk
  içinde 2.000 km'den fazla yol alıyor; 8 örnekle dilim boyu 250 km'yi aşıyor ve
  ölçek yüksekliği 8 km. RMS sütununun büyük çıktığı yer burası. Doğru çözüm
  önem örneklemesi ya da önceden hesaplanmış geçirgenlik tablosu.
- **Düşük irtifada gündüz manzarası beyaza doyuyor.** 2 km irtifada ufka yakın
  bakarken görüş ışını yüzlerce kilometre yoğun havadan geçiyor; tek saçılma +
  basit exp tonemap bunu doygun bırakıyor. Pozlama sürgüsü var ama sorunun
  kaynağı pozlama değil, modelin kendisi.

## Dosya haritası

```
src/
  constants.ts    fiziksel sabitler (GLSL ile parite testi var)
  geometry.ts     vektörler, ışın-küre, float32 ikizleri
  camera.ts       CameraPose, poseAtAltitude, basisMatrix, ufuk açısı, güneş yönü
  precision.ts    ufuk taraması: kararlı vs sade kesişim biçimi
  phase.ts        Rayleigh + Henyey-Greenstein, küre integrali
  scattering.ts   yoğunluk, optik derinlik, Beer-Lambert (CPU ikizleri)
  program.ts      define enjeksiyonu, derleme/link, satır numaralı hata dökümü
  modes.ts        MODE_SHADED / MODE_SAMPLE_COUNT
  probe.ts        240×135 RGBA8 FBO, örnek sayacı geri okuma
  samples.ts      16 bit sayaç çözme, SampleStats
  viewport.ts     dpr/ölçek kelepçeleri, piksel bütçesi
  timer.ts        GpuTimer (EXT_disjoint_timer_query_webgl2)
  stats.ts        medyan, yüzdelik, RMS, maks kanal farkı
  renderer.ts     program önbelleği, uniform'lar, probe, readFrame
  measure.ts      ?measure=1 koşu listesi → MEASURE {json}
  hud.ts          ÖLÇÜM / YAPISAL ayrımı
  main.ts         bootstrap, kontroller, Dur/Devam, visibilitychange
  shaders/
    fullscreen.vert.glsl   gl_VertexID'den üç köşe
    planet.frag.glsl       bütün saçılım hesabı
```

## Lisans

MIT — bkz. `LICENSE`.
