# Tam Otomatik: Kazı + Doldur

Tek script 1000kitap listenden kitapları çeker, her biri için OpenRouter'a
sorup içeriği doldurtur, kapakla birlikte siteye ekler. n8n'e dokunmaz.

## ÖNCE: 3 kitapla TEST et (önemli!)

101 kitabı körlemesine çalıştırma. Önce 3 kitapla dene, her şey doğru mu gör:

Windows CMD (`kitaprafi` klasöründe):
```
set ADMIN_KEY=osman
set OPENROUTER_KEY=sk-or-v1-SENIN-ANAHTARIN
set LIMIT=3
node scripts/kazi-ve-doldur.js "https://1000kitap.com/Osmanevski/kitaplari/okuduklari"
```

Siteyi aç (F5), 3 kitap düzgün geldiyse (içerik + kapak) devam et.

## SONRA: hepsini çek

`set LIMIT=` satırını atla (ya da `set LIMIT=0`), aynı komutu çalıştır:
```
set ADMIN_KEY=osman
set OPENROUTER_KEY=sk-or-v1-SENIN-ANAHTARIN
node scripts/kazi-ve-doldur.js "https://1000kitap.com/Osmanevski/kitaplari/okuduklari"
```

101 kitap sırayla işlenir, ekranda tek tek görünür. ~5-10 dakika sürer.

## Ayarlar (opsiyonel, ortam değişkeni)
- MODEL         : model (varsayılan google/gemini-3-flash-preview)
- LIMIT         : en fazla kaç kitap (test için, örn 3; 0 = hepsi)
- DELAY_MS      : kitaplar arası bekleme (varsayılan 1500)
- OVERWRITE=1   : mevcut kitabın üzerine yaz (varsayılan atla)

## Notlar
- Zaten ekli kitaplar atlanır (çift kayıt olmaz).
- Kapak: 1000kitap CDN'inden indirilmeye çalışılır; olmazsa CSS palete düşer.
- Model bilgisi hatalı olabilir; sonradan panelden düzeltebilirsin.
- OpenRouter maliyeti 101 kitap için ~birkaç sent.
