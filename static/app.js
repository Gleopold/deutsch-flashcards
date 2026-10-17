const CATEGORIES = LEVELS.filter(l => l.category !== "mixed");
const PAGE_SIZE = 9;

let activeCategory = "all";
let deck = [];
let page = 0;
let germanVoice = null;
let quizMode = false;
let autoHide = false;
let audioManifest = {};
const revealed = new Set();
const audioCache = new Map();

fetch("static/audio/manifest.json")
  .then(r => r.ok ? r.json() : {})
  .then(m => { audioManifest = m; })
  .catch(() => {});

const categoryBarEl = document.getElementById("category-bar");
const gridEl = document.getElementById("grid");
const progressEl = document.getElementById("progress-label");
const navRowEl = document.querySelector(".nav-row");
const quizToggleEl = document.getElementById("quiz-toggle");
const resetBtnEl = document.getElementById("reset-btn");
const floatingControlsEl = document.getElementById("floating-controls");
const autoHideToggleEl = document.getElementById("autohide-toggle");

function pickGermanVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const deVoices = voices.filter(v => v.lang.toLowerCase().startsWith("de"));
  if (deVoices.length === 0) return null;
  const preferred = deVoices.find(v => /google|natural|online/i.test(v.name));
  return preferred || deVoices[0];
}

if ("speechSynthesis" in window) {
  germanVoice = pickGermanVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    germanVoice = pickGermanVoice();
  };
}

function wordKey(w) {
  return w.de + "|" + w.en;
}

// Most common words in everyday speech first (see frequency.js).
const FREQ_RANK = new Map(FREQ_ORDER.map((k, i) => [k, i]));
const WORDS_BY_FREQ = WORDS
  .map((w, i) => ({ w, i, r: FREQ_RANK.has(wordKey(w)) ? FREQ_RANK.get(wordKey(w)) : Infinity }))
  .sort((a, b) => a.r - b.r || a.i - b.i)
  .map(x => x.w);

function wordsForCategory(cat) {
  if (cat === "all") return WORDS_BY_FREQ;
  return WORDS_BY_FREQ.filter(w => w.cat === cat);
}

function renderCategoryBar() {
  categoryBarEl.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "cat-btn" + (activeCategory === "all" ? " active" : "");
  allBtn.textContent = "All";
  allBtn.onclick = () => selectCategory("all");
  categoryBarEl.appendChild(allBtn);

  CATEGORIES.forEach(level => {
    const btn = document.createElement("button");
    btn.className = "cat-btn" + (activeCategory === level.category ? " active" : "");
    btn.textContent = level.name;
    btn.onclick = () => selectCategory(level.category);
    categoryBarEl.appendChild(btn);
  });
}

function selectCategory(cat) {
  activeCategory = cat;
  deck = wordsForCategory(cat);
  page = 0;
  renderCategoryBar();
  renderGrid();
}

function graphemeCount(str) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(str)].length;
  }
  return [...str].length;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function handleIllusError(img) {
  const emoji = img.dataset.fallback || "";
  const div = document.createElement("div");
  div.className = graphemeCount(emoji) > 1 ? "emoji emoji-multi" : "emoji";
  div.textContent = emoji;
  img.replaceWith(div);
}
window.handleIllusError = handleIllusError;

function renderMedia(w) {
  if (w.type === "color") {
    return `<div class="swatch" style="background:${w.img}"></div>`;
  }
  if (w.type === "number") {
    const cls = w.img.length > 3 ? "numeral numeral-sm" : "numeral";
    return `<div class="${cls}">${w.img}</div>`;
  }
  if (w.type === "illustration") {
    return `<div class="illus"><img src="static/${w.img}" alt="${escapeAttr(w.en)}" loading="lazy" data-fallback="${escapeAttr(w.fallback || "")}" onerror="handleIllusError(this)"></div>`;
  }
  const cls = graphemeCount(w.img) > 1 ? "emoji emoji-multi" : "emoji";
  return `<div class="${cls}">${w.img}</div>`;
}

function pageSize() {
  return activeCategory === "all" ? deck.length : PAGE_SIZE;
}

function totalPages() {
  return Math.max(1, Math.ceil(deck.length / pageSize()));
}

function renderGrid() {
  revealed.clear();
  gridEl.innerHTML = "";
  const size = pageSize();
  const start = page * size;
  const items = deck.slice(start, start + size);

  items.forEach((w, i) => {
    const key = start + i;
    const cell = document.createElement("div");
    cell.className = "flash-cell" + (quizMode ? " quiz-hidden" : "");
    cell.dataset.key = wordKey(w);
    const reportBtn = w.type === "illustration"
      ? `<button class="report-btn${reportedKeys.has(wordKey(w)) ? " reported" : ""}" title="report bad picture" aria-label="report bad picture">&#9873;</button>`
      : "";
    cell.innerHTML = `
      ${reportBtn}
      <div class="media">${renderMedia(w)}</div>
      <div class="german-word">${w.de}</div>
      <div class="english-word">${w.en}</div>
    `;
    const btn = cell.querySelector(".report-btn");
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        toggleReport(w);
      };
    }
    cell.onclick = () => {
      if (quizMode && !revealed.has(key)) {
        if (autoHide) {
          revealed.clear();
          gridEl.querySelectorAll(".flash-cell").forEach(c => c.classList.add("quiz-hidden"));
        }
        revealed.add(key);
        cell.classList.remove("quiz-hidden");
      }
      speak(w.de, cell);
    };
    gridEl.appendChild(cell);
  });

  const pages = totalPages();
  navRowEl.classList.toggle("hidden", pages <= 1);
  progressEl.textContent = deck.length === 0
    ? "0 words"
    : (pages <= 1 ? deck.length + " words" : "page " + (page + 1) + " / " + pages);
}

