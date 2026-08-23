#!/usr/bin/env python3
"""books.json'daki boş 'year' alanlarını Open Library'den doldurur.
Sadece year == "" olan kitaplara bakar; dolu olanlara dokunmaz.
Sonuçları cache'e yazar; tekrar çalıştırmak ucuzdur."""
import json, re, time, urllib.parse, urllib.request, pathlib

HERE = pathlib.Path(__file__).resolve().parent
BOOKS = HERE / "books.json"
CACHE = HERE / ".ol-year-cache.json"

cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}

def lookup(title: str, author: str):
    key = f"{title}|{author}"
    if key in cache:
        return cache[key]
    q = urllib.parse.quote(f"{title} {author}".strip())
    url = f"https://openlibrary.org/search.json?q={q}&limit=20&fields=title,author_name,first_publish_year"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "osmanevski-book-catalog/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            docs = json.load(r).get("docs", [])
        t = re.sub(r"[^\w]", "", title.lower())
        # soyadla eşleştir ("J. R. R. Tolkien" → "tolkien")
        last = (author or "").split()
        a_last = re.sub(r"[^\w]", "", last[-1].lower()) if last else ""
        years = []
        for d in docs:
            fy = d.get("first_publish_year")
            if not fy or not d.get("title"):
                continue
            dt = re.sub(r"[^\w]", "", d["title"].lower())
            if t and not (t in dt or dt in t):
                continue
            if a_last:
                names = " ".join(d.get("author_name", [])).lower()
                # transliterasyon toleransı: Dostoyevski/Dostoevsky → ilk 5 harf
                if names and a_last[:5] not in re.sub(r"[^a-zçğıöşü ]", "", names):
                    continue
            years.append(fy)
        year = min(years) if years else None
        if not year:
            # fallback: alt başlığı at ("X - Alt Başlık" → X) ve yazar filtresini bırak
            base = title.split(" - ")[0].split(":")[0].strip()
            if base != title or True:
                q2 = urllib.parse.quote(base)
                url2 = f"https://openlibrary.org/search.json?q={q2}&limit=20&fields=title,first_publish_year"
                req2 = urllib.request.Request(url2, headers={"User-Agent": "osmanevski-book-catalog/1.0"})
                time.sleep(0.4)
                with urllib.request.urlopen(req2, timeout=15) as r:
                    docs2 = json.load(r).get("docs", [])
                tb = re.sub(r"[^\w]", "", base.lower())
                ys = [d["first_publish_year"] for d in docs2
                      if d.get("first_publish_year") and d.get("title")
                      and (tb in re.sub(r"[^\w]", "", d["title"].lower())
                           or re.sub(r"[^\w]", "", d["title"].lower()) in tb)]
                year = min(ys) if ys else None
        cache[key] = year
        return year
    except Exception as e:
        print(f"  ! {title}: {e}")
        return None

data = json.loads(BOOKS.read_text(encoding="utf-8"))
filled = 0
for b in data["books"]:
    if b.get("year"):
        continue
    y = lookup(b["title"], b["author"])
    time.sleep(0.4)  # rate-limit nazikliği
    if y:
        b["year"] = str(y)
        filled += 1
        print(f"  ✓ {b['title']} → {y}")
    else:
        print(f"  ? bulunamadı: {b['title']}")

BOOKS.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
print(f"{filled} kitaba yayın yılı eklendi.")
