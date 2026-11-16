# Patikat

Metroda, otobüste, kısa yolculuklarda tek elle oynanan bir kedi oyunu. Kedin iki apartmanın arasında duvardan duvara zıplar; kaktüslerden, çamaşır iplerinden ve fıskiyelerden kaçar, balık toplar.

- Tek dokunuş: karşı duvara zıpla. Zıplarken tekrar dokun: havada geri dön.
- 7 kedi (her birinin yeteneği var), 10 aksesuar, 15 bölüm, sonsuz koşu, Günün Seferi
- Canlar, açlık, bekçi köpeği, karga, yağmur, sis, görevler, dükkan
- İnternetsiz çalışır (PWA), turu kaydeder, kaldığın yerden devam eder

Bütün çizimler ve sesler kodla üretilmiştir; dışarıdan alınmış görsel, ses veya yazı tipi yoktur.

## Çalıştırma

```
npm install
npm start        # http://localhost:8080
```

Günün Seferi sıralaması için MongoDB gerekir (varsayılan `mongodb://127.0.0.1:27017`, `MONGODB_URI` ile değiştirilebilir). MongoDB yoksa oyun yine çalışır, yalnızca sıralama kapanır.

## Android

```
npx cap sync android
cd android && gradlew assembleDebug
```
