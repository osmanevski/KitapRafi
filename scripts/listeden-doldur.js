/* HAZIR LİSTEDEN DOLDUR
 *
 * data/kitap-listesi.json içindeki kitapları okur, her biri için OpenRouter'a
 * sorup içeriği (notlar, özet, yazar dosyası, kategori, renk) doldurtur ve
 * siteye ekler. 1000kitap'a HİÇ istek gitmez (liste zaten hazır) — 403 yok.
 *
 * KULLANIM (VDS'te, kitaprafi klasöründe):
 *   set ADMIN_KEY=senin-sifren
 *   set OPENROUTER_KEY=sk-or-v1-...
 *   set LIMIT=3
 *   node scripts/listeden-doldur.js
 *
 * Test için LIMIT=3 ile başla; iyiyse LIMIT'i kaldırıp hepsini çalıştır.
 *
 * AYARLAR (ortam değişkeni):
 *   ADMIN_KEY       site admin şifren                          [zorunlu]
 *   OPENROUTER_KEY  OpenRouter anahtarın (sk-or-...)           [zorunlu]
 *   SITE            site adresi (varsayılan http://localhost:3000)
 *   MODEL           model (varsayılan google/gemini-3-flash-preview)
 *   LISTE           liste dosyası (varsayılan data/kitap-listesi.json)
 *   LIMIT           en fazla kaç kitap (test için; 0 = hepsi)
 *   DELAY_MS        kitaplar arası bekleme (varsayılan 1200 ms)
 *   OVERWRITE=1     mevcut kitabın üzerine yaz (varsayılan atla)
 */

const fs = require('fs');
const path = require('path');

const ADMIN_KEY = process.env.ADMIN_KEY;
const OR_KEY    = process.env.OPENROUTER_KEY;
const SITE      = process.env.SITE || 'http://localhost:3000';
const MODEL     = process.env.MODEL || 'google/gemini-3-flash-preview';
const LISTE     = process.env.LISTE || path.join(__dirname, '..', 'data', 'kitap-listesi.json');
const LIMIT     = parseInt(process.env.LIMIT || '0', 10);
const DELAY_MS  = parseInt(process.env.DELAY_MS || '1200', 10);
const OVERWRITE = process.env.OVERWRITE === '1';

if (!ADMIN_KEY) { console.error('HATA: ADMIN_KEY tanımlı değil. (set ADMIN_KEY=...)'); process.exit(1); }
if (!OR_KEY)    { console.error('HATA: OPENROUTER_KEY tanımlı değil. (set OPENROUTER_KEY=sk-or-...)'); process.exit(1); }

