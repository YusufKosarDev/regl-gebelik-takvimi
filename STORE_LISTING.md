# Google Play mağaza metni / store listing copy

Play Console'a yapıştırılacak metin. Türkçe asıl metindir; İngilizce de bir
çeviri değil, aynı iddiaları taşıyan kendi başına yazılmış bir metindir.

Alan sınırları: kısa açıklama 80 karakter, tam açıklama 4.000. Sayımlar
başlıklarda, her değişiklikten sonra yenilenir.

## Bu metnin uyması gereken üç şey

1. **`docs/data-privacy.md` ve Data Safety formundan fazlasını iddia edemez.**
   Yayımlanan sayfalar, envanter ve bu metin aynı şeyi söylemek zorunda; bu
   metin Google'ın ilk okuduğu olandır.
2. **Tahmin bir döngüden fazlasına uzanmaz.** Uygulama tek bir regl tahmini
   işaretler ve bunu söyler; daha fazlasını vaat eden bir metin ekranla
   çelişir.
3. **Uygulamanın yapmadıkları bir kısıt değil, kendi kararı olarak yazılır** —
   çünkü öyledir.

## Play kurallarından çıkanlar

- **Health apps declaration her geliştirici için zorunlu**, bu metinden
  bağımsız olarak: "All developers must complete the Health apps declaration
  form on the App content page." Metni yumuşatmak bunu değiştirmez, yani
  tetiklememek diye bir şey yok.
- **İki feragat zorunlu, ihtiyat değil.** Tıbbi cihaz olarak düzenlenmeyen
  sağlık uygulamaları "not a medical device and does not diagnose, treat, cure,
  or prevent any medical condition" demek ve bir sağlık profesyoneline
  danışmayı hatırlatmak zorunda. İkisi de ÖNEMLİ bölümünde, uygulamanın kendi
  feragat metninin sözcükleriyle — iki yerin aynı şeyi söylemesi için.
- **Metadata:** sıralama ya da başarı iddiası yok ("#1", "Best of Play"), arama
  sırasını oynamak için özel karakter ya da büyük harf yok, ve tam açıklama
  kısa açıklamayı tekrar etmiyor ("Don't repeat your short description in your
  full description"). Kurallar "all translations" için geçerli: Türkçe ikincil
  bir çeviri değil, aynı ölçüye tabi bir metin.

## Kaynak adları kataloglardan geliyor, hafızadan değil

İlk taslak kaynak olarak ACOG'u da saymıştı. Uygulamanın kataloglarında ACOG
yok — NHS (haftalık sayfalar ve PMS), Cleveland Clinic ve Office on Women's
Health (iki sayfa) var, hepsi o. Aynı taslak haftalık içerik için "ağırlık" da
demişti; içerikte yalnızca boy var. İkisi de incelemeden geçer, mağazada durur
ve yanlış olurdu: biri sağlık içeriği için olmayan bir kaynak gösterir, öteki
olmayan bir içeriği vaat eder.

Listede kurum adı açıldı — "ABD Kadın Sağlığı Ofisi (Office on Women's
Health)" — çünkü uygulamadaki kaynak bir referanstır, listedeki satır ise bir
ikna. İçeriğe güvenip güvenmeyeceğine karar veren biri o kurumun ne olduğunu
bilmek durumunda. Uygulama olduğu gibi kalıyor: orada kaynak adları
çevrilmez.

---

## Türkçe

### Kısa açıklama (78/80)

```text
Regl ve gebelik takibi. Kayıtların telefonunda kalır, yedekleme senin seçimin.
```

### Tam açıklama (3641/4000)

