# Otomasyon — OpenRouter + n8n ile Kitap Ekleme

n8n formuna kitap adı ve isteğe bağlı yazar girilir. OpenRouter üzerindeki model kitabı
araştırıp yapılandırılmış içerik üretir; n8n bu içeriği Kitap Rafı API'sine gönderir.
Sonuç yönetim panelinden gözden geçirilebilir ve düzenlenebilir.

## Çalışan akış

Akış beş adımdan oluşur:

1. **Kitap Formu** — kitap adı, yazar ve güncelleme tercihini alır.
2. **Prompt Hazırla** — model talimatını oluşturur.
3. **OpenRouter'a Sor** — `google/gemini-3-flash-preview` modelinden JSON ister.
4. **JSON Ayıkla** — model yanıtını temizleyip kitap objesine dönüştürür.
5. **Siteye Ekle** — veriyi `http://localhost:3000/api/books/ingest` adresine gönderir.

Canlı form:

https://n8n.osmanevski.com/form/7bec16cd-44a1-482c-bf83-395fd5d1d00f

## Gereken anahtarlar

### OpenRouter anahtarı

1. https://openrouter.ai/settings/keys adresinden bir API anahtarı oluştur.
2. n8n'de **OpenRouter'a Sor** node'unu aç.
3. `Authorization` başlığındaki placeholder'ı `Bearer OPENROUTER_ANAHTARI` biçiminde değiştir.

Anahtarı Git'e, dokümantasyona veya handoff dosyasına yazma.

### Kitap Rafı admin anahtarı

Sunucu uygulaması `ADMIN_KEY` ortam değişkenini kullanır. n8n'deki **Siteye Ekle** node'unda
`x-admin-key` başlığı aynı değere sahip olmalıdır. Anahtar kodda gömülü değildir ve
`ADMIN_KEY` ayarlı değilse yazma endpoint'leri kapalıdır.

## Workflow'u içe aktarma

1. n8n arayüzünü aç.
2. **Import from File** ile `n8n-workflow.json` dosyasını seç.
3. **OpenRouter'a Sor** node'unda OpenRouter anahtarını ayarla.
4. **Siteye Ekle** node'unda `x-admin-key` değerini ayarla.
5. Modelin `google/gemini-3-flash-preview` olduğunu doğrula.
6. Workflow'u kaydet ve **Publish/Active** yap.

Repo dosyası güvenlik nedeniyle gerçek anahtar içermez ve `active: false` olarak tutulabilir.
Canlı n8n kaydı ayrıca yayınlanmalıdır. n8n ve Kitap Rafı aynı sunucuda olduğu için ingest
adresi `http://localhost:3000/api/books/ingest` olarak kalır.

CLI ile yayınlama gerekiyorsa canlı workflow kimliğiyle:

```cmd
node C:\n8n\node_modules\n8n\bin\n8n publish:workflow --id=nSiVboAyXDF2yuas
pm2 restart n8n
```

## Kullanım

1. Canlı formu aç.
2. Kitap adını ve mümkünse yazarı yaz.
3. Yeni kayıt için **Var olanı güncelle? → Hayır** seç.
4. Mevcut kitabı yenilemek için **Evet** seç.
5. Gönderimden sonra kitabı sitede ve yönetim panelinde kontrol et.

Model bilgileri özellikle tarihler, künye ve alıntılarda hatalı olabilir. Otomasyon ilk
taslağı üretir; son kontrol yönetim panelinden yapılmalıdır.

## Kapak davranışı

- Modelin verdiği kapak URL'si önce sunucu tarafından indirilir.
- URL yoksa Google Books üzerinden kapak aranır; kota/sonuç sorunu olursa Open Library
  otomatik yedek sağlayıcı olarak kullanılır.
- Görsel indirilemezse kayıt yine oluşturulur ve site tipografik CSS kapağa düşer.
- Gerekirse yönetim panelinden kapak yüklenebilir veya **Kapak Bul** kullanılabilir.

## Güvenlik ve veri kuralları

- `/api/books/ingest` yalnız doğru `x-admin-key` ile çalışır.
- Aynı slug mevcutsa `overwrite: false` durumunda `409` döner; çift kayıt oluşmaz.
- Gelen veri `normalizeBook` ile temel şemaya oturtulur ve dört not alanına tamamlanır.
- Canlı `data/` ve `uploads/` üretim verisidir; workflow veya kod dağıtımında ezilmemelidir.
- OpenRouter ve admin anahtarlarını repo, log veya paylaşım dosyalarına koyma.
