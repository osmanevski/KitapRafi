# Otomasyon — Gemini + n8n ile Kitap Ekleme

Sen n8n formuna kitap adı yazacaksın → Gemini araştırıp veri üretecek →
otomatik siteye eklenecek. İstediğin an `admin.html`'den elle düzeltebilirsin.
İkisi de aynı `data/books.json`'a yazdığı için sorun olmaz.

---

## 1. Gemini API anahtarı al (ücretsiz)

1. https://aistudio.google.com/apikey adresine Google hesabınla gir.
2. **"Create API key"** / **"API anahtarı oluştur"** de.
3. Çıkan anahtarı (AIza... ile başlar) kopyala. Bu senin `GEMINI_API_KEY`'in.

Ücretsiz kotası küçük kitap ekleme işi için fazlasıyla yeter.

---

## 2. Site sunucusunu çalıştır (VDS'te)

Önce ana uygulama ayakta olmalı (bkz. README.md). PM2 ile:
```
pm2 start server.js --name roman-rafi
pm2 save
```
`http://localhost:3000/api/books` çalışıyor olmalı.

**Önemli:** `server.js` içindeki `ADMIN_KEY`'i değiştirdiysen, aşağıda o şifreyi kullanacaksın.

---

## 3. n8n'e workflow'u yükle

1. n8n arayüzünü aç (VDS'inde zaten kurulu).
2. Sağ üstten **⋯ → Import from File** (Dosyadan içe aktar).
3. `n8n-workflow.json` dosyasını seç.
4. Akış 5 kutu halinde gelir: Form → Prompt Hazırla → Gemini → JSON Ayıkla → Siteye Ekle.

### İki yeri düzenle:

**a) "Gemini'ye Sor" kutusu** — Query Parameters bölümünde `key` değerini
`GEMINI_API_KEY_BURAYA` yerine kendi Gemini anahtarınla değiştir.

**b) "Siteye Ekle" kutusu** — Header'da `x-admin-key` değerini
`ADMIN_SIFREN_BURAYA` yerine `server.js`'teki ADMIN_KEY ile değiştir.

> Not: n8n ile site aynı VDS'te olduğu için URL `http://localhost:3000/api/books/ingest`
> olarak kalabilir. Farklı sunucudaysa `localhost` yerine site IP'sini yaz.

5. Workflow'u **Active** yap (sağ üst anahtar).

---

## 4. Kullan

1. "Kitap Formu" kutusuna tıkla → **Production URL** / **Form URL**'i kopyala.
   (Bu, tarayıcıdan açabileceğin bir form sayfası.)
2. Formu aç, kitap adını (istersen yazarı da) yaz, gönder.
3. Birkaç saniye içinde kitap sitene düşer. `http://SUNUCU_IP:3000` → sağa kaydırıp gör.
4. Beğenmediğin bir alan olursa `admin.html`'e gir, o kitabı **Düzenle**.

**Var olan kitabı güncellemek** için formda "Var olanı güncelle? → Evet" seç.

---

## Nasıl çalışıyor / güvenlik notları

- Gemini bazen kapak URL'si **uydurur**. Server URL'yi gerçekten indirmeye çalışır;
  erişilemezse kapağı boş bırakır ve site otomatik CSS (tipografik) kapağa düşer — hiç kırılmaz.
  En garanti kapak için panelden elle yükleme her zaman açık.
- Gemini eksik/bozuk alan gönderse bile server `normalizeBook` ile şemaya oturtur
  (4 nota tamamlar, renk paleti yoksa otomatik üretir). Yani akış çökmez.
- `ingest` endpoint'i de `x-admin-key` ister; şifresiz kimse kitap ekleyemez.
- Aynı kitap iki kez gelirse `overwrite:false` iken 409 döner (çift kayıt olmaz).

---

## İpuçları

- Toplu ekleme istersen: n8n'de Form yerine bir "Edit Fields" + "Split Out" ile
  kitap listesi verip döngüye sokabilirsin. İstersen o versiyonu da hazırlarım.
- Gemini modeli `gemini-2.0-flash` (hızlı ve ücretsiz). Daha detaylı sonuç istersen
  URL'deki model adını `gemini-2.5-pro` yapabilirsin (kota/ücret değişebilir).
- Gemini'nin ürettiği bilgide hata olabilir — özellikle tarih ve künye.
  Otomasyon "ilk taslağı" üretir; son sözü panelden sen söylersin.
