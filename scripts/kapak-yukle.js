/* KAPAK YÜKLEYİCİ
 *
 * data/kapak-listesi.json içindeki her kitabın kapak URL'sini,
 * senin siteye (find-cover endpoint'i) gönderir. Server URL'den kapağı
 * indirip kitaba ekler. 1000kitap CDN'inden büyük (size:400) kapaklar.
 *
 * KULLANIM (VDS'te, roman-rafi klasöründe):
 *   set ADMIN_KEY=osman
 *   set LIMIT=3
 *   node scripts/kapak-yukle.js
 *
 * Önce LIMIT=3 ile test et (VDS bu CDN'e çıkabiliyor mu görelim),
 * çalışıyorsa LIMIT'i kaldırıp hepsini yükle.
 *
 * AYARLAR:
 *   ADMIN_KEY   site admin şifren                    [zorunlu]
 *   SITE        varsayılan http://localhost:3000
 *   LISTE       varsayılan data/kapak-listesi.json
 *   LIMIT       en fazla kaç kapak (test için; 0=hepsi)
 *   DELAY_MS    kapaklar arası bekleme (varsayılan 400)
 */

const fs = require('fs');
const path = require('path');

const ADMIN_KEY = process.env.ADMIN_KEY;
const SITE = process.env.SITE || 'http://localhost:3000';
const LISTE = process.env.LISTE || path.join(__dirname, '..', 'data', 'kapak-listesi.json');
const LIMIT = parseInt(process.env.LIMIT || '0', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '400', 10);

if (!ADMIN_KEY) { console.error('HATA: ADMIN_KEY tanımlı değil. (set ADMIN_KEY=...)'); process.exit(1); }

let liste;
try { liste = JSON.parse(fs.readFileSync(LISTE, 'utf8')); }
catch (e) { console.error('HATA: liste okunamadı: ' + LISTE + '\n' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function yukle(slug, coverUrl) {
  const r = await fetch(SITE + '/api/books/' + encodeURIComponent(slug) + '/find-cover', {
    method: 'POST',
    headers: { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coverUrl })
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, cover: d.cover, error: d.error };
}

(async () => {
  let items = liste;
  if (LIMIT > 0) items = items.slice(0, LIMIT);
  console.log(`${items.length} kapak yüklenecek.\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < items.length; i++) {
    const { slug, coverUrl } = items[i];
    const n = `[${i + 1}/${items.length}]`;
    try {
      const res = await yukle(slug, coverUrl);
      if (res.status === 200) { ok++; console.log(`${n} + ${slug} ✓`); }
      else { fail++; console.log(`${n} ! ${slug}: ${res.error || res.status}`); }
    } catch (e) {
      fail++; console.log(`${n} ! ${slug}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nBitti. Yüklenen: ${ok} | Hata: ${fail}`);
  if (fail > 0 && ok === 0) {
    console.log('\nHiç kapak inmedi — VDS 1000kitap CDN\'ine (r2.1k-cdn.com) çıkamıyor olabilir.');
  }
})();