```text
Regl & Gebelik Takvimi, döngünü ve gebeliğini kendi telefonunda takip etmen için yapıldı. Ne kadarını paylaşacağına sen karar verirsin: hesap açmadan da uygulamanın tamamı çalışır.

DÖNGÜNÜ TAKİP ET

• Regl başlangıcını ve bitişini kaydet; uygulama döngü gününü, içinde bulunduğun evreyi ve doğurganlık tahminini gösterir.
• Bir sonraki reglinin tahmini tarihi takvimde işaretlenir.
• Takvimde her ay geriye ve ileriye gidebilir, bir güne dokunup o gün ne kaydettiğini görebilirsin.
• Ana ekran widget'ı döngü gününü uygulamayı açmadan gösterir.
• Döngü süren zamanla değişmişse uygulama bunu fark eder ve ayarını güncellemeyi önerir. Kararı sen verirsin.

GÜNÜNÜ KAYDET

• Akış yoğunluğu, belirtiler ve ruh hali — bir güne not etmek istediğin kadarı.
• Kayıt geçmişini bir arada görebilir, hangi belirtinin hangi evrede daha sık olduğunu kendi kayıtlarından okuyabilirsin.

GEBELİK TAKİBİ

• Son regl tarihinden tahmini doğum tarihini hesaplar; dilersen doktorunun verdiği tarihi kendin girebilirsin.
• Kırk haftanın her biri için genel bilgilendirme: o hafta nelerin geliştiği ve tahmini boyu.
• Bu bilgiler NHS, Cleveland Clinic ve ABD Kadın Sağlığı Ofisi (Office on Women's Health) yayınlarına dayanır; her bölümün kaynağı adıyla uygulamada yazılıdır. Kaynağa dokunup kendin okuyabilirsin.

HATIRLATICILAR

• İstersen tahmini regl tarihinden bir gün önce sabah tek bir hatırlatma.
• Gebelik takibi açıkken her pazartesi haftalık bir not.
• "Bildirimlerde ayrıntı gösterme" açıkken hatırlatıcılar regl ya da gebelikten söz etmez; yalnızca uygulamayı açmanı söyler. Android bildirim metnini kilit ekranında gösterir ve bir uygulama bunu gizleyemez — değiştirebildiği tek şey metnin kendisidir, o da bu ayarın yaptığı şeydir.
• Hatırlatıcılar kapalı gelir. Açmak sana kalmış.

KAYITLARIN NEREDE DURUYOR

• Kayıtların varsayılan olarak yalnızca telefonunda, uygulamanın kendi veritabanında durur.
• Telefondan çıkmasının iki yolu var ve ikisi de senin elinde: "Yedek oluştur" ya da "Şimdi senkronize et" düğmesine basmak, bir de "Otomatik senkronizasyon" ayarını açmak. O ayar varsayılan olarak kapalıdır.
• Yedek yalnızca senin kendi hesabının altına gider. Başka hiçbir yere gönderilmez.
• Reklam yok, analiz aracı yok, üçüncü taraf izleme yok. Verilerin satılmaz.
• Android'in otomatik yedeklemesinin dışında bırakıldı; kayıtların Google Drive'a kopyalanmaz.

KENDİ VERİN SENDE KALIR

• Uygulama kilidi: PIN, istersen parmak izi. Uygulamayı açan herkesin kayıtlarını görmesi gerekmez.
• Kayıtlarını CSV olarak dışa aktarabilirsin.
• Telefondaki her şeyi tek bir işlemle silebilirsin. Hesap açtıysan hesabı ve buluttaki yedeği de silebilirsin.
• Türkçe ve İngilizce.

UYGULAMANIN KENDİNE KOYDUĞU SINIRLAR

• Bilmediği şeyi tahmin etmez. Beklenen gün geçtiğinde evre ve doğurganlık tahmini göstermeyi bırakır; gün saymaya devam eder, çünkü o sayı kayıtlarından gelir.
• Birden fazla döngüyü öngörmez. Yalnızca bir sonraki reglin için bir tahmin işaretler.
• Kayıt girmediğin şey hakkında bir şey söylemez.
• Hesap açmanı istemez.

ÖNEMLİ

Bu uygulama bir tıbbi cihaz değildir; hiçbir hastalığı teşhis etmez, tedavi etmez, iyileştirmez ya da önlemez. Gösterdiği tarihler ve bilgiler genel bilgilendirme amaçlıdır ve girdiğin kayıtlara dayanan tahminlerdir; tıbbi tavsiye, teşhis veya tedavi yerine geçmez. Herkesin döngüsü farklıdır ve bu tahminler kesin değildir.

Bu uygulama bir doğum kontrol yöntemi değildir. Gebelikten korunmak ya da gebe kalmak için tek başına kullanılmamalıdır.

Sağlığınla ilgili bir endişen varsa bir sağlık profesyoneline danış. Gebelik süresince düzenli doktor kontrollerini aksatma. Acil bir durumda 112'yi ara.
```

