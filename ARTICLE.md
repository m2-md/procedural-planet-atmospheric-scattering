# İçine Uçabileceğiniz Bir Gezegen: Tek Geçişte Rayleigh ve Mie, 8×4'e Karşı 32×16

*Bu gezegenin gökyüzünü hiçbir doku beslemiyor. Mavi de, gün batımının kızıllığı da, uzaydan görünen o ince mavi kenar da tek bir fragment shader'ının içindeki saçılım integralinden çıkıyor. Analitik ışın-küre kesişimi, iki üstel yoğunluk profili, Rayleigh ve Henyey-Greenstein faz fonksiyonları; sonunda örnekleme bütçesinin GPU saatiyle ölçülmüş faturası.*

*Tahmini okuma süresi: 19 dakika*

---

Güneşi ufka indirdim ve gökyüzü kızardı.

Kızarması için tek satır yazmamıştım. Kodda "sunset" diye bir dal, turuncu diye bir sabit, ufka doğru koyulaşan bir gradyan dokusu yok. Olan şey iki katsayı vektörü, iki üstel yoğunluk profili ve görüş ışını boyunca alınan bir toplam.

Kızarmanın sebebi, gökyüzünün mavi olmasının sebebiyle birebir aynı. Hava molekülleri kısa dalga boylarını uzunlardan yaklaşık altı kat daha güçlü saçıyor. Güneş tepedeyken ışık atmosferde kısa bir yol alıyor, o yolda saçılan mavinin bir kısmı gözünüze dönüyor ve gökyüzü mavi oluyor. Güneş ufka indiğinde aynı ışık atmosferde on kat uzun bir yol alıyor; mavinin neredeyse tamamı yolda saçılıp dağılıyor ve size ulaşan artık kırmızı oluyor.

Tek mekanizma, iki görüntü. Bu yazının derdi o mekanizmayı bir fragment shader'ına oturtmak ve sonra ona fatura kesmek.

Önce iki küre kuracağız: gezegen ve onu saran atmosfer kabuğu. İkisiyle de kesişimi analitik alacağız, çünkü küre için ışın yürütmek gereksiz. Sonra yoğunluğun neden üstel olduğunu ve optik derinliğin ne anlama geldiğini konuşacağız. İntegrali ayrıklaştırıp N görüş örneği × M ışık örneğine böleceğiz; maliyetin tam olarak nereden geldiğini bu bölümde göreceksiniz. Faz fonksiyonlarını yazıp küre üzerindeki integrallerini teste çivileyeceğiz. Zemine prosedürel bir gezegen yüzeyi koyup aynı integrali havadan görünüm için yeniden kullanacağız. Kamerayı uzaydan yere indirip maliyetin nasıl değiştiğini ölçeceğiz. En sonda üç bütçe yan yana duruyor: 8×4, 16×8, 32×16, üçü de GPU'nun kendi saatiyle tartılmış.

Sürüm notu: ham WebGL2 (GLSL ES 3.00), TypeScript, Vite, vitest. `three.js` yok, shader kütüphanesi yok; ekrandaki her renk hesaplanıyor.

Skybox'ı gömmek gibi bir niyetim yok. Sabit bir gökyüzü küpü tek bir doku örneklemesine mal olur, buradaki shader ise piksel başına yüzlerce üstel hesaplayacak. Aradaki uçurum kapanmıyor, kapanmasına gerek de yok. Asıl soru şu: sizin gökyüzünüzün bir parametreye bağlı olması gerekiyor mu? Güneş hareket ediyorsa, kamera atmosferden çıkıp giriyorsa, uzaktaki dağın üstüne çöken mavi pus kamerayla birlikte değişmek zorundaysa dokuya sığdıracak sabit bir gökyüzünüz yok demektir. O noktadan sonra her piksel kendi integralini ödüyor.

### Kötü Aynalardan Bir Kalabalık

Atmosferi bir kalabalık gibi düşünün. Kalabalığın içindeki her birey kötü bir ayna: üstüne düşen ışığın çok küçük bir kısmını rastgele bir yöne çeviriyor, geri kalanını bırakıp geçiriyor. Gökyüzünde iki tür kötü ayna var.

Birincisi hava moleküllerinin kendisi. Işığın dalga boyundan çok daha küçükler ve bu yüzden renk konusunda son derece taraflılar: saçma gücü dalga boyunun dördüncü kuvvetiyle ters orantılı. Buna Rayleigh saçılması diyoruz. Kırmızı 680 nm, mavi 440 nm; oran `(680/440)⁴ = 5,70`. Mavi, kırmızıdan neredeyse altı kat daha çok sapıyor.

İkincisi aerosoller: toz, tuz, is, su damlacıkları. Dalga boyuyla kıyaslanabilir büyüklükteler, renge neredeyse hiç bakmıyorlar ve ışığı çoğunlukla geldiği yöne doğru, ileriye fırlatıyorlar. Buna Mie saçılması diyoruz. Güneşin çevresindeki o beyazımsı hâle, puslu havada ufkun süt gibi olması, hep bu ikinci grubun işi.

Kalabalıktan geçen ışığın hesabı iki soruya iniyor. Kaç aynanın yanından geçtim? Ve o aynalar ışığı nereye çevirdi?

Birincinin adı **optical depth** (optik derinlik). Yol boyunca biriktirdiğiniz yoğunluk; ne kadar büyükse o kadar az ışık karşı tarafa sağ çıkar.

İkincinin adı **phase function** (faz fonksiyonu): bir ayna ışığı hangi açıya, hangi olasılıkla gönderiyor.

Bu iki kavram yazının sonuna kadar peşimizde. Gün batımının kırmızısı birincinin, güneşin etrafındaki hâle ikincinin imzası.

### İki Küre, Bir Analitik Kesişim

Sahnede iki küre var. Yarıçapı 6371 km olan gezegen ve onu saran, yarıçapı 6471 km olan atmosfer kabuğu. Yüz kilometrelik bir kabuk; gerçek atmosferin de pratikte bittiği yer orası.

Küre için ışın yürütmeye gerek yok. Işın-küre kesişiminin kapalı formu var ve bir karekökten ibaret:

```glsl
// src/shaders/planet.frag.glsl (parça)
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
```

Bu fonksiyon doğru. Ama kamerayı gezegene indirdiğinizde yalan söylemeye başlıyor.

Kamerayı 2 km irtifaya çekip ufka baktığım kareyi hatırlıyorum. Çizgi yerinde durmuyordu. Kamerayı bir tık oynattığımda ufuk kaynıyor, uzaktaki kıyı şeridi titriyordu. İlk şüphem örnek sayısına gitti; N'i 8'den 64'e çıkardım, hiçbir şey değişmedi. Sonra zemin kesişim mesafesini konsola bastım ve sayının kendisinin oynadığını gördüm.

Sorun `dot(ro, ro) - radius * radius` satırında. Kamera yüzeyin 2 km üstündeyken `|ro| = 6373` oluyor: `dot(ro, ro) = 40.615.129` ve `radius² = 40.589.641`. İki devasa sayıyı çıkarıp 25.488 gibi küçük bir sayı elde ediyoruz. float32'nin 24 bitlik mantisi bu büyüklükte yaklaşık 4 birimlik bir çözünürlük veriyor; sonucun anlamlı basamaklarının bir kısmı çıkarmada buharlaşıyor. Bunun adı catastrophic cancellation (katastrofik iptal).

