# Veri envanteri ve bulut sınırı

Bu uygulama bir sağlık uygulaması. Tuttuğu şey birinin regl geçmişi, gebeliği ve
kendi seçtiği görünüm. Bu belge hangi verinin nerede durduğunu ve ileride bir
senkronizasyon özelliği gelirse neyin çıkabileceğini, neyin çıkamayacağını yazar.

## Bugünkü durum

- **Sağlık verisi yalnızca sen bir düğmeye bastığında gönderiliyor.** Bu iki
  düğme var: "Yedek oluştur" ve "Şimdi senkronize et". Başka hiçbir durumda
  cihazdan çıkmıyor: otomatik yedekleme, açılışta senkronizasyon, arka planda
  gönderim ve değişiklik dinleyicisi **yok**. Hesabın olsun ya da olmasın, o
  düğmelerden birine basmadığın sürece hiçbir sağlık verisi gitmez.
- **"Otomatik senkronizasyon" anahtarı şimdilik yalnızca tercihini kaydediyor.**
  Açman hiçbir arka plan gönderimi başlatmaz; kendiliğinden çalışan
  senkronizasyon henüz yok. Tercih bu telefonda duruyor, hesapla taşınmıyor:
  başka bir cihaza giriş yapmak orada senkronizasyonu açmaz.
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
- **Loglar ham sağlık verisi içermez.** Konsola yalnızca kapalı bir listeden
  gelen genel olay adları yazılır (`[app] widget sync failed` gibi); tarih,
  kayıt, avatar ya da hata mesajı yazılmaz. Bkz. `src/shared/logging/`.

Yedek gönderildiğinde taşınan tek şey aşağıdaki "cloud adayı: evet" satırları ve
tek biçim `CloudSyncPayloadV1`:

1. `cycle-settings` — ortalama döngü ve regl süresi
2. `period-records` — regl kayıtları
3. `pregnancy-profile` — son regl tarihi, tahmini doğum tarihi ve kaynağı
4. `avatar-config` — avatar seçimleri
5. `notification-preferences` — iki hatırlatıcı anahtarı

Bunlara ek olarak dokümanda yalnızca bir sürüm numarası ve sunucunun yazdığı
zaman damgası bulunur. **Widget snapshot'ı, loglar, bildirim kuyruğu, arayüz
durumu ve hesaplanan hiçbir veri (döngü günü, evre, doğurganlık, ruh hali,
takvim) yedekte yer almaz.**

Geri yükleme (restore) ve elle başlatılan senkronizasyon var. Kendiliğinden
çalışan senkronizasyon ve çakışmaları çözme ekranı henüz yok: bir çakışma
bulunduğunda senkronizasyon durur, iki taraftaki veriler olduğu gibi bırakılır ve
ekranda hiçbir şeyin değişmediği yazar.

## Envanter

| veri | cihazda | cloud adayı | neden |
| --- | --- | --- | --- |
| `cycle-settings` | evet | evet | Kişinin kendi girdiği döngü ve regl süresi; yeniden kurulumda kaybolmamalı. |
| `period-records` | evet | evet | Kişinin kendi tuttuğu regl geçmişi; başka türlü geri getirilemez. |
| `pregnancy-profile` | evet | evet | Son regl tarihi ve tahmini doğum tarihi; kişinin girdiği kayıt. |
| `avatar-config` | evet | evet | Kişinin seçtiği görünüm; yeni cihazda yeniden seçtirmek gereksiz. |
| `notification-preferences` | evet | evet | Kişinin açıp kapattığı hatırlatıcılar; tercih, cihaz durumu değil. |
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
