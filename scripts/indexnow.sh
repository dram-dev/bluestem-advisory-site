#!/usr/bin/env bash
# Tells Bing, and through IndexNow every engine that shares it (Yandex, Seznam, Naver), that the
# site's pages changed, so they crawl them now rather than when they next get round to it.
# Bing's index is the one ChatGPT search, Copilot and DuckDuckGo answer from, so this is how the
# AI answer tools the principals allowed (2026-10-05) hear about a change.
#
#   bash scripts/indexnow.sh      every URL in site/sitemap.xml
#
# Run it AFTER a deploy that changes a page: IndexNow fetches the key file from the live site.
# The key is public by design: serving site/<key>.txt with the key inside proves we own the
# site. It grants nothing else and is not a secret. Sends only the sitemap's public URLs.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=679153e4c9a24c051d278ec7e12fec24
HOST=bluestem-advisory.com
[ -f "site/$KEY.txt" ] || { echo "indexnow: site/$KEY.txt is missing" >&2; exit 1; }
payload=$(python3 - "$KEY" "$HOST" <<'PY'
import json, re, sys
key, host = sys.argv[1:]
urls = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", open("site/sitemap.xml").read())
print(json.dumps({"host": host, "key": key, "keyLocation": f"https://{host}/{key}.txt", "urlList": urls}))
PY
)
code=$(curl -sS -o /dev/null -w '%{http_code}' -m 30 -X POST -H 'Content-Type: application/json; charset=utf-8' \
  --data "$payload" https://api.indexnow.org/indexnow)
case "$code" in
  200|202) echo "indexnow: accepted ($code) — $(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])["urlList"]))' "$payload") URLs" ;;
  403) echo "indexnow: 403, the key file isn't live yet — deploy first, then run this" >&2; exit 1 ;;
  422) echo "indexnow: 422, a URL isn't on $HOST" >&2; exit 1 ;;
  429) echo "indexnow: 429, too many submissions; try tomorrow" >&2; exit 1 ;;
  *) echo "indexnow: unexpected answer $code" >&2; exit 1 ;;
esac