Normalde bu 0,02'lik bir hata, kimsenin umurunda olmazdı. Ama ufka bakarken `disc = b² - c` ifadesi de neredeyse sıfıra iniyor ve karekökün türevi orada patlıyor. Küçük bir `c` hatası, kesişim mesafesinde yüzlerce metreye dönüşüyor.

Çözüm hatayı temizlemek değil, hiç üretmemek. `|ro|² - r²` çarpanlarına ayrılabilir: `(|ro| - r)(|ro| + r)`. İlk çarpan kameranın irtifası. İrtifayı konumdan geri hesaplamaya çalışmayın; zaten kaybolan bilgi orada. Onu CPU tarafında double duyarlıkla hesaplayıp ayrı bir uniform olarak taşıyın:

```glsl
// src/shaders/planet.frag.glsl (parça)
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
```

Aynı matematik, aynı satır sayısı, bambaşka bir hassasiyet. Kamera konumu için bu biçimi, kabuğun içindeki örnek noktaları için ise sade biçimi kullanıyoruz. Örnek noktalarında sorun çıkmıyor, çünkü orada karekökün patladığı teğet durum yoğunluğu sıfıra yakın bir bölgede kalıyor.

Geriye kalan hata `b = dot(ro, rd)` teriminden geliyor ve o da 6371 büyüklüğünde sayıların toplamı. Hassasiyet tamamen kurtarılmıyor, sadece baskın kaynak değiştiriliyor. İki biçimi aynı taramadan geçirdiğimizde kararlı biçimin en büyük sapması 0,001475 km, sade biçimin 0,0875 km çıkıyor.

Bu karşılaştırmayı JavaScript'te float32 taklidiyle yapıyoruz, çünkü JS'in kendi sayıları double ve hatayı hiç göstermiyor:

```ts
// src/geometry.ts (parça)
const f = Math.fround; // her ara sonucu float32'ye kırp

export function groundHitNaiveF32(ro: Vec3, rd: Vec3, radius: number): number {
  const b = f(f(f(ro[0] * rd[0]) + f(ro[1] * rd[1])) + f(ro[2] * rd[2]));
  const dotRo = f(f(f(ro[0] * ro[0]) + f(ro[1] * ro[1])) + f(ro[2] * ro[2]));
  const c = f(dotRo - f(radius * radius));
  const disc = f(f(b * b) - c);
  if (disc < 0) return Number.POSITIVE_INFINITY;
  return f(f(-b) - f(Math.sqrt(disc)));
}

export function groundHitFromHeightF32(
  ro: Vec3,
  rd: Vec3,
  radius: number,
  height: number,
): number {
  const b = f(f(f(ro[0] * rd[0]) + f(ro[1] * rd[1])) + f(ro[2] * rd[2]));
  const c = f(height * f(height + f(2 * radius)));
  const disc = f(f(b * b) - c);
  if (disc < 0) return Number.POSITIVE_INFINITY;
  return f(f(-b) - f(Math.sqrt(disc)));
}
```

Dürüst olmak gerekirse bu bir kanıt değil, bir argüman. GPU derleyicisi çarpma ve toplamayı tek bir FMA komutuna birleştirebilir, ifadeleri yeniden sıralayabilir; JS ikizinin ürettiği hata GLSL'in ürettiği hatayla birebir aynı olmak zorunda değil. Kanıt olan şey ekranda ufuk çizgisinin yerinde durması. Bu test o davranışın sebebini açıklıyor, varlığını değil.

Kamerayı da CPU tarafında kuruyoruz, tam olarak bu yüzden. İrtifa bir girdi; konum ondan türüyor, tersi değil:

```ts
// src/camera.ts
import { R_GROUND } from "./constants";
import { cross, normalize } from "./geometry";

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly position: Vec3; // gezegen merkezine göre, km
  readonly altitude: number; // km — konumdan GERİ HESAPLANMAZ, taşınır
  readonly right: Vec3;
  readonly up: Vec3;
  readonly forward: Vec3;
}

// latitude/longitude bir yüzey noktası verir; irtifa o noktanın üstüne çıkar.
// pitch = 0 ufka bakar, pozitif değer burnu yukarı kaldırır.
export function poseAtAltitude(
  altitudeKm: number,
  latRad: number,
  lonRad: number,
  pitchRad: number,
): CameraPose {
  const cosLat = Math.cos(latRad);
  const up: Vec3 = [
    cosLat * Math.cos(lonRad),
    Math.sin(latRad),
    cosLat * Math.sin(lonRad),
  ];
  const r = R_GROUND + altitudeKm;
  const position: Vec3 = [up[0] * r, up[1] * r, up[2] * r];

  // Kuzeyi referans alıp yüzeye teğet bir doğu vektörü kur.
  const north: Vec3 = [0, 1, 0];
  const east = normalize(cross(north, up));
  const tangent = cross(up, east); // ufka bakan yön

  const cp = Math.cos(pitchRad);
  const sp = Math.sin(pitchRad);
  const forward = normalize([
    tangent[0] * cp + up[0] * sp,
    tangent[1] * cp + up[1] * sp,
    tangent[2] * cp + up[2] * sp,
  ]);
  const right = normalize(cross(forward, up));
  const camUp = cross(right, forward);

  return { position, altitude: altitudeKm, right, up: camUp, forward };
}
```

Shader'a ışın yönünü kurmak için hazır bir ortonormal baz gidiyor. `mat3` GLSL'de sütun-öncelikli, dolayısıyla sütunlar sırasıyla sağ, yukarı ve ileri:

```glsl
// src/shaders/planet.frag.glsl (parça)
vec3 rayDirection(vec2 fragCoord) {
  // res.y'ye bölmek dikey görüş açısını en-boy oranından bağımsız kılar
  vec2 uv = (fragCoord - 0.5 * uResolution) / uResolution.y;
  return normalize(uCamBasis * vec3(uv, uFocal));
}
```

Sahnedeki geometri bundan ibaret. Ekranı kaplayan tek bir üçgen çiziyoruz, köşelerini `gl_VertexID`'den bit işlemleriyle üretiyoruz, vertex buffer kurmuyoruz. Bu üçgen bu blogda ikinci kez karşımıza çıkıyor, o yüzden üstünde durmuyorum. Geri kalan her şey fragment shader'ının içinde.

### Yoğunluk Bir Üsteldir

Atmosfer yukarı çıktıkça seyreliyor ve bunu üstel bir yasayla yapıyor: her sabit yükseklik artışında yoğunluk aynı oranda düşüyor. O sabitin adı scale height (ölçek yüksekliği).

Havanın ölçek yüksekliği yaklaşık 8 km. Sekiz kilometre yükselince yoğunluk `1/e`'sine iniyor, yaklaşık %37'sine. Aerosollerin ölçek yüksekliği çok daha kısa: 1,2 km. Toz yere yakın duruyor, molekül kalabalığı yukarıya kadar çıkıyor. Bu tek fark gün batımının rengini belirleyen şeylerden biri.