let liste;
try { liste = JSON.parse(fs.readFileSync(LISTE, 'utf8')); }
catch (e) { console.error('HATA: liste dosyası okunamadı: ' + LISTE + '\n' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildPrompt(kitap, yazar) {
  return `Sen bir Türk edebiyatı uzmanısın. Aşağıdaki kitap için bir tanıtım kartı verisi üreteceksin. SADECE geçerli JSON döndür, başka hiçbir şey yazma.
Kitap: "${kitap}"${yazar ? ' — Yazar: ' + yazar : ''}
Şu JSON şemasına BİREBİR uy:
{
  "plain": "Kitabın düz adı",
  "title": "Kitap adı, vurgulanacak kelime <em>...</em> içinde (örn: Kurt <em>Kanunu</em>)",
  "authorName": "Yazarın tam adı",
  "dates": "Yazarın doğum-ölüm ve yeri (örn: 1910 — 1973 · İstanbul)",
  "pal": { "bg":"#hex", "c1":"#hex", "c2":"#hex", "acc":"#hex", "acc2":"#hex" },
  "stack": [["KELİME","c1"],["KELİME","c2"]],
  "notes": [
    {"tag":"Yazar","title":null,"p":"Yazar hakkında 1-2 cümle"},
    {"tag":"Dönem","title":"BAŞINDA YIL OLAN kısa başlık (örn: 1926 · İzmir Suikastı)","p":"Kitabın geçtiği/yazıldığı dönem, siyasi bağlam"},
    {"tag":"Yazarın Hayatından","title":"Kısa başlık","p":"Yazarın şahsi hayatından çarpıcı bilgi"},
    {"tag":"İlginç","title":"Kısa başlık","p":"Kitapla ilgili ilginç detay"}
  ],
  "summary": { "h":"Peki roman <em>neyi</em> anlatıyor?", "ps":["1. paragraf","2. paragraf"], "meta":[["1969","İlk baskı"],["Roman","Tür"],["Etiket","Açıklama"]] },
  "quote": "Kısa çarpıcı kapanış cümlesi, bir kelime <em>...</em> içinde",
  "bio": ["Yazar biyografisi 1. paragraf","2. paragraf"],
  "fact": "Yazar dosyasında çerçeveli gösterilecek çarpıcı bilgi",
  "works": [["Eser Adı","Yıl/Not"]],
  "category": "Kitabın türü — kısa (Roman, Tarihi Roman, Polisiye, Bilimkurgu, Distopya, Öykü, Şiir, Deneme, Felsefe, Anı, Fantastik gibi)"
}
KURALLAR:
- RENK OKUNABİLİRLİĞİ ÇOK ÖNEMLİ:
- bg (kapak zemini) koyu/orta-koyu olsun; c1 ve c2 bunun üstünde net okunacak kadar açık/parlak olsun.
- acc (sayfa vurgusu) KOYU bir renk olsun — hem açık bej zeminde yazı olacak, hem yazar panelinde arka plan olup üstüne BEYAZ yazı gelecek. Açık/parlak (açık sarı, bej, krem, açık pembe) OLMASIN; koyu kırmızı, bordo, lacivert, koyu yeşil, kahve gibi olsun.
- acc2 (koyu acc zemini üstünde küçük vurgu metni) AÇIK/parlak olsun (altın, açık sarı, krem) ki okunsun. Yani acc KOYU, acc2 AÇIK.
- stack: yazar adı + kitap adının kelimeleri, büyük harf, c1/c2 dönüşümlü.
- Dönem notunun title alanı MUTLAKA bir yılla başlasın (örn: 1926 · İzmir Suikastı).
- category kitabın gerçek türünü yansıtsın, kısa ve standart olsun.
- Bilgiler doğru ve gerçek olsun; uydurma. Emin olmadığın bilgide genel/temkinli yaz.
- SADECE JSON döndür.`;
}

async function askModel(kitap, yazar) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: buildPrompt(kitap, yazar) }],
      response_format: { type: 'json_object' }
    })
  });
  if (!r.ok) throw new Error('OpenRouter HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  let text = d?.choices?.[0]?.message?.content || '';
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  let book;
  try { book = JSON.parse(text); }
  catch (e) {
    const s = text.indexOf('{'), a = text.indexOf('[');
    const start = (a > -1 && (a < s || s === -1)) ? a : s;
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (start > -1 && end > start) book = JSON.parse(text.slice(start, end + 1));
    else throw new Error('Model JSON vermedi: ' + text.slice(0, 150));
  }
  if (Array.isArray(book)) book = book[0];
  return book;
}

async function ingest(book) {
  const r = await fetch(SITE + '/api/books/ingest', {
    method: 'POST',
    headers: { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(book)
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, slug: d.slug, cover: d.cover, error: d.error };
}

(async () => {
  let items = liste;
  if (LIMIT > 0) items = items.slice(0, LIMIT);
  console.log(`${items.length} kitap işlenecek (model: ${MODEL}).\n`);

  let ok = 0, skip = 0, fail = 0;
  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    const n = `[${i + 1}/${items.length}]`;
    try {
      const book = await askModel(b.title, b.author);
      if (!book || typeof book !== 'object') throw new Error('boş model cevabı');
      book.sourceUrl = b.bookUrl || '';
      if (OVERWRITE) book.overwrite = true;
      const res = await ingest(book);
      if (res.status === 200)      { ok++;   console.log(`${n} + ${b.title} — ${b.author}`); }
      else if (res.status === 409) { skip++; console.log(`${n} = ${b.title} (zaten var)`); }
      else                         { fail++; console.log(`${n} ! ${b.title}: ${res.error || res.status}`); }
    } catch (e) {
      fail++; console.log(`${n} ! ${b.title}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nBitti. Eklenen: ${ok} | Zaten vardı: ${skip} | Hata: ${fail}`);
})();
