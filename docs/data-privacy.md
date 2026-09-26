# Veri envanteri ve bulut sınırı

Bu uygulama bir sağlık uygulaması. Tuttuğu şey birinin regl geçmişi, gebeliği ve
kendi seçtiği görünüm. Bu belge hangi verinin nerede durduğunu ve ileride bir
senkronizasyon özelliği gelirse neyin çıkabileceğini, neyin çıkamayacağını yazar.

## Bugünkü durum

- **Sağlık verisi yalnızca senin kendi Firebase hesabına gidiyor.** Başka hiçbir
  yere gönderilmiyor. Gitmesinin iki yolu var: "Yedek oluştur" ya da "Şimdi
  senkronize et" düğmesine basmak; bir de "Otomatik senkronizasyon" açıksa
  aşağıdaki beş tetikleyici.
- **"Otomatik senkronizasyon" varsayılan olarak kapalı.** Kapalıyken hiçbir
  gönderim olmaz ve yalnızca o iki düğme çalışır. Açıldığında ne gönderildiği
  değişmez — taşınan şey yine envanterdeki beş kategoridir — değişen tek şey
  gönderimin ne zaman tetiklendiğidir: anahtarın açılması, oturum açılması,
  uygulamanın öne gelmesi, bir kaydın değişmesi ve uygulama arka plana alınırken
  bekleyen bir değişikliğin son kez gönderilmesi.
- **Uygulama kapalıyken hiçbir şey gönderilmez.** Arka plan görevi, periyodik iş
  ve zamanlanmış gönderim yok; her gönderim kişinin az önce yaptığı bir şeyin
  devamı. Ayrıntılar aşağıda "Otomatik senkronizasyon" bölümünde.
- **Senkronizasyon tercihi bu telefonda duruyor, hesapla taşınmıyor:** başka bir
  cihaza giriş yapmak orada senkronizasyonu açmaz.
- **Firebase Auth ve Firestore var; başka Firebase ürünü yok.** Hesap için Auth,
  yedek için Firestore. Storage, Messaging, Functions, Analytics ve Crashlytics
  yok — bağımlılık listesinde de yok, bir tarama testi her çalıştırmada
  doğruluyor.
- **Yedek yalnızca senin hesabının altında.** Doküman yolu
  `users/{uid}/backups/current`; yolda hesap kimliğinden başka hiçbir kullanıcı
  verisi yok ve tek doküman tutuluyor, yani yeni yedek eskisinin yerine geçer.
  Firestore Security Rules (`firestore.rules`) yalnızca `request.auth.uid == userId`
  olan isteğe izin veriyor, geri kalan her şey reddediliyor.
- **Uygulamanın kendi kodunda ağ çağrısı yok.** `fetch`, XHR, WebSocket
  kullanılmıyor; ağa çıkan tek şey Firebase Auth SDK'sının kendi istekleri. Tek
  diğer dış bağlantı, kullanıcı bir kaynak bağlantısına dokunduğunda telefonun
  tarayıcısını açmak (`Linking.openURL`) — oraya giden şey uygulamanın kendi
  gömülü kaynak adresi, kullanıcının verisi değil.
- **Firebase config kaynak koda gömülü değil.** `EXPO_PUBLIC_FIREBASE_*`
  environment variable'larından okunuyor.
- **Sağlık verisi cihazda.** Her şey uygulamanın kendi SQLite dosyasında
  (`regl-gebelik.db`) ve uygulamaya özel Android depolamasında duruyor.
- **Android'in otomatik yedeklemesi kapalı.** `android:allowBackup="false"`,
  artı `dataExtractionRules` ve `fullBackupContent` her şeyi hariç tutuyor.
  İki mekanizma birden gerekiyor: Google, Android 12+'da bazı üreticilerin
  cihazlarında `allowBackup="false"` ayarının bulut yedeğini kapattığını ama
  cihazdan cihaza aktarımı kapatmadığını belgeliyor. Böylece SQLite veritabanı,
  AsyncStorage satırı ve widget anlık görüntüsü Google Drive'a gitmiyor.
  Karşılığı: telefon değişince ya da uygulama silinip yeniden kurulunca veriler
  kendiliğinden geri gelmez; taşımanın tek yolu uygulamanın kendi hesap yedeği.
  Bkz. `plugins/with-backups-disabled.js`.
- **Loglar ham sağlık verisi içermez.** Konsola yalnızca kapalı bir listeden
  gelen genel olay adları yazılır (`[app] widget sync failed` gibi); tarih,
  kayıt, avatar ya da hata mesajı yazılmaz. Bkz. `src/shared/logging/`.

