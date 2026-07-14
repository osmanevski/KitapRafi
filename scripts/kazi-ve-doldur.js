/* 1000KITAP → OTOMATİK KAZI + DOLDUR
 *
 * Tek script: 1000kitap listenden kitapları çeker, her biri için OpenRouter'a
 * sorup içeriği (notlar, özet, yazar dosyası, kategori, renk) doldurtur ve
 * kapakla birlikte siteye ekler. n8n'e dokunmaz.
 *
 * KULLANIM (VDS'te, kitaprafi klasöründe):
 *   Windows CMD:
 *     set ADMIN_KEY=osman
 *     set OPENROUTER_KEY=sk-or-v1-...
 *     node scripts/kazi-ve-doldur.js "https://1000kitap.com/Osmanevski/kitaplari/okuduklari"
 *
 * AYARLAR (ortam değişkeni):
 *   ADMIN_KEY       site admin şifren (server.js ile aynı)          [zorunlu]
 *   OPENROUTER_KEY  OpenRouter API anahtarın (sk-or-...)            [zorunlu]
 *   SITE            site adresi (varsayılan http://localhost:3000)
 *   MODEL           model adı (varsayılan google/gemini-3-flash-preview)
 *   DELAY_MS        her kitap arası bekleme (varsayılan 1500 ms)
 *   PAGE_DELAY_MS   liste sayfaları arası bekleme (varsayılan 2500 ms)
 *   MAX_PAGES       en fazla kaç liste sayfası (varsayılan 40)
 *   LIMIT           en fazla kaç kitap işlensin (test için, örn: 3)
 *   OVERWRITE       "1" ise mevcut kitabın üzerine yaz (varsayılan atla)
 */

const ADMIN_KEY = process.env.ADMIN_KEY;
const OR_KEY    = process.env.OPENROUTER_KEY;
const SITE      = process.env.SITE || 'http://localhost:3000';
const MODEL     = process.env.MODEL || 'google/gemini-3-flash-preview';
const DELAY_MS      = parseInt(process.env.DELAY_MS || '1500', 10);
const PAGE_DELAY_MS = parseInt(process.env.PAGE_DELAY_MS || '2500', 10);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '40', 10);
const LIMIT     = parseInt(process.env.LIMIT || '0', 10);
const OVERWRITE = process.env.OVERWRITE === '1';

const listUrl = process.argv[2];

if (!listUrl) { console.error('Kullanım: node scripts/kazi-ve-doldur.js "<1000kitap-liste-url>"'); process.exit(1); }
if (!ADMIN_KEY) { console.error('HATA: ADMIN_KEY tanımlı değil. (set ADMIN_KEY=...)'); process.exit(1); }
if (!OR_KEY) { console.error('HATA: OPENROUTER_KEY tanımlı değil. (set OPENROUTER_KEY=sk-or-...)'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/* ---- 1000kitap liste sayfasından kitap + kapak ayıkla ---- */
function parseBooks(html) {
  const books = [];
  const seen = new Set();
  // hem <a href=/kitap|/yazar> hem <img src> yakala (img, a içinde de olabilir)
  const tokenRe = /<a[^>]+href="(\/(?:kitap|yazar)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>|<img[^>]+(?:data-src|data-original|src)="([^"]+)"/g;
  const tokens = [];
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1]) {
      // a etiketinin İÇİNDEKİ img'i de ayrıca yakala (kapak linki)
      const inner = m[2];
      const im = inner.match(/<img[^>]+(?:data-src|data-original|src)="([^"]+)"/);
      const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      tokens.push({ kind: m[1].startsWith('/kitap/') ? 'kitap' : 'yazar', href: m[1], text, img: im ? im[1] : '' });
    } else if (m[3]) {
      tokens.push({ kind: 'img', src: m[3] });
    }
  }
  const isCover = s => s && /1k-cdn|1000kitap|cdn/.test(s) && /\.(jpe?g|png|webp)/i.test(s);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'kitap' || !t.text || t.text.length < 2) continue;
    const slug = t.href;
    if (seen.has(slug)) continue;
    const title = t.text;
    // kapak: bu kitap linkinin kendi içindeki img, yoksa yakın img token'ı
    let cover = isCover(t.img) ? t.img : '';
    if (!cover) {
      for (let j = Math.max(0, i - 2); j < Math.min(i + 3, tokens.length); j++) {
        const c = tokens[j].kind === 'img' ? tokens[j].src : tokens[j].img;
        if (isCover(c)) { cover = c; break; }
      }
    }
    // yazar: bu kitaptan SONRA gelen ilk yazar (başka kitap gelmeden önce)
    let author = '';
    for (let j = i + 1; j < Math.min(i + 5, tokens.length); j++) {
      if (tokens[j].kind === 'kitap') break;
      if (tokens[j].kind === 'yazar') { author = tokens[j].text; break; }
    }
    if (cover && cover.startsWith('//')) cover = 'https:' + cover;
    seen.add(slug);
    books.push({ title, author, bookUrl: 'https://1000kitap.com' + slug, cover });
  }
  return books;
}

