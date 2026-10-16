# Yayın sırası

Bu dosya, bir sürümü yayınlarken izlenecek sırayı tutar. Sıranın kendisi
kuralın parçasıdır: **Firestore kuralları, sayaçlı build herkese yayılmadan
deploy edilmez.** Gerekçesi en altta.

## 1. Doğrulama

```
npx tsc --noEmit
npx expo lint
npx jest --ci
```

Üçü de temiz olmadan devam edilmez. `main` üzerindeki CI'ın da yeşil olduğunu
kontrol et — yerel doğrulama CI'ın yerine geçmez, yanında durur.

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

## Notlar

- Kural dosyası: `firestore.rules` (rollout notu dosyanın kendi yorumunda da
  durur). Deploy komutu `firebase.json` üzerinden aynı dosyayı okur.
- Kuralların metni `src/features/sync/__tests__/firestore-rules.test.ts`
  ile pinlenir.