Yedek gönderildiğinde taşınan tek şey aşağıdaki "cloud adayı: evet" satırları ve
tek biçim `CloudSyncPayloadV1`:

1. `cycle-settings` — ortalama döngü ve regl süresi
2. `period-records` — regl kayıtları
3. `pregnancy-profile` — son regl tarihi, tahmini doğum tarihi ve kaynağı
4. `avatar-config` — avatar seçimleri
5. `notification-preferences` — iki hatırlatıcı anahtarı (bildirim metninin
   sadeleştirilip sadeleştirilmeyeceği buna dahil **değildir**; o cihazda kalır)
6. `daily-entries` — günlük kayıtlar: akış yoğunluğu, belirtiler, ruh hali

Bunlara ek olarak dokümanda yalnızca bir sürüm numarası ve sunucunun yazdığı
zaman damgası bulunur. **Widget snapshot'ı, loglar, bildirim kuyruğu, arayüz
durumu ve hesaplanan hiçbir veri (döngü günü, evre, doğurganlık, ruh hali,
takvim) yedekte yer almaz.**

Geri yükleme (restore), elle başlatılan senkronizasyon, kendiliğinden çalışan
senkronizasyon ve çakışmaları çözme ekranı var. Bir çakışma bulunduğunda
senkronizasyon durur ve iki taraftaki veriler olduğu gibi bırakılır; ne
yapılacağını kişi "Çakışmayı çöz" ekranında seçer.

## Kilit ekranındaki bildirim metni

Android, bir bildirimin başlığını ve gövdesini kilit ekranında gösterir ve bir
uygulamanın bunu kapatmasına **izin vermez**. Tam olarak bunu yapıyor görünen
seçenek (`NotificationChannel.lockscreenVisibility`) kabul edilir ve sessizce
atılır: kanalı oluşturan uygulamanın kendisi olduğunda platform, istenen değeri
paketin görünürlük ayarıyla değiştirir — o ayar kişinin kendisine aittir ve
varsayılanı "belirtilmemiş"tir.

Temiz bir kurulumda, cihaz PIN'i kurulu ve Android'in kilit ekranı ayarları
varsayılanken ölçüldü: kanal `mLockscreenVisibility=-1000` ile oluştu (yani
belirtilmemiş), aynı çağrıdaki ad, açıklama ve önem değerleri ise yerine
oturdu. Hatırlatıcı, kilitli ekrana başlığı ve gövdesiyle birlikte düştü.