async function fetchPage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

/* ---- prompt (n8n'deki ile aynı mantık: kategori + renk okunabilirlik dahil) ---- */
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
  "category": "Kitabın türü — kısa (Roman, Tarihi Roman, Polisiye, Öykü, Şiir, Deneme, Anı, Distopya gibi)"
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

/* ---- ana akış ---- */
(async () => {
  const base = listUrl.split('?')[0];
  console.log('Liste taraniyor:', base);
  let all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let html;
    try { html = await fetchPage(base + '?sayfa=' + page); }
    catch (e) { console.log(`  sayfa ${page}: HATA ${e.message} — duruyorum`); break; }
    const books = parseBooks(html);
    if (!books.length) { console.log(`  sayfa ${page}: kitap yok — bitti`); break; }
    all = all.concat(books);
    console.log(`  sayfa ${page}: ${books.length} kitap (toplam ${all.length})`);
    if (!html.includes('sayfa=' + (page + 1))) { console.log('  son sayfa'); break; }
    await sleep(PAGE_DELAY_MS);
  }

  // benzersizleştir
  const uniq = [];
  const seen = new Set();
  for (const b of all) { if (!seen.has(b.bookUrl)) { seen.add(b.bookUrl); uniq.push(b); } }
  let liste = uniq;
  if (LIMIT > 0) liste = liste.slice(0, LIMIT);

  console.log(`\n${liste.length} kitap islenecek (kapakli: ${liste.filter(b=>b.cover).length}).\n`);

  let ok = 0, skip = 0, fail = 0;
  for (let i = 0; i < liste.length; i++) {
    const b = liste[i];
    const n = `[${i + 1}/${liste.length}]`;
    try {
      const book = await askModel(b.title, b.author);
      if (!book || typeof book !== 'object') throw new Error('bos model cevabi');
      // 1000kitap kapak URL'sini ekle (server indirmeyi deneyecek)
      if (b.cover) book.coverUrl = b.cover;
      book.sourceUrl = b.bookUrl;
      if (OVERWRITE) book.overwrite = true;
      const res = await ingest(book);
      if (res.status === 200) { ok++; console.log(`${n} + ${b.title} — ${b.author} ${res.cover ? '(kapak ✓)' : '(kapak yok)'}`); }
      else if (res.status === 409) { skip++; console.log(`${n} = ${b.title} (zaten var)`); }
      else { fail++; console.log(`${n} ! ${b.title}: ${res.error || res.status}`); }
    } catch (e) {
      fail++; console.log(`${n} ! ${b.title}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nBitti. Eklenen: ${ok} | Zaten vardi: ${skip} | Hata: ${fail}`);
})();
