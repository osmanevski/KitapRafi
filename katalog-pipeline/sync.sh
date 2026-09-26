#!/bin/bash
# sync.sh — Kitaplar.md (Notion aynası) -> books.json -> servis-sunucu
# launchd (com.osmanevski.kitap-katalogu-sync) her 5 dakikada çağırır;
# içerik değişmemişse hiçbir şey yapmaz. Canlıda Caddy /kitaprafi/books.json
# yolunu /opt/kitaprafi-katalog/books.json dosyasından sunar, konteyner yeniden
# build edilmez.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$HOME/.cache/kitap-katalogu"
JSON="$CACHE/books.json"
STATE="$CACHE/last-hash"
REMOTE="servis-sunucu:/opt/kitaprafi-katalog/books.json"

mkdir -p "$CACHE"
/usr/bin/python3 "$HERE/build.py" --out "$JSON" >/dev/null

NEW_HASH=$(shasum -a 256 "$JSON" | cut -d' ' -f1)
OLD_HASH=$(cat "$STATE" 2>/dev/null || echo "")
[ "$NEW_HASH" = "$OLD_HASH" ] && exit 0

if rsync -az --chmod=F644 -e "ssh -o ConnectTimeout=15" --timeout=30 "$JSON" "$REMOTE.tmp" \
   && ssh -o ConnectTimeout=15 servis-sunucu "mv /opt/kitaprafi-katalog/books.json.tmp /opt/kitaprafi-katalog/books.json"; then
    echo "$NEW_HASH" > "$STATE"
    echo "$(date '+%F %T') gönderildi $(python3 -c "import json;print(json.load(open('$JSON'))['meta'])")"
fi
