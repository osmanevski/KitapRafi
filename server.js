/* KİTAP RAFI — sunucu
 * Çalıştırma:  npm install && node server.js
 * Site:        http://localhost:3000
 * Admin:       http://localhost:3000/admin.html
 * Admin şifresi ZORUNLU ortam değişkeniyle verilir (kodda gömülü şifre yok):
 *   Windows:  set ADMIN_KEY=guclu-sifre && node server.js
 *   PM2:      pm2 restart kitaprafi --update-env  (ADMIN_KEY set edildikten sonra)
 * ADMIN_KEY ayarlı değilse admin paneli güvenlik için devre dışı kalır.
 */
const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const dns     = require('dns').promises;
const net     = require('net');

const ADMIN_KEY = process.env.ADMIN_KEY || '';
if (!ADMIN_KEY) console.warn('UYARI: ADMIN_KEY ortam değişkeni ayarlı değil — admin paneli devre dışı.');
const PORT      = process.env.PORT || 3000;

const DATA_FILE   = path.join(__dirname, 'data', 'books.json');
const AUTHORS_FILE = path.join(__dirname, 'data', 'authors.json');
const UPLOAD_DIR  = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
// Caddy reverse proxy arkasında: gerçek istemci IP'si için (rate-limit doğru çalışsın)
app.set('trust proxy', 1);

/* --- kapak görseli yükleme ---
   GÜVENLİK: dosya adı/uzantısı istemciden ALINMAZ. Uzantı yalnız izin verilen
   görsel mime'larından türetilir; böylece .svg/.html gibi çalıştırılabilir
   uzantılar uploads'a yazılamaz (aynı-origin depolanan XSS engellenir). */
const IMG_EXT = { 'image/png':'png', 'image/jpeg':'jpg', 'image/jpg':'jpg', 'image/webp':'webp', 'image/gif':'gif' };
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = IMG_EXT[String(file.mimetype).toLowerCase()] || 'png';
    const rand = crypto.randomBytes(4).toString('hex');
    cb(null, Date.now() + '-' + rand + '.' + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, Object.prototype.hasOwnProperty.call(IMG_EXT, String(file.mimetype).toLowerCase()))
});

app.use(express.json({ limit: '2mb' }));
// yüklenen dosyalar: içerik-tipi tahmini kapalı (nosniff) — savunma derinliği
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));
app.use(express.static(path.join(__dirname, 'public')));

/* --- yardımcılar --- */
const load = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const save = (books) => fs.writeFileSync(DATA_FILE, JSON.stringify(books, null, 2));

const loadAuthors = () => {
  try { return JSON.parse(fs.readFileSync(AUTHORS_FILE, 'utf8')); }
  catch { return []; }
};
const saveAuthors = (authors) => fs.writeFileSync(AUTHORS_FILE, JSON.stringify(authors, null, 2));