```glsl
// src/shaders/planet.frag.glsl (parça)
const float H_RAYLEIGH = 8.0; // km — hava moleküllerinin ölçek yüksekliği
const float H_MIE = 1.2;      // km — aerosoller yere daha yakın durur

// x bileşeni Rayleigh, y bileşeni Mie yoğunluğu. İkisi tek vec2'de gidiyor
// çünkü bütün integral boyunca yan yana taşınıyorlar.
vec2 densityAt(vec3 p) {
  float h = length(p) - R_GROUND;
  return exp(-max(h, 0.0) / vec2(H_RAYLEIGH, H_MIE));
}
```

Optik derinlik, bu yoğunluğun yol boyunca integrali. Fiziksel anlamı şu: bir ışın A'dan B'ye giderken kaç kötü aynanın yanından geçti. Işığın ne kadarının sağ çıktığı buradan geliyor ve formülü Beer-Lambert yasası:

```
T = exp(-β · τ)
```

Soldaki `T` transmittance (geçirgenlik): yolun sonunda hayatta kalan ışığın oranı. `τ` optik derinlik, `β` ise saçılma katsayısı: birim yoğunluktaki havanın birim mesafede ne kadar saçtığı. Rayleigh için üç ayrı sayı, çünkü üç ayrı renk kanalı:

```glsl
// 680 / 550 / 440 nm için saçılma katsayıları, km^-1.
// Oranlar dalga boyunun -4. kuvvetini takip eder:
//   33.1 / 5.802 = 5.705   ve   (680/440)^4 = 5.704
const vec3 BETA_RAYLEIGH = vec3(5.802e-3, 13.558e-3, 33.1e-3);

// Mie renk körü. Saçtığından biraz fazlasını yutar; sönüm katsayısı ayrı.
const float BETA_MIE_SCATTER = 21.0e-3;
const float BETA_MIE_EXTINCT = 23.333e-3;
```

O yorum satırındaki iki sayının birbirini tutması hoş bir tesadüf değil, katsayı setinin doğru olduğunun kontrolü. Testte de aynen bu duruyor.

Beer-Lambert'in üç davranışı ezberlemeye değer, çünkü üçü de birer test cümlesi:

- `τ` arttıkça `T` monoton azalır ve asla sıfırın altına inmez. Işık tükenir, negatifleşmez.
- `τ = 0` iken `T = 1`. Hiç madde yoksa hiç kayıp yok.
- Aynı `τ` için mavi kanalın kaybı kırmızıdan büyüktür, çünkü `β` mavide beş buçuk kat büyük.

Üçüncüsü gün batımının cebirsel hâli. Yol uzadıkça `τ` büyüyor; kırmızı ile mavinin geçirgenlik oranı `exp(-(β_mavi - β_kırmızı) · τ)` ile üstel olarak açılıyor. Formül dönüp dolaşıp aynı yere geliyor.

Bir eksiği baştan söyleyeyim: ozon yok. Gerçek atmosferde 25 km civarında ışığı yutan ama saçmayan bir ozon katmanı var ve alacakaranlıkta gökyüzünün tepesindeki o derin maviyi büyük ölçüde o kuruyor. Bizim modelde o katman yok, dolayısıyla güneş ufkun altına indiğinde gökyüzü olması gerekenden daha çabuk griye düşüyor.

### İntegrali Ayrıklaştırmak: N Görüş × M Işık

Şimdi asıl hesap. Kameradan çıkan bir ışın atmosferi kesiyor. O ışın boyunca her noktada, güneşten gelen ışığın bir kısmı bize doğru sapıyor. Gördüğümüz renk bu sapmaların toplamı.

Her örnek noktası için üç şey lazım. Güneş ışığının o noktaya ulaşırken ne kadarının hayatta kaldığı. O noktadan bize ulaşırken ne kadarının hayatta kaldığı. Ve o noktadaki saçılmanın bizim baktığımız açıya ne kadarını gönderdiği.

Birinci madde bir integral daha demek: her görüş örneğinden güneşe doğru ikinci bir yürüyüş. İç içe iki döngünün sebebi bu.

```glsl
// src/shaders/planet.frag.glsl (parça)
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
```

Bir de gölge sorusu var: örnek noktası gezegenin arkasında mı kaldı? Buna cevap vermek için kesişim mesafesine ihtiyacımız yok, sadece kesişip kesişmediğine:

```glsl
// Güneş ışını zemine çarpıyor mu? Mesafeyi hesaplamadan, tek karşılaştırmayla.
bool inPlanetShadow(vec3 p) {
  float b = dot(p, uSunDir);
  if (b > 0.0) return false; // en yakın yaklaşma geride kaldı, ışın uzaklaşıyor
  float c = dot(p, p) - R_GROUND * R_GROUND;
  return b * b - c > 0.0;
}
```

Bu üç satır gezegenin gece tarafını ve terminatör çizgisini bedavaya getiriyor. Ana döngü şöyle:

```glsl
// src/shaders/planet.frag.glsl (parça)
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
```

Faz fonksiyonu ve saçılma katsayısı döngünün dışında duruyor, çünkü ikisi de görüş yönüne bağlı ve o yön ışın boyunca değişmiyor. Bu tek geçişli modelin en büyük kısayolu: güneş yönü paralel ışık kabul ediliyor, dolayısıyla saçılma açısı bütün örnek noktalarında sabit.

Maliyeti sayalım. Her piksel `VIEW_SAMPLES` kere yoğunluk hesaplıyor, artı gölgede olmayan her görüş örneği için `LIGHT_SAMPLES` kere daha. Tavan `N + N·M`:

| Bütçe | Tavan (yoğunluk değerlendirmesi/piksel) |
|---|---|
| 8×4 | 40 |
| 16×8 | 144 |
| 32×16 | 544 |

8×4'ten 32×16'ya geçmek örnek sayısını 13,6 katına çıkarıyor. GPU zamanının da 13,6 katına çıkıp çıkmadığı yazının sonundaki soru.

Burada bir zayıflık var ve saklamayacağım. Örnekler görüş ışını boyunca eşit aralıklarla dağıtılıyor. Uzaydan gezegenin kenarına baktığınızda ışın atmosfer kabuğunun içinde iki bin kilometreden fazla yol alıyor; sekiz örnekle bölerseniz her dilim iki yüz kilometreyi aşıyor. Ölçek yüksekliği 8 km. Yoğunluğun neredeyse tamamının yaşadığı bölge tek bir dilime düşüyor ve orta-nokta kuralı o dilimin örneğini tam ortasından alıyor; yoğun katman çoktan altta kalmış oluyor. Doğru çözüm yoğunluğa göre importance sampling (önem örneklemesi) ya da önceden hesaplanmış bir geçirgenlik tablosu; ikisi de bu yazının kapsamı dışında. Aşağıdaki RMS sütunu bu zayıflığın sayıya dönmüş hâli.

`VIEW_SAMPLES` ve `LIGHT_SAMPLES` uniform değil, `#define`. Sebebi ölçümün adil olması: sabit sınırlı döngüyü derleyici açabilir, uniform sınırlıyı açamaz. İki bütçeyi karşılaştıracaksak ikisi de üretimde nasıl derlenecekse öyle derlenmeli.