Geriye kalan tek şey metnin kendisidir; `discreet-notifications` bunu seçer.
Açıkken iki hatırlatıcı da aynı nötr metni taşır ("Hatırlatıcı — Uygulamayı
açtığında hatırlatmanı görebilirsin."), regl, döngü ya da gebelikten söz etmez.
Kapalıyken bugünkü metinler aynen kalır. Uygulama kilidi kurulduğunda açılır,
kilit kaldırıldığında açık kalır. Bildirimin üzerindeki uygulama simgesi
değişmez: bu ayar cümleyi kaldırır, uygulamayı gizlemez.

Buna karşılık gelen kod ve testler
`src/features/notifications/infrastructure/period-reminder-scheduler.ts`
içindedir; ölçüm oraya da yazıldı, böylece seçeneği geri ekleyen biri neden
çalışmadığını orada görür.

## Silme

İki ayrı işlem var ve ikisi farklı şeyleri siliyor.

- **"Tüm verilerimi sil" (Ayarlar).** Bu telefondaki her şeyi siler: altı
  tablonun tamamı (`cycle_settings`, `period_records`, `pregnancy_profile`,
  `avatar_config`, `notification_preferences`, `sync_state`), zamanlanmış
  hatırlatıcılar, widget kopyası, senkronizasyon tercihleri, cihaz kimliği, son
  senkronizasyon zamanı ve çözülmemiş çakışma notu.
  Giriş yapılmışsa oturum da kapatılır ve uygulama onboarding'e döner.
  **Buluttaki yedeğe ve hesaba dokunmaz** — ekrandaki metin bunu açıkça söyler.
- **"Hesabı sil" (Hesap).** Firestore'daki yedeği (`users/{uid}/backups/current`)
  ve Firebase Auth hesabını kalıcı olarak siler. Bir onay kutusu bu cihazdaki
  kayıtların da silinmesini ister; varsayılanı kapalıdır. Kapalı bırakılırsa
  kayıtlar telefonda kalır ve uygulama hesapsız çalışmaya devam eder.

Sıra değişmez: **önce buluttaki veri, sonra hesap.** Hesap önce silinseydi,
yedek dokümanı Firestore'da erişilemez halde kalırdı — bu projedeki her kural
`request.auth.uid == userId` üzerine yazılı ve artık var olmayan bir uid hiçbir
kuralı karşılamaz.

Hesap silinsin ya da silinmesin, silme başarılı olduğunda `sync_state`,
`sync-preferences`, `sync-device-id`, `sync-last-synced-at` ve
`sync-unresolved-conflict` her durumda temizlenir: bunlar kayıt değil, artık
var olmayan bir hesaba ait defter kayıtlarıdır.

İki adım arasında yedek silinmiş ama hesap henüz silinmemişken
`pending-account-deletion` yazılır. O sırada senkronizasyon ve "Yedek oluştur"
reddedilir; yoksa silinen yedek tek dokunuşla geri yüklenirdi.

## Otomatik senkronizasyon

"Otomatik senkronizasyon" kapalıyken hiçbir gönderim olmaz. Açıldığında ne
gönderildiği değişmez — taşınan şey yine yalnızca envanterdeki beş kategoridir —
değişen tek şey gönderimin ne zaman tetiklendiğidir.

Tetikleyiciler yalnızca şunlardır: anahtarın açılması, oturum açılması,
uygulamanın öne gelmesi, bir kaydın değişmesi ve uygulama arka plana alınırken
bekleyen bir değişikliğin son kez gönderilmesi. Hiçbiri uygulama kapalıyken
çalışmaz: arka plan görevi, periyodik iş ve zamanlanmış gönderim yoktur. Aynı
anda birden fazla senkronizasyon çalışmaz; ayrıca öne gelme için beş dakika,
kayıt değişikliği için iki dakika alt sınırı vardır ve bir değişiklik otuz
saniye beklemeden gönderilmez.

Otomatik senkronizasyon bir çakışmayı kendi başına çözmez ve hiçbir veriyi
sessizce üzerine yazmaz. İki taraf aynı kaydı farklı değiştirmişse sonuç
"çakışma" olarak işaretlenir, `sync-unresolved-conflict` yazılır ve o hesap için
bütün otomatik senkronizasyonlar durur. Kişi "Çakışmayı çöz" ekranında hangi
tarafın kalacağını seçene kadar hiçbir şey yazılmaz.

Çakışma ekranı tarih, değer ya da kayıt göstermez: yalnızca kayıt sayısı, bir
şeyin var olup olmadığı, buluttaki kaydın zamanı ve onu yazanın bu cihaz olup
olmadığı gösterilir.

## Envanter

| veri | cihazda | cloud adayı | neden |
| --- | --- | --- | --- |
| `cycle-settings` | evet | evet | Kişinin kendi girdiği döngü ve regl süresi; yeniden kurulumda kaybolmamalı. |
| `period-records` | evet | evet | Kişinin kendi tuttuğu regl geçmişi; başka türlü geri getirilemez. |
| `pregnancy-profile` | evet | evet | Son regl tarihi ve tahmini doğum tarihi; kişinin girdiği kayıt. |
| `avatar-config` | evet | evet | Kişinin seçtiği görünüm; yeni cihazda yeniden seçtirmek gereksiz. |
| `notification-preferences` | evet | evet | Kişinin açıp kapattığı hatırlatıcılar; tercih, cihaz durumu değil. |
| `daily-entries` | evet | evet | Kişinin kendi girdiği günlük kayıtlar: akış yoğunluğu, belirtiler ve ruh hali. Hesaplanan değil, yazılan bir şey; yeniden kurulumda kaybolmamalı. |
| `widget-snapshot` | evet | **hayır** | Bu cihazın ana ekranı için üretilmiş kopya; kaynak veriden her an yeniden üretilir, yedeğe girmez. |
| `auth-session` | evet | **hayır** | Firebase Auth oturumu ve tokeni; bu cihaza ait, zaten hesabın kendisinde duruyor. |
| `shared-preferences` | evet | **hayır** | Android tarafındaki yerel depolama; içeriği bu cihaza ait. |
| `scheduled-notifications` | evet | **hayır** | Sistem kuyruğundaki alarmlar ve kimlikleri; her cihaz kendi kuyruğunu tercihlerden kurar. |
| `app-mode` | evet | **hayır** | Hangi sekmenin açık olduğu gibi arayüz durumu; kişisel kayıt değil. |
| `derived-cycle-data` | evet | **hayır** | Döngü günü, evre, doğurganlık tahmini, ruh hali ve takvim; kayıtlardan hesaplanır. |
| `content-sources` | evet | **hayır** | Uygulamayla gelen metin ve kaynak adresleri; kişiye ait veri değil. |
| `logs` | evet | **hayır** | Yalnızca genel olay adları yazılır; sağlık verisi hiç girmez. |
| `sync-state` | evet | **hayır** | Senkronizasyonun son mutabakatı: bu cihazla hesabın en son aynı olduğu andaki verinin bir kopyası, cihazda kalır ve hiçbir yere gönderilmez. |
| `sync-device-id` | evet | **hayır** | Bu kurulumun kendine verdiği rastgele ad; donanım kimliği, hesap kimliği ya da kişisel veri değil. Yedek dokümanına "bu yazıyı hangi cihaz yaptı" bilgisi olarak yazılır, payload içine girmez. |
| `sync-preferences` | evet | **hayır** | Otomatik senkronizasyonun bu telefonda açık olup olmadığı; cihaz kararı, hesapla taşınmaz. |
| `pending-account-deletion` | evet | **hayır** | Yarım kalmış bir hesap silme işleminin hangi hesaba ait olduğu. Yalnızca hesap kimliği; sağlık verisi içermez ve silme tamamlanınca ya da vazgeçilince kaldırılır. Silinmiş bir yedeğin yeniden oluşturulmasını engellemek için var. |
| `sync-last-synced-at` | evet | **hayır** | Bu telefonun hesapla en son ne zaman senkronize olduğu. Yalnızca bir zaman damgası; hangi verinin taşındığını içermez ve bir cihazın kendi durumudur. |
| `sync-unresolved-conflict` | evet | **hayır** | Çözülmemiş bir çakışmanın hangi hesaba ait olduğu. Yalnızca hesap kimliği; çakışan verinin kendisi burada tutulmaz ve çakışma çözülünce kaldırılır. Çözülene kadar otomatik senkronizasyonu durdurmak için var. |
| `app-lock` | evet | **hayır** | Uygulama kilidinin açık olup olmadığı, PIN'in tuzu ve karması. Cihaz kararı; hesapla taşınmaz. PIN'in kendisi hiçbir yerde saklanmaz. |
| `discreet-notifications` | evet | **hayır** | Hatırlatıcı bildirimlerinin kilit ekranında ayrıntı gösterip göstermeyeceği. Uygulama kilidiyle aynı nedenle cihazda kalır: kilit ekranını kimin gördüğü elindeki telefona ve çevresindeki kişilere bağlıdır, hesaba değil. Sağlık verisi içermez. |

Bu tablo `src/features/privacy/domain/data-category.ts` içindeki `DATA_INVENTORY`
ile aynı. Bir test ikisini birbirine bağlıyor: kodda olup burada olmayan (ya da
tersi) bir kategori testi düşürür.

## Neden hesaplanan veri gitmiyor

Döngü günü, evre, doğurganlık penceresi, ruh hali önerileri, takvim ve widget
kartı — hepsi kayıtlardan hesaplanır. Bunları da göndermek, aynı soruyu ve bir
cihazın o soruya verdiği cevabı birlikte göndermek olurdu: iki cihaz aynı gün
için farklı şey gösterdiğinde hangisinin doğru olduğu belirsiz kalır. Kaynak veri
gider, cevabı her cihaz kendi hesaplar.

Widget snapshot'ı ayrıca bir de bu yüzden gitmez: o, bu telefonun ana ekranındaki
karta ait bir kopya. Yeni cihaz uygulamayı ilk açtığında kendi snapshot'ını
yazar.

## Taşıma biçimi

`CloudSyncPayloadV1` (`src/features/privacy/domain/cloud-sync-payload-v1.ts`):

```
{ version: 1, cycleSettings, periodRecords, pregnancyProfile, avatarConfig,
  notificationPreferences }
```

- Her alan, uygulamanın kendi domain doğrulayıcısından geçer; bir senkronizasyon
  uygulamanın kendisinin reddedeceği bir şeyi taşıyamaz.
- `version` 1 değilse okunmaz — eksik okumak, birinin geçmişini yanlış şekle
  yazmaktır.
- İleriki bir sürümün eklediği alanlar korunur, atılmaz.
- Hata mesajlarına değer gömülmez: hangi alanın ne tür bir şey olduğu yazılır,
  içindeki tarih ya da kayıt yazılmaz.
