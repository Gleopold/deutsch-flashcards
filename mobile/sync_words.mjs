// Regenerates assets/words.json from the web app's static/words.js
// so the vocabulary stays single-source. Run from the mobile/ directory:
//   node sync_words.mjs
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("../static/words.js", "utf8");
const { LEVELS, WORDS } = new Function(src + "; return { LEVELS, WORDS };")();
writeFileSync(
  "assets/words.json",
  JSON.stringify({ levels: LEVELS, words: WORDS }, null, 1)
);
console.log(`synced ${LEVELS.length} levels, ${WORDS.length} words`);