```ts
// src/program.ts
export interface SceneDefines {
  viewSamples: number;
  lightSamples: number;
  terrainOctaves: number;
}

// GLSL ES 3.00'te "#version" satırının önüne hiçbir şey giremez.
export function buildFragmentSource(
  source: string,
  defines: SceneDefines,
): string {
  const lines = source.split("\n");
  if (!lines[0].trim().startsWith("#version")) {
    throw new Error("#version 300 es kaynağın ilk satırı olmalı");
  }
  const block = [
    `#define VIEW_SAMPLES ${defines.viewSamples}`,
    `#define LIGHT_SAMPLES ${defines.lightSamples}`,
    `#define TERRAIN_OCTAVES ${defines.terrainOctaves}`,
  ];
  return [lines[0], ...block, ...lines.slice(1)].join("\n");
}
```

Bunun bir yan etkisi var ve ölçüm bölümünde geri dönecek: 32×16 bütçesinde derleyicinin açması gereken iç gövde 512 kopya. Program o yüzden anında derlenmiyor.

### Faz Fonksiyonları: Işık Nereye Sapıyor

Optik derinlik "ne kadarı kayboldu" sorusunu cevaplıyor. Faz fonksiyonu "kaybolanın ne kadarı bana geldi" sorusunu.

Kalabalıktaki kötü aynaya geri dönelim. Faz fonksiyonu o aynanın hangi açıyı kayırdığını söylüyor: saçılma açısına göre bir olasılık dağılımı. Küre üzerindeki integrali tam olarak 1 olmak zorunda, çünkü saçılan ışık bir yere gidiyor, yok olmuyor.

Rayleigh'in fazı simetrik. Işık ileri ve geri eşit güçte sapıyor, yanlara biraz daha az:

```glsl
// src/shaders/planet.frag.glsl (parça)
const float PI = 3.14159265359;

// mu = cos(saçılma açısı). Küre üzerindeki integrali 1'dir.
// mu = 0'da minimum (3/16pi), mu = ±1'de maksimum (3/8pi).
float phaseRayleigh(float mu) {
  return (3.0 / (16.0 * PI)) * (1.0 + mu * mu);
}
```

Mie'nin fazı taraflı. Aerosoller ışığı ağırlıklı olarak ileri fırlatıyor ve bunun ucuz modeli Henyey-Greenstein:

```glsl
// g = ileri saçılmanın gücü. g = 0 izotropik (1/4pi),
// g -> 1 ışığı güneşin etrafında dar bir hâlede toplar.
float phaseMie(float mu, float g) {
  float gg = g * g;
  float denom = 1.0 + gg - 2.0 * g * mu;
  return (1.0 - gg) / (4.0 * PI * denom * sqrt(max(denom, 1e-4)));
}
```

Paydadaki `denom * sqrt(denom)` ifadesi `pow(denom, 1.5)`'in ucuz hâli. `max` koruması `g = 1` sınırında sıfıra bölmeyi engelliyor; o sınırda fonksiyon zaten bir delta dağılımına yakınsıyor ve fiziksel anlamını yitiriyor.

`g` bir uniform ve demoda sürgüde. Varsayılan 0,76, temiz hava için makul bir değer. Sıfıra çekince güneşin etrafındaki hâle kayboluyor, 0,95'e çekince güneş küçük bir mücevhere dönüşüp ekranın geri kalanı kararıyor. İkinci durum fizikî değil, ama fonksiyonun ne yaptığını en net gösteren an.

Bu iki fonksiyon saf matematik, dolayısıyla tarayıcıya hiç girmeden doğrulanabilir. Normalizasyonu sayısal integralle çiviliyoruz:

```ts
// src/phase.ts
export function phaseRayleigh(mu: number): number {
  return (3 / (16 * Math.PI)) * (1 + mu * mu);
}

export function phaseMie(mu: number, g: number): number {
  const gg = g * g;
  const denom = 1 + gg - 2 * g * mu;
  return (1 - gg) / (4 * Math.PI * denom * Math.sqrt(Math.max(denom, 1e-4)));
}

// Küre üzerindeki integral: ∫ p(mu) dΩ = 2π ∫ p(mu) dmu, mu ∈ [-1, 1].
// Orta-nokta kuralı, tek yönlü simetri olduğu için azimut analitik.
export function integrateOverSphere(
  phase: (mu: number) => number,
  samples: number,
): number {
  const step = 2 / samples;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    sum += phase(-1 + (i + 0.5) * step) * step;
  }
  return 2 * Math.PI * sum;
}
```

Testte iki fonksiyonun da integrali 1 çıkıyor, `g = 0` için Henyey-Greenstein tam olarak `1/4π` veriyor, Rayleigh `p(mu) = p(-mu)` simetrisini koruyor. Sıkıcı testler, ama bir faz fonksiyonunda hata yaptığınızda ekranda gördüğünüz şey "biraz karanlık bir gökyüzü" oluyor ve o hatayı gözle bulmanız aylar sürebilir.

Güneşin kendisi de gökyüzüne çizilmesi gereken bir şey. Diskin açısal yarıçapı 0,266 derece; radyan cinsinden 0,00465. Kosinüsüyle karşılaştırma yapmak cazip ama kötü bir fikir: `cos(0,266°) = 0,9999892` ve float32'de bu sayının komşusuyla arasında birkaç düzine adım var. Bunun yerine iki birim vektör arasındaki mesafeyi kullanıyoruz; küçük açılarda o mesafe doğrudan radyan cinsinden açıya eşit:

```glsl
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
```

### Zemin: Gezegen Neye Benziyor

Gökyüzü tek başına yeterli değil. İçine uçtuğunuz şeyin bir yüzeyi olmalı ve o yüzey bir doku dosyasından gelmemeli.

Yüzey rengini küre normalinden türetiyoruz. Birim normal üç boyutlu bir gürültü alanına giriyor, çıkan sayı "yükseklik" olarak yorumlanıyor, bir eşiğin altı deniz üstü kara oluyor:

```glsl
// src/shaders/planet.frag.glsl (parça)
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
```

`p *= 2.03` satırındaki üç yüzde ihmal edilebilir görünüyor ama değil. Tam 2 ile ölçeklerseniz bütün oktavlar tamsayı ızgara noktalarında üst üste biner ve gürültüde görünür bir kare deseni oluşur. Küsuratlı bir katsayı o hizalanmayı bozuyor.

Zeminin ışığı da aynı integralden geçiyor. Yüzeyden gelen radyans önce güneşe doğru optik derinliği ödüyor, sonra kameraya gelirken görüş yolunun geçirgenliğiyle çarpılıyor, üstüne de aradaki havanın kendi saçılımı ekleniyor:

```glsl
vec3 groundRadiance(vec3 p) {
  vec3 n = normalize(p);
  float ndl = max(dot(n, uSunDir), 0.0);
  vec2 sunDepth = opticalDepthToSun(p);
  vec3 sunT = exp(-(BETA_RAYLEIGH * sunDepth.x
                  + BETA_MIE_EXTINCT * sunDepth.y));
  return groundAlbedo(n) * uSunIntensity * ndl * sunT / PI;
}
```

Ve `main` içinde:

```glsl
  vec3 col = inscatter;
  if (hitGround) {
    col += groundRadiance(ro + rd * tGround) * transmittance;
  } else {
    col += sunDisk(rd) * transmittance;
  }
  outColor = vec4(encode(col), 1.0);