---

## English

### Short description (74/80)

```text
Period and pregnancy tracking. Your records stay on your phone by default.
```

### Full description (3726/4000)

```text
Regl & Gebelik Takvimi is for following your cycle and your pregnancy on your own phone. How much of it leaves the phone is your decision, and the whole app works without an account.

FOLLOW YOUR CYCLE

• Record when a period starts and ends. The app shows the day of your cycle, the phase you are in and an estimate of fertility.
• The date your next period is expected is marked on the calendar.
• Page back and forward through the months, and tap a day to see what you recorded on it.
• A home screen widget shows the day of your cycle without opening the app.
• If your cycle length has drifted, the app notices and offers to update the setting. You decide whether to take it.

NOTE DOWN YOUR DAY

• Flow, symptoms and mood — as much or as little of a day as you want to keep.
• Read your own history back, and see which symptoms turned up in which phase according to your records rather than to an average.

FOLLOWING A PREGNANCY

• Works out an estimated due date from your last period, or takes the date your doctor gave you if you would rather enter it yourself.
• General information for each of the forty weeks: what is developing, and estimated size.
• That content is written from the NHS, Cleveland Clinic and the Office on Women's Health, and every entry names its own sources in the app. Tap one and read it for yourself.

REMINDERS

• One reminder, on the morning before your period is expected, if you want it.
• A weekly note on Mondays while you are following a pregnancy.
• With "Keep details out of notifications" on, a reminder mentions neither periods nor pregnancy — it only tells you to open the app. Android shows notification text on the lock screen and an app cannot hide it; the wording is the one part it can change, and that is what this setting changes.
• Reminders start switched off. Turning one on is up to you.

WHERE YOUR RECORDS ARE

• By default your records are kept on your phone only, in the app's own database.
• There are two ways they leave it, and both are yours: pressing "Create backup" or "Sync now", and switching on "Automatic sync". That setting is off until you turn it on.
• A backup goes to your own account and nowhere else.
• No ads, no analytics, no third-party tracking. Your data is not sold.
• The app is excluded from Android's own backup, so your records are not copied to Google Drive.

IT STAYS YOURS

• App lock with a PIN, and a fingerprint if you want one. Opening the app need not mean reading everything in it.
• Export your records as CSV.
• Delete everything on the phone in one action. If you opened an account, you can delete the account and its backup too.
• Turkish and English.

WHAT THE APP WILL NOT DO

• It does not estimate what it cannot know. Once the expected day has passed it stops showing a phase and a fertility estimate, and goes on counting the day, because that number comes from your own records.
• It does not forecast several cycles ahead. It marks one estimate, for your next period.
• It says nothing about what you have not recorded.
• It does not ask you to make an account.

IMPORTANT

This app is not a medical device and it does not diagnose, treat, cure or prevent any medical condition. The dates and information it shows are general information and are estimates based on the records you enter; they are not a substitute for medical advice, diagnosis or treatment. Every cycle is different and these estimates are not exact.

This app is not a method of contraception. It should not be used on its own to avoid or to achieve a pregnancy.

If you have a concern about your health, speak to a healthcare professional. Keep your regular appointments during a pregnancy. In an emergency, contact your local emergency services.
```
