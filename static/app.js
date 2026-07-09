const CATEGORIES = LEVELS.filter(l => l.category !== "mixed");
const PAGE_SIZE = 9;

let activeCategory = "all";
let deck = [];
let page = 0;
let germanVoice = null;

const categoryBarEl = document.getElementById("category-bar");
const gridEl = document.getElementById("grid");
const progressEl = document.getElementById("progress-label");

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

function wordsForCategory(cat) {
  if (cat === "all") return WORDS;
  return WORDS.filter(w => w.cat === cat);
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

function renderMedia(w) {
  if (w.type === "color") {
    return `<div class="swatch" style="background:${w.img}"></div>`;
  }
  if (w.type === "number") {
    return `<div class="numeral">${w.img}</div>`;
  }
  return `<div class="emoji">${w.img}</div>`;
}

function totalPages() {
  return Math.max(1, Math.ceil(deck.length / PAGE_SIZE));
}

function renderGrid() {
  gridEl.innerHTML = "";
  const start = page * PAGE_SIZE;
  const items = deck.slice(start, start + PAGE_SIZE);

  items.forEach(w => {
    const cell = document.createElement("div");
    cell.className = "flash-cell";
    cell.innerHTML = `
      ${renderMedia(w)}
      <div class="german-word">${w.de}</div>
      <div class="english-word">${w.en}</div>
    `;
    cell.onclick = () => speak(w.de);
    gridEl.appendChild(cell);
  });

  progressEl.textContent = deck.length === 0
    ? "0 words"
    : "page " + (page + 1) + " / " + totalPages();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "de-DE";
  if (germanVoice) utter.voice = germanVoice;
  window.speechSynthesis.speak(utter);
}

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
