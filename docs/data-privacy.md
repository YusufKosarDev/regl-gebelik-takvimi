# Veri envanteri ve bulut sınırı

Bu uygulama bir sağlık uygulaması. Tuttuğu şey birinin regl geçmişi, gebeliği ve
kendi seçtiği görünüm. Bu belge hangi verinin nerede durduğunu ve ileride bir
senkronizasyon özelliği gelirse neyin çıkabileceğini, neyin çıkamayacağını yazar.

## Bugünkü durum

- **Ağ isteği yok.** Uygulamada `fetch`, XHR, WebSocket ya da herhangi bir API
  çağrısı yok. Tek dış bağlantı, kullanıcı bir kaynak bağlantısına dokunduğunda
  telefonun tarayıcısını açmak (`Linking.openURL`) — oraya giden şey uygulamanın
  kendi gömülü kaynak adresi, kullanıcının verisi değil.
- **Firebase yok, analytics yok, crash reporting yok.** Bağımlılık listesinde de
  yok; bir tarama testi bunu her çalıştırmada doğruluyor.
- **Hesap yok, auth yok.**
- **Sağlık verisi cihazda.** Her şey uygulamanın kendi SQLite dosyasında
  (`regl-gebelik.db`) ve uygulamaya özel Android depolamasında duruyor.
- **Loglar ham sağlık verisi içermez.** Konsola yalnızca kapalı bir listeden
  gelen genel olay adları yazılır (`[app] widget sync failed` gibi); tarih,
  kayıt, avatar ya da hata mesajı yazılmaz. Bkz. `src/shared/logging/`.

Firebase ya da başka bir bulut, ancak **açık bir kullanıcı hesabı ve kullanıcının
kendi açtığı bir senkronizasyon özelliğiyle** eklenecek. Eklendiğinde de
taşıyabileceği tek şey aşağıdaki "cloud adayı: evet" satırları ve tek biçim
`CloudSyncPayloadV1`.

## Envanter

| veri | cihazda | cloud adayı | neden |
| --- | --- | --- | --- |
| `cycle-settings` | evet | evet | Kişinin kendi girdiği döngü ve regl süresi; yeniden kurulumda kaybolmamalı. |
| `period-records` | evet | evet | Kişinin kendi tuttuğu regl geçmişi; başka türlü geri getirilemez. |
| `pregnancy-profile` | evet | evet | Son regl tarihi ve tahmini doğum tarihi; kişinin girdiği kayıt. |
| `avatar-config` | evet | evet | Kişinin seçtiği görünüm; yeni cihazda yeniden seçtirmek gereksiz. |
| `notification-preferences` | evet | evet | Kişinin açıp kapattığı hatırlatıcılar; tercih, cihaz durumu değil. |
| `widget-snapshot` | evet | **hayır** | Bu cihazın ana ekranı için üretilmiş kopya; kaynak veriden her an yeniden üretilir. |
| `shared-preferences` | evet | **hayır** | Android tarafındaki yerel depolama; içeriği bu cihaza ait. |
| `scheduled-notifications` | evet | **hayır** | Sistem kuyruğundaki alarmlar ve kimlikleri; her cihaz kendi kuyruğunu tercihlerden kurar. |
| `app-mode` | evet | **hayır** | Hangi sekmenin açık olduğu gibi arayüz durumu; kişisel kayıt değil. |
| `derived-cycle-data` | evet | **hayır** | Döngü günü, evre, doğurganlık tahmini, ruh hali ve takvim; kayıtlardan hesaplanır. |
| `content-sources` | evet | **hayır** | Uygulamayla gelen metin ve kaynak adresleri; kişiye ait veri değil. |
| `logs` | evet | **hayır** | Yalnızca genel olay adları yazılır; sağlık verisi hiç girmez. |

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
