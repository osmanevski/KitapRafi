#!/usr/bin/env python3
"""Kitaplar.md (Notion aynası) → books.json üretir. Tek kaynak: ayna dosyası."""
import json, re, sys, pathlib

SRC = pathlib.Path.home() / "Projects" / "OsmanOS" / "Beyin" / "🧠 500-Knowledge" / "Notion-Aynası" / "Kitaplar.md"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "books.json"
# Yayın yılları: Open Library + elle doğrulanmış. Aynada bu veri yok;
# yeniden build yılları silmesin diye ayrı tutulur.
YEARS = pathlib.Path(__file__).resolve().parent / "yayin-yillari.json"
years = json.loads(YEARS.read_text(encoding="utf-8")) if YEARS.exists() else {}

text = SRC.read_text(encoding="utf-8")
rows = []
for line in text.splitlines():
    line = line.strip()
    if not line.startswith("|") or line.startswith("|---"):
        continue
    cells = [c.strip() for c in line.strip("|").split("|")]
    if len(cells) < 7 or cells[0] in ("Kitaplar", "Kitap"):
        continue
    title, author, genre, status, lang, pages, dates = cells[:7]
    date = ""
    m = re.search(r"\d{4}-\d{2}-\d{2}", dates)
    if m:
        date = m.group(0)
    # Yıl sütunu = kitabın yayın yılı; aynada yoksa bitirme tarihine düş
    year = years.get(title) or (date[:4] if date else "")
    rows.append({
        "title": title,
        "author": author,
        "genre": genre or "",
        "status": status or "",
        "lang": lang or "",
        "pages": int(pages) if pages.isdigit() else None,
        "date": date,
        "year": year,
    })

meta = {"exported": "", "count": len(rows)}
m = re.search(r"^exported:\s*(.+)$", text, re.M)
if m:
    meta["exported"] = m.group(1).strip()

OUT.write_text(json.dumps({"meta": meta, "books": rows}, ensure_ascii=False), encoding="utf-8")
print(f"{len(rows)} kitap -> {OUT}")
