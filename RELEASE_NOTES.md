# Sürüm notları / Release notes

Kapalı teste giren yapı için. Her sürümde en üste yeni bir bölüm eklenir; eski
bölümler değiştirilmez.

Google Play'in "Yenilikler" alanına yapıştırılacak metin her bölümün başındaki
iki kısa paragraftır — altındaki "Bilinen sınırlar" listesi test edenlere ayrıca
iletilir, çünkü mağaza alanına sığmaz ve orada da yeri yoktur.

---

## 1.0.0 (versionCode 1) — kapalı test / closed test

### Türkçe

**Uygulama ne yapıyor.** Regl döngünü ve gebeliğini telefonunda takip eder.
Kayıtlarını girersin, uygulama sonraki reglini tahmin eder, döngü gününü ve
evresini gösterir; istersen bir gün önceden hatırlatır. Gebelik takibi açıkken
haftalık bilgilendirme verir. Verilerin varsayılan olarak yalnızca telefonunda
durur; hesap açmak ve yedeklemek isteğe bağlıdır.

**Bu yapıda ne değişti.** İlk kapalı test yapısı. Önceki iç yapılardan bu yana:
tahminin ne zaman biteceği netleşti — beklenen gün geçtiğinde uygulama artık
evre ya da doğurganlık tahmini uydurmuyor, gün saymaya devam ediyor ve tahmin
etmediği şeyi söylemiyor. Hatırlatıcı açıkken telefonun bildirim izni yoksa ya
da ilgili bildirim kanalı kapalıysa ekran bunu artık söylüyor ve izni oradan
isteyebiliyorsun. Takvim, ana ekran ve ayarlar metinleri büyük yazı tipi
ayarlarında taşmayacak şekilde düzeltildi. Gizlilik ve veri silme sayfaları
günlük kayıtları da sayar hâle getirildi.

**Bilinen sınırlar — bunları hata olarak bildirmeye gerek yok:**

- **Hesap açma ve senkronizasyon, yapının Firebase ayarlarıyla üretilmiş
  olmasına bağlı.** Bu ayarlar koda gömülü değil; derleme sırasında ortam
  değişkenlerinden okunur. Ayarlar yoksa uygulama çökmüyor: hesap bölümü
  "yapılandırılmamış" durumda görünür ve uygulamanın geri kalanı hesapsız
  çalışmaya devam eder. Yani hesap bölümünü kapalı görürsen bu bir hata değil,
  o yapının bir özelliği — bildirmeye gerek yok. Giriş yapıp da bir hata
  alırsan, o bildirilmeye değer.
- **"Çakışmayı çöz" ekranı hiç denenmedi.** İki cihazın aynı kaydı farklı
  değiştirmesi gerekiyor; tek cihazla ve senkronizasyon kapalıyken o ekrana
  ulaşmanın bir yolu yok. Yazıldı, test edildi, ama bir insanın karşısına hiç
  çıkmadı. Bir şekilde görürsen ekran görüntüsü çok işimize yarar.
- **Hatırlatıcı nadiren sessizce kaybolabilir.** Hatırlatıcı yeniden
  kurulurken kuyruk bir an boş kalıyor; uygulama tam o anda sistem tarafından
  kapatılırsa hatırlatıcı gider. Pencere çok kısa ve uygulamayı bir daha
  açtığında kendiliğinden düzeliyor — ama bir sonraki açılışa kadar düzelmiyor.
  Beklediğin bir hatırlatıcı gelmediyse ve arada uygulamayı kapattıysan, bu
  olabilir.
- Uygulama kilidi ekranı kapatır, telefondaki dosyaları şifrelemez.
- Android bildirim metnini kilit ekranında gösterir ve uygulama bunu
  gizleyemez; "Bildirimlerde ayrıntı gösterme" ayarı yalnızca metni
  sadeleştirir.

### English

**What the app does.** It tracks your cycle and your pregnancy on your phone.
You record what happened, it estimates when your next period is due, shows the
day of your cycle and its phase, and can remind you the day before. With
pregnancy tracking on it gives you a weekly note. Your data stays on your phone
by default; an account and a backup are optional.

**What changed in this build.** The first closed-test build. Since the earlier
internal builds: the app is now clear about where its estimate ends — once the
expected day has passed it no longer invents a phase or a fertility level, it
keeps counting the day and says nothing it cannot stand behind. If a reminder is
switched on while the phone has not granted notification permission, or while
that reminder's channel is switched off, the screen now says so and can ask for
permission from there. Calendar, home and settings text was fixed so it does not
overflow at large font settings. The privacy and data-deletion pages now count
daily records among the data they describe.

**Known limits — no need to report these:**

- **Signing in and syncing depend on the build having the Firebase
  settings.** They are not in the code; they are read from environment
  variables when the app is built. Without them the app does not crash: the
  account section shows as "not configured" and everything else carries on
  working without an account. So an account section that is switched off is a
  property of that build rather than a bug — no need to report it. Signing in
  and *then* getting an error is worth reporting.
- **The "Resolve conflict" screen has never been exercised.** Reaching it needs
  two devices changing the same record differently, and with one device and sync
  switched off there is no way in. It is written and tested, but no person has
  ever seen it. If you somehow do, a screenshot would be genuinely useful.
- **A reminder can rarely go missing, quietly.** While a reminder is being
  rebuilt the queue is empty for a moment, and if the system closes the app in
  exactly that moment the reminder is lost. The window is very short and
  opening the app again fixes it by itself — but nothing fixes it until then. If
  a reminder you expected did not arrive and you had closed the app in between,
  this may be why.
- The app lock closes the screen; it does not encrypt the files on your phone.
- Android shows notification text on the lock screen and the app cannot hide
  it. "Keep details out of notifications" only makes the wording plainer.
