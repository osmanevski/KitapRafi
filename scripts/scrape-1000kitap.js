/* 1000KITAP KAZIYICI
 * Bir 1000kitap kitap listesi sayfasındaki tüm kitapları (ad + yazar + link)
 * çeker ve senin siteye "iskelet" olarak ekler. İçerikler (notlar, özet, bio)
 * boş gelir; sonra otomasyon/model ile doldurulur.
 *
 * Kullanım (VDS'te, roman-rafi klasöründe):
 *   node scripts/scrape-1000kitap.js "https://1000kitap.com/Osmanevski/kitaplari/okuduklari"
 *
 * Ayarlar (ortam değişkeni ile):
 *   ADMIN_KEY   -> site admin şifren (server.js ile aynı olmalı)
 *   SITE        -> site adresi (varsayılan http://localhost:3000)
 *   MAX_PAGES   -> en fazla kaç sayfa taransın (varsayılan 40)
 *   DELAY_MS    -> sayfalar arası bekleme (varsayılan 2500 ms — siteye kibar ol)
 */

const ADMIN_KEY = process.env.ADMIN_KEY || 'degistir-beni';
const SITE      = process.env.SITE || 'http://localhost:3000';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '40', 10);
const DELAY_MS  = parseInt(process.env.DELAY_MS || '2500', 10);

const listUrl = process.argv[2];
if (!listUrl) {
  console.error('Kullanım: node scripts/scrape-1000kitap.js "<1000kitap-liste-url>"');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Bir sayfanın HTML'inden kitapları ayıkla.
   1000kitap işaretlemesi: kitap başlığı bir <a href="/kitap/...">Ad</a>,
   hemen ardından yazar <a href="/yazar/...">Yazar</a>. Ham HTML üzerinde
   çalışır (markdown'a bağlı değil). */
function parseBooks(html) {
  const books = [];
  const seen = new Set();
  // tüm /kitap/ ve /yazar/ linklerini sırayla yakala
  const linkRe = /<a[^>]+href="(\/(?:kitap|yazar)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const tokens = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    tokens.push({ type: href.startsWith('/kitap/') ? 'kitap' : 'yazar', href, text });
  }
  // bir "kitap" tokenından sonra gelen ilk "yazar" tokenı o kitabın yazarıdır
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'kitap') continue;
    const slug = tokens[i].href;
    if (seen.has(slug)) continue;      // aynı kitap linki başlık+resim olarak 2 kez geçebilir
    // başlık: en uzun metinli olanı al (resim linkinde metin boş olur, zaten elendi)
    const title = tokens[i].text;
    if (!title || title.length < 2) continue;
    let author = '';
    for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
      if (tokens[j].type === 'yazar') { author = tokens[j].text; break; }
      if (tokens[j].type === 'kitap') break; // araya başka kitap girdiyse dur
    }
    seen.add(slug);
    books.push({ title, author, bookUrl: 'https://1000kitap.com' + slug });
  }
  return books;
}

/* Bir sonraki sayfa var mı? "?sayfa=N" linkini bul */
function hasNextPage(html, current) {
  return html.includes('sayfa=' + (current + 1));
}

async function fetchPage(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'tr-TR,tr;q=0.9'
    }
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

async function ingestBook(book) {
  const body = {
    plain: book.title,
    title: book.title,
    authorName: book.author || 'Bilinmeyen Yazar',
    sourceUrl: book.bookUrl,          // 1000kitap linki — panelde referans
    skipCover: true,                  // iskelet: kapak aramasını atla (hızlı)
    overwrite: false
  };
  const r = await fetch(SITE + '/api/books/ingest', {
    method: 'POST',
    headers: { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, slug: d.slug, error: d.error };
}

(async () => {
  const base = listUrl.split('?')[0];
  let all = [];
  console.log('Kaziyici basladi:', base);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = base + '?sayfa=' + page;
    let html;
    try {
      html = await fetchPage(url);
    } catch (e) {
      console.log(`  sayfa ${page}: HATA (${e.message}) — duruyorum`);
      break;
    }
    const books = parseBooks(html);
    if (books.length === 0) {
      console.log(`  sayfa ${page}: kitap yok — bitti`);
      break;
    }
    all = all.concat(books);
    console.log(`  sayfa ${page}: ${books.length} kitap (toplam ${all.length})`);
    if (!hasNextPage(html, page)) { console.log('  son sayfa'); break; }
    await sleep(DELAY_MS);
  }

  // aynı kitabı iki kez almayı önle (slug bazında)
  const uniq = [];
  const seen = new Set();
  for (const b of all) {
    const key = b.bookUrl;
    if (!seen.has(key)) { seen.add(key); uniq.push(b); }
  }

  console.log(`\nToplam ${uniq.length} benzersiz kitap bulundu. Siteye ekleniyor...\n`);

  let added = 0, skipped = 0, failed = 0;
  for (const b of uniq) {
    try {
      const res = await ingestBook(b);
      if (res.status === 200) { added++; console.log(`  + ${b.title} — ${b.author}`); }
      else if (res.status === 409) { skipped++; console.log(`  = ${b.title} (zaten var)`); }
      else { failed++; console.log(`  ! ${b.title}: ${res.error || res.status}`); }
    } catch (e) {
      failed++; console.log(`  ! ${b.title}: ${e.message}`);
    }
    await sleep(150); // siteye de kibar
  }

  console.log(`\nBitti. Eklenen: ${added} | Zaten vardı: ${skipped} | Hata: ${failed}`);
  console.log('Simdi otomasyon/model ile bu kitaplarin icerigini doldurabilirsin.');
})();
