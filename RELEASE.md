# Yayın sırası

Bu dosya, bir sürümü yayınlarken izlenecek sırayı tutar. Sıranın kendisi
kuralın parçasıdır: **Firestore kuralları, sayaçlı build herkese yayılmadan
deploy edilmez.** Gerekçesi en altta.

## Çalışma akışı — `main` korumalı

Tek yol budur, istisnasız:

```
dal aç → commit → push → PR → üç check yeşil → dalı güncelle → merge
```

- **`main`'e doğrudan push reddedilir.** Yayın hazırlığı da dahil her
  değişiklik — tek satırlık bir doküman düzeltmesi bile — dal ve PR üzerinden
  gider.
- Birleşmeden önce üç kontrolün geçmesi şart: **`Type check, lint and test`**,
  **`Firestore rules (emulator)`**, **`Android module unit tests`**. İsimler
  `.github/workflows/ci.yml` içindeki job adlarıdır; bir job'ın adı
  değişirse koruma onu artık göremez ve kural sessizce boşa düşer — job adı
  değiştirmek, GitHub panelinden kural güncellemeyi de gerektirir.
- **Dal güncel olmak zorunda** (strict): `main` ilerlediyse PR'ı rebase/merge
  ile güncellemeden birleştirilemez. Checkler bu sayede birleşecek kodun
  kendisinde koşar, yalnız yazıldığı andaki halinde değil.
- **Bypass yok.** Kural repo sahibine de uygulanır. Acil durumda tek yol
  GitHub panelinden kuralı geçici gevşetmektir; bu bilinçli bir karardır ve
  o an not edilmelidir.
- `main` dalının silinmesi de kural tarafından engellenir.

## 1. Doğrulama

```
npx tsc --noEmit
npx expo lint
npx jest --ci
npx expo-doctor
```

`expo-doctor` ağa bakar (sürüm uyumu); CI'da değil burada koşmasının nedeni
bu — yayın anında bir kez, taze bilgiyle.

Dördü de temiz olmadan devam edilmez. `main` üzerindeki CI'ın da yeşil
olduğunu kontrol et — yerel doğrulama CI'ın yerine geçmez, yanında durur.
(Koruma sayesinde `main`'de kırmızı CI zaten olağandışıdır: her şey yeşil
check'lerle birleşmiştir. Yine de bakılır — bir bağımlılık güncellemesi ya da
dış servis, birleşmeden sonra da bir şeyi bozabilir.)

Yayından önce E2E smoke akışını da elle tetikle ve yeşilini bekle:
GitHub → Actions → "E2E smoke" → Run workflow. (Her gece kendiliğinden de
koşar; yayın günü taze bir koşu istemek ucuzdur.)

Üç akış koşar — `smoke` (onboarding → regl kaydı → her sekme), `app-lock`
(PIN kur → soğuk açılış → PIN ile gir) ve `language` (İngilizceye geç, arayüz
takip ediyor mu). Bunlar birim testlerinin göremediği yeri tutar; ama
**görmedikleri üç şey kalıyor** ve onlar elle bakılır:

- **Ana ekran widget'ı.** Maestro bir widget'ı launcher'a ekleyemez. Kartın
  günü, fazı ve destek cümlesi artık snapshot'ta taşınıyor ve `language`
  akışının okuduğunu kanıtladığı kataloglardan üretiliyor — ama kartın kendisi
  ancak cihazda görülür. Uygulamayı İngilizceye al, widget'ı ekle, **tamamının**
  İngilizce olduğunu gör.
- **Ekran gizliliği.** Kilit açıkken uygulamanın görev değiştiricide (task
  switcher) önizlemesinin boş olması. Hiçbir otomatik testle sınanamaz: PIN kur,
  uygulamayı arka plana al, kare düğmesine bas, önizlemenin boş olduğunu gör.
- **Kayıtlarının özeti ekranındaki çubuklar.** Geçmiş sekmesi → "Dökümü gör".
  `phase-palette-distinctness.test.ts` dört faz renginin hue mesafesini ölçüyor
  ve en yakın çifti 89'da tutuyor. Ama bir ölçüm, dört tonun **belirli bir okur
  için** dört renk olduğunu söyleyemez — ve parlaklık payı zaten ince: en yakın
  çiftin kontrast oranı 1.17, yani ayrım neredeyse tamamen tondan geliyor.
  Çubukların yanındaki sayılar bu yüzden var ve onlar test ediliyor; renklerin
  kendisi göz istiyor. Açık ve koyu temada ayrı ayrı bak, dört dilimin
  birbirinden ayırt edilebildiğini gör.

## 2. AAB üretimi

```
eas build --platform android --profile production
```

`versionCode` uzaktan ve otomatik sayılır (`appVersionSource: remote` +
`autoIncrement`); elle sürüm numarası verilmez. Görünen sürüm (`version`)
değişecekse `app.json` içinde bu adımdan ÖNCE güncellenir ve commit edilir.