```

`encode` ise integralin dışında kalan tek keyfi adım. Saçılım hesabı fiziksel birimlerde çalışıyor ve sonuç 0-1 aralığına sığmıyor; ekrana basmadan önce sıkıştırmak gerekiyor:

```glsl
// Tonemap + gama. Pozlama bir fizik sabiti değil, bir kadran.
vec3 encode(vec3 hdr) {
  vec3 mapped = vec3(1.0) - exp(-hdr * uExposure);
  return pow(clamp(mapped, 0.0, 1.0), vec3(1.0 / 2.2));
}
```

O `* transmittance` çarpımı, ders kitaplarında "aerial perspective" (havadan perspektif) diye geçen şeyin tamamı. Uzaktaki dağın soluklaşıp maviye kaçmasının sebebi bu iki terim: yüzeyden gelen ışığın bir kısmı yolda kayboluyor, yerine aradaki havanın saçtığı mavi geliyor. Ayrı bir sis shader'ı yazmıyoruz. Gökyüzünü hesaplayan integralin yan ürünü.

Zeminin maliyeti bir ışık yürüyüşü daha ekliyor: zemine çarpan pikseller için tavan `N + N·M + M` oluyor. Küçük bir ekleme, ama gezegene indiğinizde ekranın yarısı zemin olduğu için toplamda görünür.

### Uzaydan Yere: Kamera İrtifası Maliyeti Değiştirir

Sezgi şunu söylüyor: uzaydan bakınca ışın atmosferde daha uzun yol alıyor, demek ki daha pahalı. Sezgi yanılıyor.

Döngünün tur sayısı yol uzunluğuna bağlı değil. `VIEW_SAMPLES` sabit; ışın iki bin kilometre de gitse iki kilometre de gitse aynı sayıda örnek alınıyor, sadece dilim boyu değişiyor. Maliyeti belirleyen şey kaç pikselin iş yaptığı.

Uzaydan bakıldığında ekranın büyük kısmı atmosfer kabuğunu tamamen ıskalıyor ve fonksiyonun ilk satırında geri dönüyor:

```glsl
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
```

Yere indiğinizde ise tersi oluyor: her piksel ya gökyüzüne ya zemine bakıyor, hiçbiri erken çıkmıyor, üstüne zemine çarpanlar fazladan bir ışık yürüyüşü ödüyor. Yani asıl fatura uzayda değil, yerde.

Peki bunu tahmin etmek yerine nasıl sayıya çeviririz? Her pikselin kaç yoğunluk değerlendirmesi yaptığını 16 bit olarak renk kanallarına yazıp geri okuyoruz:

```glsl
  // Sayaç 255'i aşabilir (32×16 bütçesinde 544'e kadar), o yüzden iki bayt.
  if (uMode == MODE_SAMPLE_COUNT) {
    int hi = gSamples / 256;
    int lo = gSamples - hi * 256;
    outColor = vec4(float(hi) / 255.0, float(lo) / 255.0, 0.0, 1.0);
    return;
  }
```

```ts
// src/samples.ts
export interface SampleStats {
  readonly pixels: number;
  readonly mean: number; // atmosfere değen piksellerin ortalaması değil, TÜM piksellerin
  readonly max: number;
  readonly coveragePct: number; // en az bir örnek alan piksellerin yüzdesi
}

export function sampleStats(pixels: Uint8Array): SampleStats {
  const count = Math.floor(pixels.length / 4);
  if (count === 0) return { pixels: 0, mean: 0, max: 0, coveragePct: 0 };

  let sum = 0;
  let max = 0;
  let covered = 0;

  for (let i = 0; i < count; i++) {
    const value = pixels[i * 4] * 256 + pixels[i * 4 + 1];
    sum += value;
    if (value > max) max = value;
    if (value > 0) covered++;
  }

  return {
    pixels: count,
    mean: sum / count,
    max,
    coveragePct: (covered / count) * 100,
  };
}
```

Bayt tam olarak geri gelsin diye `gl.disable(gl.DITHER)` gerekiyor; dithering açıkken sürücü o baytı bir tık oynatma hakkını saklı tutuyor ve 16 bitlik kodlamada bu 256'lık hatalara dönüşüyor.

Sabit bütçeyle (16×8) beş irtifada ölçüm:

| İrtifa | Atmosfer kaplaması | Ortalama örnek/piksel | Medyan GPU ms |
|---|---|---|---|
| 20.000 km | %19,66 | 28,3 | 0,87 |
| 1.000 km | %45,13 | 65,0 | 1,45 |
| 100 km | %100 | 144 | 2,35 |
| 10 km | %100 | 144 | 2,39 |
| 2 km | %100 | 144 | 2,43 |

Ortalama örnek sütunu GPU ms sütununu açıklıyor. İkisi arasındaki ilişki mükemmel bir doğru olmayacak, çünkü erken çıkan pikseller bile bir ışın-küre kesişimi ödüyor ve dallanma GPU'da warp seviyesinde çalışıyor: aynı 32'lik grubun içinde bir piksel atmosfere değiyorsa, komşuları erken çıksa bile o grup döngüyü sonuna kadar sürüyor.

### Dört Kelepçe

Piksel başına 544 üstel. Bu shader'ı tam çözünürlükte, tam ekranda koşturursanız demo çalışır; okurun makinesi de size cevabını fanla verir.

O yüzden dört kelepçe var. Birincisi `devicePixelRatio`: `dpr = 3` olan bir ekranda arka tampon dokuz kat piksel demek; burada dokuz kat piksel, dokuz kat integral. İkincisi çözünürlük ölçekleyici, varsayılanı 0,5. Üçüncüsü toplam piksel bütçesi; geniş bir monitörde ilk ikisi tek başına yetmiyor.

```ts
// src/viewport.ts
export const MAX_DPR = 2;
export const MAX_PIXELS = 1_400_000;

export function backingSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  scale: number,
) {
  const clampedDpr = Math.min(Math.max(dpr, 1), MAX_DPR);
  const clampedScale = Math.min(Math.max(scale, 0.25), 1);
  const width = Math.max(1, Math.round(cssWidth * clampedDpr * clampedScale));
  const height = Math.max(1, Math.round(cssHeight * clampedDpr * clampedScale));
  return fitPixelBudget(width, height);
}

// En-boy oranını koruyarak toplam piksel sayısını bütçenin altına indirir.
export function fitPixelBudget(
  width: number,
  height: number,
  budget = MAX_PIXELS,
) {
  const total = width * height;
  if (total <= budget) return { width, height };
  const factor = Math.sqrt(budget / total);
  return {
    width: Math.max(1, Math.floor(width * factor)),
    height: Math.max(1, Math.floor(height * factor)),
  };
}
```

Dördüncüsü döngüde duruyor: bir "Dur/Devam" düğmesi ve sekme arkaya geçtiğinde kendiliğinden duraklatma. Gizli sekmede tarayıcı `requestAnimationFrame`'i saniyede bire kadar indiriyor, ama indirmek kapatmak değil; arkada hâlâ bir gezegen render ediliyor.

```ts
// src/main.ts (parça)
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
  toggleButton.textContent = running ? "Dur" : "Devam";
  if (running) {
    frameId = requestAnimationFrame(loop);
  } else {
    hud.setNote("Döngü duraklatıldı — sayaçlar donduruldu.");
    cancelAnimationFrame(frameId);
  }
}