const TR = { 'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u','Ç':'c','Ğ':'g','İ':'i','I':'i','Ö':'o','Ş':'s','Ü':'u' };
const slugify = (s) => s
  .replace(/[çğıöşüÇĞİIÖŞÜ]/g, ch => TR[ch])
  .toLowerCase()
  .replace(/<[^>]+>/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const authorId = (name) => 'yzr-' + slugify(name || 'bilinmeyen');

/* Bir yazarı authors listesinde bul ya da oluştur/güncelle.
   info: {name, dates, bio, fact, works} — dolu alanlar mevcut boşları doldurur. */
function upsertAuthor(authors, info) {
  const id = authorId(info.name);
  let a = authors.find(x => x.id === id);
  if (!a) {
    a = { id, name: info.name || 'Bilinmeyen Yazar', dates: '', bio: [], fact: '', works: [] };
    authors.push(a);
  }
  // yeni bilgi geldiyse ve doluysa güncelle (boş gelen eskiyi silmez)
  if (info.name) a.name = info.name;
  if (info.dates) a.dates = info.dates;
  if (Array.isArray(info.bio) && info.bio.length) a.bio = info.bio;
  if (info.fact) a.fact = info.fact;
  if (Array.isArray(info.works) && info.works.length) a.works = info.works;
  return a;
}

/* Eski format kitaplardan (yazar bilgisi gömülü) authors.json'a taşı.
   Açılışta bir kez çalışır; kitaplara authorId ekler, gömülü alanları temizlemez
   (geri uyumluluk) ama okuma hep authors.json'dan yapılır. */
function migrateAuthors() {
  let books;
  try { books = load(); } catch { return; }
  const authors = loadAuthors();
  let changed = false;
  for (const b of books) {
    if (!b.authorId && b.authorName) {
      upsertAuthor(authors, { name: b.authorName, dates: b.dates, bio: b.bio, fact: b.fact, works: b.works });
      b.authorId = authorId(b.authorName);
      changed = true;
    }
  }
  if (changed) { saveAuthors(authors); save(books); }
}

/* Admin anahtarı karşılaştırması — sabit zamanlı (timing sızıntısı yok). */
function keyMatches(provided) {
  if (!ADMIN_KEY || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_KEY);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* Basit, bağımlılıksız IP-başına brute-force limiti (yalnız başarısız denemeleri sayar).
   15 dakikada 20 başarısız denemeden sonra kısa süre kilitler. */
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_FAILS = 20;
const authFails = new Map(); // ip -> { count, resetAt }
setInterval(() => { const now = Date.now(); for (const [ip, e] of authFails) if (now > e.resetAt) authFails.delete(ip); }, AUTH_WINDOW_MS).unref();

function clientIp(req) { return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown'; }
function tooManyFails(ip) { const e = authFails.get(ip); return !!e && Date.now() <= e.resetAt && e.count >= AUTH_MAX_FAILS; }
function recordFail(ip) {
  const now = Date.now();
  let e = authFails.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + AUTH_WINDOW_MS }; authFails.set(ip, e); }
  e.count++;
}
function clearFails(ip) { authFails.delete(ip); }

const auth = (req, res, next) => {
  const ip = clientIp(req);
  if (tooManyFails(ip))
    return res.status(429).json({ error: 'Çok fazla başarısız deneme. Biraz sonra tekrar dene.' });
  if (keyMatches(req.headers['x-admin-key'])) { clearFails(ip); return next(); }
  recordFail(ip);
  return res.status(401).json({ error: 'Yetkisiz. Admin şifresi hatalı.' });
};

/* --- SSRF koruması: bir IP özel/loopback/link-local/metadata mı? --- */
function isPrivateIP(ip) {
  if (!ip) return true;
  ip = ip.toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 ||
           (a === 169 && b === 254) ||                 // link-local / metadata
           (a === 172 && b >= 16 && b <= 31) ||
           (a === 192 && b === 168) ||
           a >= 224;                                    // multicast/reserved
  }
  // IPv6: loopback, unique-local (fc00::/7), link-local (fe80::/10), unspecified
  return ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb');
}

/* Hostname'in TÜM çözümlenen IP'leri public mi? Değilse fırlat. */
async function assertPublicHost(hostname) {
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length) throw new Error('host çözümlenemedi');
  for (const { address } of addrs)
    if (isPrivateIP(address)) throw new Error('özel/iç adres reddedildi: ' + hostname);
}

/* SSRF-güvenli fetch: her hop'ta host doğrulanır, redirect'ler elle takip edilir. */
async function safeFetch(rawUrl, maxRedirects = 3) {
  let current = rawUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    let u;
    try { u = new URL(current); } catch { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    await assertPublicHost(u.hostname); // özel IP ise fırlatır -> downloadCover yakalar
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    let r;
    try { r = await fetch(u.href, { signal: ctrl.signal, redirect: 'manual' }); }
    finally { clearTimeout(to); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      current = new URL(r.headers.get('location'), u).href; // sonraki hop yeniden doğrulanır
      continue;
    }
    return r;
  }
  return null; // çok fazla redirect
}

/* --- URL'den kapak indir (Gemini'nin verdiği link) ---
   Erişilemezse null döner; site CSS kapağa düşer, çökmez.
   SSRF: safeFetch iç/özel adresleri ve doğrulanmamış redirect'leri engeller. */
async function downloadCover(url) {
  try {
    if (!/^https?:\/\//i.test(url)) return null;
    const r = await safeFetch(url);
    if (!r || !r.ok) return null;
    const type = (r.headers.get('content-type') || '').toLowerCase();
    const m = type.match(/^image\/(png|jpe?g|webp|gif)/);
    if (!m) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024 || buf.length < 500) return null;
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const name = Date.now() + '-cover.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return '/uploads/' + name;
  } catch { return null; }
}

/* --- Google Books'tan kapak URL'si bul (anahtar gerektirmez) ---
   coverUrl boş geldiğinde otomatik denenir. Bulamazsa null. */
