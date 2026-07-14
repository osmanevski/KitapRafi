# Hazır Listeden Doldurma

101 kitabın listesi zaten çekildi (data/kitap-listesi.json).
Bu script her kitap için OpenRouter'a sorup içeriği doldurtur ve siteye ekler.
1000kitap'a HİÇ istek gitmez — 403 sorunu yok.

## ÖNCE 3 kitapla TEST et

Windows CMD (`kitaprafi` klasöründe):
```
set ADMIN_KEY=osman
set OPENROUTER_KEY=sk-or-v1-SENIN-ANAHTARIN
set LIMIT=3
node scripts/listeden-doldur.js
```

Siteyi aç (F5), 3 kitap düzgün geldiyse devam.

## SONRA hepsini çalıştır

`set LIMIT=3` yerine `set LIMIT=0` (ya da hiç yazma):
```
set ADMIN_KEY=osman
set OPENROUTER_KEY=sk-or-v1-SENIN-ANAHTARIN
node scripts/listeden-doldur.js
```

101 kitap sırayla işlenir, ~3-5 dakika. OpenRouter maliyeti birkaç sent.

## Notlar
- Zaten ekli kitaplar atlanır (senin ilk 10 kitabından çakışan olursa atlar).
- Aynı yazarın çok kitabı var (Conan Doyle 9, Camus 7, Tolkien 6) — yazar
  dosyası bir kez oluşur, hepsinde ortak görünür.
- Kapak GELMEZ (liste kapaksız). Sonra panelden elle yükleyebilirsin.
- Kategoriler otomatik gelir (Roman, Bilimkurgu, Felsefe, Distopya...).
- Model bilgisi ara sıra hatalı olabilir; panelden düzeltebilirsin.

## Listeyi güncellemek istersen
data/kitap-listesi.json dosyasına { "title":"...", "author":"..." } ekle/çıkar.
