# Kitap Rafı

Kaydırma animasyonlarıyla gezilen kitap tanıtım sitesi, yönetim paneli ve n8n destekli
kitap ekleme otomasyonu.

## Teknoloji

- Node.js + Express
- Multer ile kapak yükleme
- Vanilla HTML, CSS ve JavaScript
- Kitap ve yazar verileri için JSON dosyaları

## Yerel kurulum

```bash
npm install
ADMIN_KEY=guclu-bir-sifre npm start
```

- Site: http://localhost:3000
- Yönetim paneli: http://localhost:3000/admin.html

`ADMIN_KEY` zorunludur. Ayarlanmazsa site açılır ancak yönetim işlemleri güvenlik için
devre dışı kalır. Kod içinde varsayılan veya gömülü admin şifresi yoktur.

İsteğe bağlı `GOOGLE_BOOKS_KEY`, Google Books'un anahtarsız kota sınırına takılmasını
önler. Anahtar yoksa veya Google sonuç vermezse kapak araması Open Library'ye düşer.

Windows CMD:

```cmd
set "ADMIN_KEY=guclu-bir-sifre"
npm start
```

## Yönetim paneli

- **+ Yeni Kitap** ile kitap eklenir; mevcut kitaplar düzenlenebilir, silinebilir ve sıralanabilir.
- Yazar bilgileri **Yazarlar** sekmesinden ortak bir dosya olarak yönetilir.
- Kapak görseli yüklenebilir veya Google Books/Open Library üzerinden aranabilir.
- Kapak yoksa renk paleti ve yazı dizilimiyle tipografik CSS kapak gösterilir.
- Metinde `*vurgu*` kullanımı güvenli biçimde `<em>` vurgusuna dönüştürülür.
- Özet ve biyografi paragrafları boş satırlarla ayrılır.
- Künye ve eser satırları `Değer|Etiket` biçimindedir.

## Veri ve dosyalar

- Kitaplar: `data/books.json`
- Yazarlar: `data/authors.json`
- Yüklenen kapaklar: `uploads/`
- Kullanıcı arayüzü: `public/index.html`
- Yönetim paneli: `public/admin.html`
- Sunucu/API: `server.js`

Canlı sunucudaki `data/` ve `uploads/` üretim verisidir. Yerel kopyalar yalnız geliştirme
verisi sayılır ve canlıyla eşit olmak zorunda değildir. Kod dağıtırken bu iki klasörü
sunucuya kopyalama; canlı kitap, yazar ve kapak verilerini ezme.

## Canlı ortam

- Site: https://kitaprafi.osmanevski.com
- n8n: https://n8n.osmanevski.com
- Sunucu uygulaması: PM2 süreci `kitaprafi`, port `3000`
- Reverse proxy ve HTTPS: Caddy

Windows sunucuda ilk PM2 kurulumu:

```cmd
set "ADMIN_KEY=guclu-bir-sifre"
pm2 start server.js --name kitaprafi
pm2 save
```

Ortam değişkeni kalıcı olarak değiştirildikten sonra:

```cmd
pm2 restart kitaprafi --update-env
pm2 save
```

Kod güncellemesinde yalnız değişen kod/statik dosyaları gönder ve ardından gerekirse
`pm2 restart kitaprafi` çalıştır.

## Otomasyon

`n8n-workflow.json`, OpenRouter üzerinden `google/gemini-3-flash-preview` modelini kullanır
ve üretilen kitabı korumalı `/api/books/ingest` endpoint'ine gönderir. Kurulum ve kullanım
ayrıntıları için [OTOMASYON.md](OTOMASYON.md) dosyasına bak.