async function findCoverViaGoogleBooks(title, author) {
  try {
    const q = [title, author].filter(Boolean).join(' ');
    const url = 'https://www.googleapis.com/books/v1/volumes?country=TR&maxResults=5&q=' + encodeURIComponent(q);
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    const d = await r.json();
    for (const it of (d.items || [])) {
      const img = it.volumeInfo && it.volumeInfo.imageLinks;
      if (img) {
        // en büyük mevcut boyutu seç, http->https, kıvrık kenar/zoom parametrelerini temizle
        let link = img.extraLarge || img.large || img.medium || img.thumbnail || img.smallThumbnail;
        if (link) return link.replace(/^http:/i, 'https:').replace(/&edge=curl/gi, '').replace(/&zoom=\d+/gi, '');
      }
    }
    return null;
  } catch { return null; }
}

/* --- basit renk paleti üreticisi (Gemini renk vermezse) --- */
function autoPalette(seed) {
  let h = 0;
  for (const ch of (seed || 'kitap')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const bg   = `hsl(${h} 62% 34%)`;
  const c1   = `hsl(${(h + 40) % 360} 55% 62%)`;
  const c2   = `hsl(${(h + 200) % 360} 30% 55%)`;
  return { bg, c1, c2, acc: bg, acc2: c1 };
}

/* --- gelen kitabı şemaya oturt, eksikleri tamamla --- */
function normalizeBook(raw) {
  const b = { ...raw };
  const em = s => (s == null ? '' : String(s));
  b.plain = em(b.plain || b.title || 'Adsız').replace(/<[^>]+>/g, '').trim();
  if (!b.title) b.title = b.plain;
  b.authorName = em(b.authorName || 'Bilinmeyen Yazar').trim();
  b.dates = em(b.dates || '');

  // palet
  if (!b.pal || !b.pal.bg) b.pal = autoPalette(b.plain + b.authorName);
  for (const k of ['bg', 'c1', 'c2', 'acc', 'acc2'])
    if (!b.pal[k]) b.pal[k] = autoPalette(b.plain)[k];

  // stack — yoksa yazar + başlık kelimelerinden üret
  if (!Array.isArray(b.stack) || !b.stack.length) {
    const words = [...b.authorName.split(/\s+/), ...b.plain.split(/\s+/)];
    b.stack = words.filter(Boolean).map((w, i) => [w.toUpperCase(), i % 2 ? 'c2' : 'c1']);
  }

  // notlar — tam 4 tane olacak; ilkinin başlığı null (yazar adı kullanılır)
  const defTags = ['Yazar', 'Dönem', 'Yazarın Hayatından', 'İlginç'];
  const notes = Array.isArray(b.notes) ? b.notes.slice(0, 4) : [];
  while (notes.length < 4) notes.push({});
  b.notes = notes.map((n, i) => ({
    tag: em(n.tag || defTags[i]),
    title: i === 0 ? null : em(n.title || ''),
    p: em(n.p || '')
  }));

  // özet
  const s = b.summary || {};
  b.summary = {
    h: em(s.h || 'Peki roman <em>neyi</em> anlatıyor?'),
    ps: Array.isArray(s.ps) && s.ps.length ? s.ps.map(em) : [em(s.text || '')].filter(Boolean),
    meta: Array.isArray(s.meta) ? s.meta.map(m => Array.isArray(m) ? m.map(em) : [em(m), '']) : []
  };
  if (!b.summary.ps.length) b.summary.ps = ['(özet eklenmedi)'];

  b.quote = em(b.quote || '');
  b.bio = Array.isArray(b.bio) ? b.bio.map(em) : (b.bio ? [em(b.bio)] : []);
  b.fact = em(b.fact || '');
  b.works = Array.isArray(b.works)
    ? b.works.map(w => Array.isArray(w) ? w.map(em) : [em(w), '']) : [];
  if (raw.sourceUrl) b.sourceUrl = em(raw.sourceUrl);  // 1000kitap referans linki
  // kategori (tür): model üretir; yoksa "Roman"
  b.category = em(b.category || 'Roman').replace(/<[^>]+>/g, '').trim() || 'Roman';

  return b;
}

/* --- API --- */

/* Kitapları, her birine ait yazar dosyası ve o yazarın SİTEDE EKLİ
   kitaplarının linkli listesiyle birlikte döndürür. Ön yüz tek çağrıyla
   her şeye sahip olur. */
function booksWithAuthors() {
  const books = load();
  const authors = loadAuthors();
  const byId = Object.fromEntries(authors.map(a => [a.id, a]));

  // her yazarın sitede ekli kitapları (sıra korunur)
  const siteBooksByAuthor = {};
  for (const b of books) {
    const aid = b.authorId || authorId(b.authorName);
    (siteBooksByAuthor[aid] = siteBooksByAuthor[aid] || []).push({ slug: b.slug, plain: b.plain });
  }

  return books.map(b => {
    const aid = b.authorId || authorId(b.authorName);
    const a = byId[aid];
    // yazar dosyası: authors.json'dan; yoksa kitaptaki eski alanlara düş
    const author = a || { id: aid, name: b.authorName, dates: b.dates, bio: b.bio || [], fact: b.fact || '', works: b.works || [] };
    // eserler listesine "sitede ekli mi" bilgisi ekle (tıklanabilirlik için)
    const siteList = siteBooksByAuthor[aid] || [];
    const norm = s => slugify((s || '').replace(/<[^>]+>/g, ''));
    const works = (author.works || []).map(w => {
      const wName = Array.isArray(w) ? w[0] : w;
      const wYear = Array.isArray(w) ? (w[1] || '') : '';
      const hit = siteList.find(sb => norm(sb.plain) === norm(wName) || sb.slug === norm(wName));
      return { name: wName, year: wYear, slug: hit ? hit.slug : null };
    });
    return {
      ...b,
      authorId: aid,
      author: {
        id: author.id || aid, name: author.name, dates: author.dates || '',
        bio: author.bio || [], fact: author.fact || '', works,
        siteBooks: siteList   // bu yazarın sitedeki TÜM kitapları {slug, plain}
      }
    };
  });
}

app.get('/api/books', (req, res) => res.json(booksWithAuthors()));

app.get('/api/authors', (req, res) => res.json(loadAuthors()));

app.put('/api/authors/:id', auth, (req, res) => {
  try {
    const authors = loadAuthors();
    const i = authors.findIndex(a => a.id === req.params.id);
    const body = req.body || {};
    const info = {
      name: body.name, dates: body.dates,
      bio: Array.isArray(body.bio) ? body.bio : undefined,
      fact: body.fact,
      works: Array.isArray(body.works) ? body.works : undefined
    };
    if (i < 0) {
      // yoksa oluştur
      const a = upsertAuthor(authors, { name: body.name || 'Bilinmeyen', dates: body.dates, bio: body.bio, fact: body.fact, works: body.works });
      saveAuthors(authors);
      return res.json(a);
    }
    // var olanı doğrudan güncelle (boş gönderirsen boşaltabilirsin)
    const a = authors[i];
    if (body.name !== undefined) a.name = body.name;
    if (body.dates !== undefined) a.dates = body.dates;
    if (body.bio !== undefined) a.bio = Array.isArray(body.bio) ? body.bio : [];
    if (body.fact !== undefined) a.fact = body.fact;
    if (body.works !== undefined) a.works = Array.isArray(body.works) ? body.works : [];
    saveAuthors(authors);
    res.json(a);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/auth', (req, res) => {
  const ip = clientIp(req);
  if (tooManyFails(ip))
    return res.status(429).json({ ok: false, error: 'Çok fazla başarısız deneme. Biraz sonra tekrar dene.' });
  const ok = keyMatches(req.headers['x-admin-key']);
  if (ok) clearFails(ip); else recordFail(ip);
  res.json({ ok });
});

app.post('/api/books', auth, upload.single('cover'), (req, res) => {
  try {
    const books = load();
    const book  = JSON.parse(req.body.book);
    book.slug = book.slug || slugify(book.plain || 'kitap');
    if (books.some(b => b.slug === book.slug))
      return res.status(400).json({ error: 'Bu isimde bir kitap zaten var: ' + book.slug });
    if (req.file) book.cover = '/uploads/' + req.file.filename;
    // yazar: ilk kez geliyorsa dosyasını oluştur; zaten varsa DOKUNMA
    const authors = loadAuthors();
    const aid = authorId(book.authorName);
    if (!authors.find(a => a.id === aid)) {
      upsertAuthor(authors, { name: book.authorName, dates: book.dates, bio: book.bio, fact: book.fact, works: book.works });
      saveAuthors(authors);
    }
    book.authorId = aid;
    books.push(book);
    save(books);
    res.json(book);
  } catch (e) { res.status(400).json({ error: 'Geçersiz veri: ' + e.message }); }
});

app.put('/api/books/:slug', auth, upload.single('cover'), (req, res) => {
  try {
    const books = load();
    const i = books.findIndex(b => b.slug === req.params.slug);
    if (i < 0) return res.status(404).json({ error: 'Kitap bulunamadı' });
    const book = JSON.parse(req.body.book);
    book.slug  = req.params.slug;
    if (req.file) {
      book.cover = '/uploads/' + req.file.filename;
    } else if (book.removeCover) {
      delete book.cover;
    } else {
      book.cover = books[i].cover;
    }
    delete book.removeCover;
    book.authorId = authorId(book.authorName);
    books[i] = book;
    save(books);
    res.json(book);
  } catch (e) { res.status(400).json({ error: 'Geçersiz veri: ' + e.message }); }
});

app.delete('/api/books/:slug', auth, (req, res) => {
  const books = load();
  const i = books.findIndex(b => b.slug === req.params.slug);
  if (i < 0) return res.status(404).json({ error: 'Kitap bulunamadı' });
  const [removed] = books.splice(i, 1);
  save(books);
  res.json({ ok: true, removed: removed.slug });
});

/* --- n8n / Gemini otomasyon girişi ---
   JSON gövde (multipart değil). Gelen ham kitabı normalize eder,
   coverUrl varsa indirir, ekler veya (varsa) günceller.
   Gövde: kitap objesi + opsiyonel { coverUrl, overwrite:true }  */
app.post('/api/books/ingest', auth, async (req, res) => {
  try {
    const raw = req.body || {};
    const book = normalizeBook(raw);
    book.slug = book.slug || slugify(book.plain);

    // kapak: coverUrl geldiyse indir; boşsa Google Books'tan bulmayı dene
    // (skipCover:true ise hiç arama yapma — kaziyici iskelet eklerken kullanılır)
    let coverUrl = raw.coverUrl || raw.cover;
    if (!raw.skipCover) {
      if (!coverUrl || !/^https?:\/\//i.test(coverUrl)) {
        coverUrl = await findCoverViaGoogleBooks(book.plain, book.authorName);
      }
      if (coverUrl && /^https?:\/\//i.test(coverUrl)) {
        const local = await downloadCover(coverUrl);
        if (local) book.cover = local; else delete book.cover;
      }
    }
    delete book.coverUrl;
    delete book.overwrite;
    delete book.skipCover;

    // yazar: ilk kez geliyorsa dosyasını oluştur; zaten varsa DOKUNMA
    // (aynı yazarın 2. kitabı mevcut yazar dosyasını ezmesin)
    const authors = loadAuthors();
    const aid = authorId(book.authorName);
    book.authorId = aid;
    if (!authors.find(a => a.id === aid)) {
      upsertAuthor(authors, { name: book.authorName, dates: book.dates, bio: book.bio, fact: book.fact, works: book.works });
      saveAuthors(authors);
    }

    const books = load();
    const i = books.findIndex(b => b.slug === book.slug);
    if (i >= 0) {
      if (!raw.overwrite)
        return res.status(409).json({ error: 'Bu kitap zaten var: ' + book.slug + '. Güncellemek için overwrite:true gönder.', slug: book.slug });
      if (!book.cover && books[i].cover) book.cover = books[i].cover; // eski kapağı koru
      books[i] = book;
    } else {
      books.push(book);
    }
    save(books);
    res.json({ ok: true, slug: book.slug, updated: i >= 0, cover: book.cover || null });
  } catch (e) {
    res.status(400).json({ error: 'Ingest hatası: ' + e.message });
  }
});

/* --- tek kitaba Google Books'tan kapak bul & ata (panel butonu) --- */
app.post('/api/books/:slug/find-cover', auth, async (req, res) => {
  try {
    const books = load();
    const i = books.findIndex(b => b.slug === req.params.slug);
    if (i < 0) return res.status(404).json({ error: 'Kitap bulunamadı' });
    // gövdede coverUrl geldiyse onu kullan; yoksa Google Books'tan bul
    let url = (req.body && req.body.coverUrl) ? req.body.coverUrl : null;
    if (!url) url = await findCoverViaGoogleBooks(books[i].plain, books[i].authorName);
    if (!url) return res.status(404).json({ error: 'Kapak bulunamadı. Elle yükleyebilirsin.' });
    const local = await downloadCover(url);
    if (!local) return res.status(502).json({ error: 'Kapak bulundu ama indirilemedi.' });
    books[i].cover = local;
    save(books);
    res.json({ ok: true, cover: local });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* sıralama: gövdede { order: ["slug1","slug2",...] } */
app.put('/api/order', auth, (req, res) => {
  const books = load();
  const order = req.body.order || [];
  books.sort((a, b) => {
    const ia = order.indexOf(a.slug), ib = order.indexOf(b.slug);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  save(books);
  res.json({ ok: true });
});

migrateAuthors();

app.listen(PORT, () => {
  console.log('Kitap Rafı çalışıyor →  http://localhost:' + PORT);
  console.log('Admin paneli        →  http://localhost:' + PORT + '/admin.html');
  console.log('Admin şifresi       →  ' + (ADMIN_KEY ? '(ortam değişkeninden)' : 'AYARLI DEĞİL — admin devre dışı'));
});