function speakWithBrowserTts(text, cell) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "de-DE";
  utter.rate = 0.85;
  if (germanVoice) utter.voice = germanVoice;
  if (cell) {
    cell.classList.add("speaking");
    utter.onend = () => cell.classList.remove("speaking");
    utter.onerror = () => cell.classList.remove("speaking");
  }
  window.speechSynthesis.speak(utter);
}

function speak(text, cell) {
  document.querySelectorAll(".flash-cell.speaking").forEach(c => c.classList.remove("speaking"));

  const fname = audioManifest[text];
  if (fname) {
    let audio = audioCache.get(fname);
    if (!audio) {
      audio = new Audio("static/audio/" + fname);
      audioCache.set(fname, audio);
    }
    audio.currentTime = 0;
    if (cell) {
      cell.classList.add("speaking");
      audio.onended = () => cell.classList.remove("speaking");
    }
    audio.play().catch(() => speakWithBrowserTts(text, cell));
    return;
  }

  speakWithBrowserTts(text, cell);
}

// ── Reported pictures ─────────────────────────────────────────────────────
// Stored on the server (api/reports) so reports from every device end up in
// one list; each word appears at most once.
let reports = [];
let reportedKeys = new Set();
const reportsToggleEl = document.getElementById("reports-toggle");
const reportsPanelEl = document.getElementById("reports-panel");
const reportsListEl = document.getElementById("reports-list");
const reportsCountEl = document.getElementById("reports-count");

function setReports(list) {
  reports = Array.isArray(list) ? list : [];
  reportedKeys = new Set(reports.map(r => r.key));
  reportsCountEl.textContent = reports.length;
  gridEl.querySelectorAll(".flash-cell").forEach(cell => {
    const btn = cell.querySelector(".report-btn");
    if (btn) btn.classList.toggle("reported", reportedKeys.has(cell.dataset.key));
  });
  renderReportsList();
}

function reportsRequest(method, query, body) {
  return fetch("api/reports" + (query || ""), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(setReports)
    .catch(() => {});
}

function toggleReport(w) {
  const key = wordKey(w);
  if (reportedKeys.has(key)) {
    reportsRequest("DELETE", "?key=" + encodeURIComponent(key));
  } else {
    reportsRequest("POST", "", { key, de: w.de, en: w.en, cat: w.cat, img: w.img });
  }
}

function renderReportsList() {
  reportsListEl.innerHTML = "";
  if (reports.length === 0) {
    reportsListEl.innerHTML = '<li class="reports-empty">nothing reported yet</li>';
    return;
  }
  reports.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `<img src="static/${escapeAttr(r.img)}" alt=""><span><b></b> · <i></i></span><button class="cat-btn" title="remove">&times;</button>`;
    li.querySelector("b").textContent = r.de;
    li.querySelector("i").textContent = r.en;
    li.querySelector("button").onclick = () =>
      reportsRequest("DELETE", "?key=" + encodeURIComponent(r.key));
    reportsListEl.appendChild(li);
  });
}

function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v) {
  return '"' + String(v ?? "").replace(/"/g, '""') + '"';
}

reportsToggleEl.onclick = () => {
  const open = reportsPanelEl.classList.toggle("hidden") === false;
  reportsToggleEl.classList.toggle("active", open);
  if (open) reportsRequest("GET");
};

document.getElementById("export-json").onclick = () =>
  downloadFile("reported-pictures.json", JSON.stringify(reports, null, 2), "application/json");

document.getElementById("export-csv").onclick = () => {
  const cols = ["de", "en", "cat", "img", "reported_at"];
  const rows = [cols.join(",")].concat(reports.map(r => cols.map(c => csvCell(r[c])).join(",")));
  downloadFile("reported-pictures.csv", rows.join("\n") + "\n", "text/csv");
};

document.getElementById("reports-clear").onclick = () => {
  if (reports.length && confirm("Remove all " + reports.length + " reported pictures?")) {
    reportsRequest("DELETE");
  }
};

reportsRequest("GET");

quizToggleEl.onclick = () => {
  quizMode = !quizMode;
  quizToggleEl.classList.toggle("active", quizMode);
  floatingControlsEl.classList.toggle("hidden", !quizMode);
  renderGrid();
};

resetBtnEl.onclick = () => {
  renderGrid();
};

autoHideToggleEl.onclick = () => {
  autoHide = !autoHide;
  autoHideToggleEl.textContent = "auto-hide: " + (autoHide ? "on" : "off");
  autoHideToggleEl.classList.toggle("active", autoHide);
};

document.getElementById("prev-btn").onclick = () => {
  page = (page - 1 + totalPages()) % totalPages();
  renderGrid();
};

document.getElementById("next-btn").onclick = () => {
  page = (page + 1) % totalPages();
  renderGrid();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") document.getElementById("prev-btn").click();
  if (e.key === "ArrowRight") document.getElementById("next-btn").click();
});

selectCategory("all");