toggleButton.addEventListener("click", () => setRunning(!running));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setRunning(false);
});
```

Varsayılan bütçe de mütevazı: 16 görüş, 8 ışık örneği. Canvas tam ekran değil, 960 piksel genişliğinde 16:9 bir kutu. 32×16'yı isteyen seçer, ama ilk açılışta kimse fırının içine düşmez.

### Sayı: 8×4'e Karşı 32×16

Yukarıda bıraktığım soruyu geri alalım: örnek sayısı 13,6 kat arttığında GPU zamanı da 13,6 kat artıyor mu, artmıyorsa fark nereye gidiyor?

Bu soruya CPU'dan cevap veremezsiniz. `drawArrays`'i `performance.now()` ile sarmak sürücüye komut yazma süresini ölçer, o komutun çalışma süresini değil; ikisi arasında birkaç kare olabilir. Saat GPU'nun içinde: `EXT_disjoint_timer_query_webgl2`.

```ts
// src/timer.ts
interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  readonly available: boolean;
  readonly samplesMs: number[] = [];

  private readonly ext: TimerExtension | null;
  private readonly pending: WebGLQuery[] = [];
  private readonly free: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension(
      "EXT_disjoint_timer_query_webgl2",
    ) as TimerExtension | null;
    this.available = this.ext !== null;
  }

  begin(): void {
    if (!this.ext || this.active) return;
    const query = this.free.pop() ?? this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.active = query;
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  // Her karede çağrılır. Sonuçlar birkaç kare gecikmeyle gelir; beklemek YASAK.
  poll(): void {
    if (!this.ext) return;
    const { gl } = this;

    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      // GPU saati kesildi (güç durumu değişimi, bağlam anahtarlama):
      // eldeki bütün ölçümler çöp.
      for (const query of this.pending) this.free.push(query);
      this.pending.length = 0;
      return;
    }

    while (this.pending.length > 0) {
      const query = this.pending[0];
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
      this.samplesMs.push(ns / 1e6);
      this.free.push(query);
      this.pending.shift();
    }
  }
}
```

Aynı anda tek sorgu açık olabilir, sonuç birkaç kare sonra gelir ve `GPU_DISJOINT_EXT` yandığında o penceredeki bütün örnekler geçersizdir. Uzantı bulunamazsa sütunun adını değiştiriyoruz; GPU ms yazan bir sütuna kare süresi koymak ölçmemekten kötü.

Bir uyarı daha: bazı sürücülerde sorgu sonuçları kuantize geliyor. Örnekleriniz `65,5 µs`'in katlarına oturuyorsa ondalık hanelere anlam yüklemeyin; ölçtüğünüz şey sürücünün zamanlayıcı çözünürlüğü olabilir. Bu yüzden hem medyanı hem p95'i raporluyoruz ve ham örnek listesini repoda bırakıyoruz.

Görsel farkı da sayıya çevirmek istiyorum, çünkü "az örnekle de fena görünmüyor" bir ölçüm değil. Referans olarak 64×32 bütçesinde bir kare çekiyoruz, sonra her bütçeyi aynı pozda çekip piksel piksel farkın karekök ortalamasını alıyoruz:

```ts
// src/stats.ts (parça)
// İki RGBA8 tamponu arasında kanal başına RMS farkı (0-255 ölçeğinde).
export function rmsDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error("tampon boyutları eşit değil");
  const pixels = Math.floor(a.length / 4);
  let sum = 0;
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      const d = a[i * 4 + c] - b[i * 4 + c];
      sum += d * d;
    }
  }
  return Math.sqrt(sum / (pixels * 3));
}
```

Ölçüm deterministik olmak zorunda, o yüzden `?measure=1` parametresi demonun oynak ne kadar tarafı varsa kapatıyor: arka tampon 960×540'a kilitleniyor, kamera ve güneş sabit bir poza oturuyor, animasyon duruyor, ilk kareler ısınma diye atılıyor.

Uzay pozunda (1.000 km irtifa, gezegenin kenarı kadrajda) tablo şöyle:

| Bütçe | Tavan örnek/piksel | Ölçülen ortalama/piksel | Medyan GPU ms | p95 GPU ms | RMS (64×32'ye göre) |
|---|---|---|---|---|---|
| 8×4 | 40 | 18,05 | 0,70 | 0,75 | 4,39 |
| 16×8 | 144 | 64,99 | 1,46 | 1,9 | 2,07 |
| 32×16 | 544 | 245,5 | 4,15 | 5,1 | 0,69 |

960×540 arka tamponda, Apple M2 Pro (ANGLE Metal) üzerinde, ısınma kareleri atıldıktan sonra 180 kare.

Örnek sayısı 13,6 katına çıkarken GPU zamanı 5,9 katına çıkıyor. Bu iki sayının birbirini tutmama sebebi, kare süresinin tamamının saçılım döngüsünden gelmemesi: ışın-küre kesişimleri, zemin gürültüsü, tonemap ve rasterleştirmenin kendisi bütçeden bağımsız sabit bir taban oluşturuyor.

RMS sütunu asıl merak edilen tarafı. Sekiz görüş örneği, iki bin kilometrelik bir yolu iki yüz kilometrelik dilimlere bölüyor ve ölçek yüksekliği 8 km olan bir yoğunluğu böyle örnekliyor; hatanın nereden geldiği belli. 4,39 değeri 255'lik ölçekte okunmalı.

Bir de şu var. `N·M` çarpımı sabit tutulup bölüşüm değiştirilirse ne oluyor? Üç yapılandırma da 64 iç örnek alıyor ama toplam değerlendirme sayıları farklı, çünkü görüş döngüsünün kendi yoğunluk hesabı `+N` olarak ekleniyor:

| Bölüşüm | N·M | Toplam değerlendirme | GPU ms (uzay) | RMS (uzay) | GPU ms (yer) | RMS (yer) |
|---|---|---|---|---|---|---|
| 32×2 | 64 | 96 | 1,17 | 2,32 | 2,41 | 20,27 |
| 16×4 | 64 | 80 | 1,07 | 1,78 | 1,62 | 11,56 |
| 8×8 | 64 | 72 | 0,91 | 4,83 | 1,37 | 28,01 |

İki poz da tabloda, çünkü kazananın poza göre değişmesini bekliyordum: uzaydan bakarken görüş ışını uzun ve yoğunluk profili boyunca hızlı değişiyor, `N`'in payı yüksek olur sanıyordum; yerden bakarken görüş ışını atmosferin dibinde kalıyor ve asıl değişken güneşe giden yol, `M` öne çıkar diye düşünmüştüm. Tablo bu beklentiyi yanlışlıyor: kazanan pozla değişmiyor. Dengeli bölüşüm 16×4, hem uzayda hem yerde en düşük RMS'i veriyor; 8×8 ikisinde de en ucuzu ama RMS'i en kötüsü. Bütçenizi nereye harcayacağınız sorusunun cevabı, en azından bu sahne için: eşit örnek toplamını uçlara yığmayın.

Derleme tarafı da ölçülüyor, çünkü `#define`'lı iç içe döngünün bedeli çalışma zamanında değil derleme zamanında ödeniyor:

