# Kitap Rafı

Scroll ile gezilen Türk edebiyatı kitap tanıtım sitesi + yönetim paneli.

## Kurulum
```
npm install
node server.js
```
- Site:  http://localhost:3000
- Panel: http://localhost:3000/admin.html

## Admin şifresi
Varsayılan: `degistir-beni` — **mutlaka değiştir.**
- Kolay yol: `server.js` içindeki `ADMIN_KEY` satırını düzenle.
- Ya da ortam değişkeniyle (VDS için önerilen):
  - Windows: `set ADMIN_KEY=guclu-bir-sifre && node server.js`
  - Linux/Mac: `ADMIN_KEY=guclu-bir-sifre node server.js`

## Panel kullanımı
- **+ Yeni Kitap** ile ekle, mevcut kitapta **Düzenle/Sil**, oklarla **sırala**.
- Kapak: görsel yükleyebilirsin (yüklersen CSS kapak yerine o görünür) ya da boş bırakıp
  renk paleti + "Kapak Yazı Dizilimi" ile tipografik kapak ürettirirsin.
- Vurgu için metinlerde `*yıldız*` kullan: `Kurt *Kanunu*` -> Kanunu renkli çıkar.
- Özet ve biyografi paragraflarını **boş satırla** ayır.
- Künye / eserler / künye satırları `Değer|Etiket` biçiminde.

## Veri & dosyalar
- Kitaplar: `data/books.json` (düz metin, elle de düzenlenebilir; yedeğini al).
- Yüklenen kapaklar: `uploads/`
- Ön yüz: `public/index.html` — tasarım/animasyon burada.

## VDS'te sürekli çalıştırma (PM2)
```
npm install -g pm2
pm2 start server.js --name kitap-rafi
pm2 save
```