## 3. Play Console'a yükleme ve yayılım

AAB'yi Play Console'a yükle, kademeli yayılımı başlat ve **%100'e ulaşmasını
bekle.** Yayılım bitmeden 4. adıma geçilmez.

## 4. Firestore kurallarının deploy'u — yalnız yayılım bittikten sonra

```
npm run rules:deploy
```

### ⚠️ İlk sürümde bu sıra TERSİNE çevrilir

Aşağıdaki "Sıra neden bu?" bölümünün gerekçesinin tamamı **sahada eski bir
build olmasına** dayanır: sayaçtan önceki build "Yedek oluştur" ile sayaçsız
zarf yazar, yeni kurallar onu reddeder, dolayısıyla kurallar herkes güncel
build'i alana kadar bekler.

**İlk sürümde sahada hiçbir build yoktur**, yani reddedilecek kimse de yoktur.
O gerekçe geçersizdir ve sırayı olduğu gibi uygulamak tersine çevrilmiş bir
risk doğurur: ilk kullanıcıların yedeği ve sync'i, kurallar deploy edilene
kadar projede **o an canlı olan** kurallara çarpar — ki bu, repo'daki
`firestore.rules` olmak zorunda değildir.

Bu yüzden ilk sürümde:

```
1. npm run rules:deploy        ← AAB üretmeden ÖNCE
2. eas build --profile production
3. Play Console'a yükle, yayılımı başlat
```

Ve deploy'dan önce kuralların gerçekten yerine geçtiği doğrulanır — en kolayı
`npm run test:rules` ile emülatörde kanıtlamak, ardından Firebase Console →
Firestore → Rules ekranında canlı metnin `firestore.rules` ile aynı olduğunu
görmek.

Yukarıdaki 4-adımlı sıra **ikinci sürümden itibaren** geçerlidir; o noktadan
sonra sahada eski build vardır ve gerekçe yeniden doğrudur.

## Sıra neden bu?

Kurallar her yazmada sayılmış bir zarf ister: `{version, revision,
contentHash, payload}` ve `revision == stored + 1`. Sayaçtan önceki build'ler
"Yedek oluştur" ile `{version, payload, updatedAt}` yazar — kurallar bunu
reddeder. Yani:

- **Kurallar erken deploy edilirse:** eski build kullanan herkesin manuel
  yedeği, uygulama güncellenene kadar sessizce reddedilir.
- **Doğru sırada:** önce herkes sayaçlı build'i alır, sonra kurallar o
  build'in zaten verdiği sözü sunucuda zorunlu kılar.

Deploy sonrası beklenen davranış: güncel build'de yedek/sync aynen çalışır;
hâlâ eski build'de kalan biri "Yedek oluştur" dediğinde yazma reddedilir ve
uygulama bunu genel yedek hatası olarak gösterir. Bu bilinen ve kabul edilmiş
maliyettir — pencereyi küçük tutmak için deploy, yayılımın hemen ardından
yapılır, haftalar sonra değil.

## Kurulum (bir kez, panelden)

### EXPO_TOKEN (Release build workflow'u için)

1. https://expo.dev/settings/access-tokens → **Create token** (adı örn.
   `github-actions`, proje erişimi yeterli).
2. GitHub'da repo → **Settings → Secrets and variables → Actions →
   New repository secret** → Name: `EXPO_TOKEN`, Value: kopyaladığın token.
3. Deneme: **Actions → Release build → Run workflow**. İş bir dakikada
   "Queue the build" adımını geçip EAS kuyruğunun linkini yazmalı. Token
   yoksa iş ilk adımda açık bir mesajla durur.

Bundan sonra `v` ile başlayan bir tag push'u (örn. `v1.1.0`) production AAB
build'ini kendiliğinden kuyruğa koyar.

### main koruması — kuruldu

16 Ekim 2026'da `main-protection` adlı ruleset ile açıldı: PR zorunlu (onay
sayısı 0 — tek geliştiricide amaç inceleme değil, CI kapısı), üç check
zorunlu, dal güncel olmak zorunda, bypass listesi boş, dal silme kapalı.
Günlük anlamı yukarıdaki "Çalışma akışı" bölümünde.

Ayarı görmek ya da değiştirmek için: Repo → **Settings → Rules → Rulesets →
`main-protection`**.

## Notlar

- Kural dosyası: `firestore.rules` (rollout notu dosyanın kendi yorumunda da
  durur). Deploy komutu `firebase.json` üzerinden aynı dosyayı okur.
- Kuralların metni `src/features/sync/__tests__/firestore-rules.test.ts`
  ile pinlenir; davranışı `rules-test/` altındaki emülatör testleriyle
  kanıtlanır (`npm run test:rules`, CI'da her push'ta koşar).