| Bütçe | Derleme + link (ms) | İlk kare (ms) |
|---|---|---|
| 8×4 | 3,8 | 5,2 |
| 32×16 | 5,6 | 5,4 |

Bu iki sayıyı temkinli okuyun. Sürücüler `linkProgram`'ın işini ertelemekte serbest; JS'ten görünen süre işin tamamı olmayabilir, o yüzden ilk kareyi ayrı sütun yaptık. Ayrıca her yapılandırmanın soğuk derlemesi sayfa başına tek gözlem: sürücü kendi program önbelleğini profiller arasında saklıyor ve aynı sayıyı iki kez almanın kolay bir yolu yok. Bu sütuna eğilim olarak bakın, ölçüm olarak değil.

Son olarak gün batımı. Kızarmanın gerçekten çıktığını gözle onaylamak yeterli değil; ufkun iki derece üstündeki gökyüzü bloğunun ortalama rengini okuyup kırmızı/mavi oranını raporluyoruz:

| Güneş yüksekliği | Ufuk üstü R/B oranı |
|---|---|
| +30° | 1,141 |
| +10° | 1,240 |
| 0° | 5,113 |
| −2° | 6,725 |

Bu oranın monoton artması, `exp(-β·τ)` denkleminin ekrandaki imzası. Artmıyorsa ya katsayılar ya ölçek yükseklikleri yanlış girilmiş demektir.

### Fiziği Tarayıcı Açmadan Sınamak

Saçılım matematiğinin neredeyse tamamı GPU'ya hiç ihtiyaç duymuyor: bir avuç fonksiyon, girdi ver çıktı al. Testlerin tamamı da o yüzden düz Node'da koşuyor.

Işın-küre kesişimini bilinen değerlere çiviliyoruz:

```ts
// test/geometry.test.ts (parça)
import { describe, expect, it } from "vitest";
import { raySphere, raySphereFromHeight } from "../src/geometry";

describe("raySphere", () => {
  it("merkeze doğru gelen ışın yarıçap kadar önce girer", () => {
    const hit = raySphere([0, 0, -10], [0, 0, 1], 4);
    expect(hit[0]).toBeCloseTo(6, 10);
    expect(hit[1]).toBeCloseTo(14, 10);
  });

  it("teğet ışın tek noktada değer", () => {
    const hit = raySphere([0, 4, -10], [0, 0, 1], 4);
    expect(hit[1] - hit[0]).toBeCloseTo(0, 6);
  });

  it("ıskalayan ışında giriş çıkıştan büyük döner", () => {
    const hit = raySphere([0, 9, -10], [0, 0, 1], 4);
    expect(hit[0]).toBeGreaterThan(hit[1]);
  });

  it("kürenin içindeki nokta için giriş negatiftir", () => {
    const hit = raySphere([0, 0, 0], [0, 0, 1], 4);
    expect(hit[0]).toBeLessThan(0);
    expect(hit[1]).toBeCloseTo(4, 10);
  });
});

describe("raySphereFromHeight", () => {
  it("irtifadan kurulan c terimi sade biçimle aynı sonucu verir (double)", () => {
    const R = 6371;
    const h = 2;
    const ro: [number, number, number] = [0, R + h, 0];
    const rd: [number, number, number] = [0.9997, -0.0251, 0];
    const a = raySphere(ro, rd, R);
    const b = raySphereFromHeight(ro, rd, R, h);
    expect(b[0]).toBeCloseTo(a[0], 6);
  });
});
```

Sondaki test önemli görünmeyebilir ama iki uygulamanın matematiksel olarak aynı şeyi hesapladığını sabitliyor. Farkın float32'de ortaya çıktığını gösteren test ayrı:

```ts
// test/precision.test.ts (parça)
import { describe, expect, it } from "vitest";
import { horizonSweep } from "../src/precision";

describe("ufuk hassasiyeti", () => {
  it("irtifadan kurulan biçim sade biçimden daha az sapar", () => {
    // 2 km irtifada, ufkun ±0.3 derece çevresinde 400 yön tara.
    const sweep = horizonSweep({ altitudeKm: 2, spanDeg: 0.3, samples: 400 });
    expect(sweep.stableMaxErrKm).toBeLessThan(sweep.naiveMaxErrKm);
    expect(sweep.stableMaxErrKm).toBeLessThan(0.05); // 50 metre
  });
});
```

Faz fonksiyonlarının normalizasyonu:

```ts
// test/phase.test.ts (parça)
import { describe, expect, it } from "vitest";
import { integrateOverSphere, phaseMie, phaseRayleigh } from "../src/phase";

describe("faz fonksiyonları", () => {
  it("Rayleigh küre üzerinde 1'e integre olur", () => {
    expect(integrateOverSphere(phaseRayleigh, 200_000)).toBeCloseTo(1, 5);
  });

  it("Henyey-Greenstein g = 0.76 için küre üzerinde 1'e integre olur", () => {
    expect(
      integrateOverSphere((mu) => phaseMie(mu, 0.76), 200_000),
    ).toBeCloseTo(1, 3);
  });

  it("g = 0 izotropiktir: her açıda 1/4pi", () => {
    for (const mu of [-1, -0.4, 0, 0.4, 1]) {
      expect(phaseMie(mu, 0)).toBeCloseTo(1 / (4 * Math.PI), 12);
    }
  });

  it("g > 0 ileri saçılmayı geri saçılmadan büyük yapar", () => {
    expect(phaseMie(1, 0.76)).toBeGreaterThan(phaseMie(-1, 0.76));
  });

  it("Rayleigh mu işaretine göre simetriktir", () => {
    expect(phaseRayleigh(0.7)).toBeCloseTo(phaseRayleigh(-0.7), 12);
  });
});
```

Optik derinlik ve geçirgenlik tarafında çivilenecek dört davranış var:

```ts
// test/scattering.test.ts (parça)
import { describe, expect, it } from "vitest";
import { BETA_RAYLEIGH, H_RAYLEIGH } from "../src/constants";
import { densityAt, opticalDepth, transmittance } from "../src/scattering";

describe("yoğunluk ve optik derinlik", () => {
  it("yoğunluk irtifayla monoton azalır", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let h = 0; h <= 100; h += 2) {
      const rho = densityAt(h).rayleigh;
      expect(rho).toBeLessThan(previous);
      previous = rho;
    }
  });

  it("ölçek yüksekliğinde yoğunluk tam olarak 1/e'ye iner", () => {
    expect(densityAt(H_RAYLEIGH).rayleigh).toBeCloseTo(Math.E ** -1, 12);
  });

  it("optik derinlik yön değiştirince aynı kalır", () => {
    const a = opticalDepth([0, 6373, 0], [0, 6420, 0], 64);
    const b = opticalDepth([0, 6420, 0], [0, 6373, 0], 64);
    expect(a.rayleigh).toBeCloseTo(b.rayleigh, 9);
  });

  it("geçirgenlik (0, 1] aralığında ve tau ile monoton azalır", () => {
    let previous = 1.0000001;
    for (let tau = 0; tau <= 50; tau += 1) {
      const t = transmittance(tau, BETA_RAYLEIGH[2]);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(previous);
      previous = t;
    }
  });
});

describe("gün batımı", () => {
  it("mavi kırmızıdan daha hızlı tükenir ve fark yolla açılır", () => {
    const short = 1.0;
    const long = 12.0;
    const ratioShort =
      transmittance(short, BETA_RAYLEIGH[0]) /
      transmittance(short, BETA_RAYLEIGH[2]);
    const ratioLong =
      transmittance(long, BETA_RAYLEIGH[0]) /
      transmittance(long, BETA_RAYLEIGH[2]);
    expect(ratioShort).toBeGreaterThan(1);
    expect(ratioLong).toBeGreaterThan(ratioShort);
  });

  it("katsayılar dalga boyunun -4. kuvvetini takip eder", () => {
    const lambda = [680, 550, 440];
    for (let i = 1; i < 3; i++) {
      const expected = (lambda[0] / lambda[i]) ** 4;
      const actual = BETA_RAYLEIGH[i] / BETA_RAYLEIGH[0];
      expect(actual / expected).toBeCloseTo(1, 2); // %1 tolerans
    }
  });
});
```

