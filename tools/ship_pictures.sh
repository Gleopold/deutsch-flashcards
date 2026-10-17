#!/usr/bin/env bash
# Copy reviewed pictures from tools/out_klein into the app (web + mobile), deploy,
# and clear "bad picture" reports for the words that got a new picture.
#   bash tools/ship_pictures.sh slug1 slug2 ...
set -euo pipefail
cd "$(dirname "$0")/.."
for s in "$@"; do
  cp "tools/out_klein/$s.jpg" "static/img/words/$s.jpg"
  cp "tools/out_klein/$s.jpg" "mobile/assets/img/words/$s.jpg"
done
bash push-flashcards.sh >/dev/null
# words.js maps slug -> "de|en" report key
node -e '
const fs=require("fs");const {WORDS}=new Function(fs.readFileSync("static/words.js","utf8")+";return {WORDS}")();
const want=new Set(process.argv.slice(1));
for(const w of WORDS) if(w.img&&want.has(w.img.replace(/^img\/words\/|\.jpg$/g,""))) console.log(encodeURIComponent(w.de+"|"+w.en));
' "$@" | while read -r key; do
  curl -s -o /dev/null -X DELETE "https://app.virtup.eu/flashcards/api/reports?key=$key"
done
echo "shipped $# pictures"
