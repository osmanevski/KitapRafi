# 1000kitap Kazıyıcı — Kullanım

101 kitabı 1000kitap listenden çekip siteye "iskelet" olarak ekler
(ad + yazar + 1000kitap linki). İçerikler boş gelir; sonra modelle doldurulur.

## Çalıştırma (VDS'te, `kitaprafi` klasöründe)

Windows CMD:
```
set ADMIN_KEY=senin-sifren
node scripts/scrape-1000kitap.js "https://1000kitap.com/Osmanevski/kitaplari/okuduklari"
```

Not: ADMIN_KEY, server.js'teki şifreyle AYNI olmalı. Site (server.js) çalışıyor olmalı.

## Ne yapar
- Listedeki tüm sayfaları gezer (İleri linkini takip eder)
- Her kitabı ad + yazar olarak siteye ekler
- 1000kitap linkini sourceUrl olarak saklar
- Zaten ekli olan kitabı atlar (çift kayıt olmaz)

## Ayarlar (opsiyonel, ortam değişkeni)
- SITE       : site adresi (varsayılan http://localhost:3000)
- DELAY_MS   : sayfalar arası bekleme (varsayılan 2500 ms — siteye kibar ol)
- MAX_PAGES  : en fazla kaç sayfa (varsayılan 40)

## Sonra ne olacak
İskelet kitapların içeriği (notlar, özet, yazar dosyası) boştur.
Bunları n8n otomasyonu / model ile teker teker doldurabilirsin.