Son test yazının fizik iddiasını doğrudan sınıyor. Katsayı setini bir yerden kopyalayıp yapıştırdıysanız ve biri yanlış girildiyse, ekranda "biraz mor bir gökyüzü" olarak görünür ve haftalarca fark etmezsiniz. Burada bir satır kırmızı yanıyor.

Geri kalanlar daha sıkıcı ama gerekli: kamera bazının ortonormal olduğu, `|position|` değerinin `R + irtifa` çıktığı, `buildFragmentSource`'un `#version` satırını yerinde bıraktığı, `backingSize` kelepçeleri, `median`/`percentile` kenar durumları, 16 bitlik örnek sayacının kodlama-çözme turu. Hiçbir test dosyası `document`, `WebGL2RenderingContext` ya da `performance` referansı içermiyor.

Bu testlerin hiçbiri gökyüzünün gökyüzü gibi göründüğünü kanıtlamıyor. Onun için tarayıcıda açıp güneşi ufka indirmek gerekiyor.

### Özetle:

1. Küre için ışın yürütmeyin. Işın-küre kesişiminin kapalı formu bir iç çarpım ve bir karekök; gezegen ve atmosfer kabuğu için ikisi de analitik.
2. `dot(ro, ro) - r * r` ifadesi kamera yüzeye yaklaştığında katastrofik iptale girer. `h * (h + 2r)` biçimine geçin ve `h`'yi konumdan geri hesaplamayın; CPU'da double duyarlıkla hesaplayıp uniform olarak taşıyın.
3. Hassasiyet hatası ufukta patlar, çünkü teğet durumda `disc` sıfıra iner ve karekökün türevi orada büyür. Aynı hata zenit yönünde görünmez.
4. Yoğunluk üsteldir: `exp(-h / H)`. Hava için `H = 8 km`, aerosoller için `1,2 km`. İki profili tek `vec2` içinde yan yana taşıyın, bütün integral boyunca birlikte gidiyorlar.
5. Beer-Lambert `T = exp(-β·τ)`. `τ = 0` iken `T = 1`, `τ` arttıkça monoton azalır, asla sıfırın altına inmez.
6. Rayleigh katsayıları dalga boyunun dördüncü kuvvetiyle ters orantılıdır: `33,1 / 5,802 = 5,705` ve `(680/440)⁴ = 5,704`. Bu eşitliği bir teste çevirin; yanlış girilmiş bir katsayı ekranda hata gibi görünmez.
7. Gün batımı ayrı bir kod yolu değil. Aynı denklemde yol uzayınca mavinin geçirgenliği kırmızınınkinden üstel olarak hızlı düşüyor, geriye kırmızı kalıyor.
8. Faz fonksiyonlarının küre üzerindeki integrali 1 olmak zorundadır. Rayleigh `3/(16π)(1+μ²)`, Mie ise Henyey-Greenstein; `g = 0`'da ikincisi tam olarak `1/4π` verir.
9. `pow(x, 1.5)` yerine `x * sqrt(x)` yazın ve `sqrt`'e sıfır koruması koyun; `g` bire yaklaştığında payda sıfıra iner.
10. Güneş diskini kosinüs eşiğiyle test etmeyin. `cos(0,266°) = 0,9999892` float32'de kaba bir sayıdır; `length(rd - sunDir)` küçük açılarda doğrudan radyan verir ve kararlıdır.
11. Havadan perspektif ayrı bir sis geçişi değil: zemin radyansını görüş yolunun geçirgenliğiyle çarpıp üstüne aynı integralin saçılımını eklemekten ibaret.
12. Maliyet yol uzunluğuna değil, döngü sayısına bağlı. `VIEW_SAMPLES` sabit olduğu için gezegenin kenarını yalayan uzun limb ışını ile kısa zenit ışını aynı sayıda örnek alıyor; irtifayla değişen şey kaç pikselin çalıştığı.
13. Örnek sayısı tavanı `N + N·M`, zemine çarpan piksellerde `+M`. Aynı `N·M` çarpımının farklı bölüşümleri farklı toplam maliyet ve farklı hata veriyor; hangisinin kazandığı kamera pozuna bağlı.
14. `VIEW_SAMPLES` ve `LIGHT_SAMPLES` uniform değil `#define` olmalı, yoksa derleyici döngüyü açamaz ve karşılaştırma adil olmaz. Bedeli derleme zamanında: 32×16 bütçesinde açılan gövde 512 kopya.
15. Eşit aralıklı görüş örneklemesi limb görüşünde zayıftır: 2.000 km'lik yolu 8 dilime bölerken ölçek yüksekliği 8 km. RMS sütununun büyük çıktığı yer burası; doğru çözüm önem örneklemesi ya da önceden hesaplanmış geçirgenlik tablosu.

Depoda iki komut var. `npm test` yukarıdaki fiziği tarayıcı açmadan sınıyor, `npm run dev` demoyu getiriyor. Adrese `?measure=1` eklerseniz sayfa etkileşimi kapatıp sabit poz dizisini koşuyor ve sonucu konsola tek satırlık JSON olarak yazıyor; bu yazıdaki bütün tablolar o satırdan çıktı — dört koşunun medyanı, ham kayıt depoda (`measurements-2026-08-12.jsonl`). Sayılar benim masamdaki GPU'ya ait, sizinki başka rakamlar verecek; kıyaslamaya değer olan milisaniyenin kendisi değil, iki bütçe arasındaki açıklık.

Kodda "sunset" diye bir kelime aradım, geçmiyor. "Turuncu" da geçmiyor, "kızıl" da. Geçen şey iki katsayı vektörü ve bir yol uzunluğu.

Gökyüzü hâlâ tam doğru değil. Ozon katmanı yok, çoklu saçılma yok; güneş ufkun altına indiğinde göğün tepesinde kalması gereken o derin mavi bende kalmıyor, griye düşüyor. Bunu tabloya yazmadım çünkü ölçmedim, sadece gördüm.

Yine de bir şey oldu. Ufka indirdiğim şey bir sayıydı, `sunElevDeg`. Ekranda kızaran şey `exp(-β·τ)`. Arada sanat yönü adına verilmiş tek bir karar yok: gün batımını ben tarif etmedim, sadece hangi mekanizmanın çalışacağını yazdım. Kızarmayı o kendi başına yaptı. 🌅
