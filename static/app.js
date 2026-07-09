const CATEGORIES = LEVELS.filter(l => l.category !== "mixed");
const PAGE_SIZE = 9;

let activeCategory = "all";
let deck = [];
let page = 0;
let germanVoice = null;
let quizMode = false;
let autoHide = false;
const revealed = new Set();

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
    cell.innerHTML = `
      ${renderMedia(w)}
      <div class="german-word">${w.de}</div>
      <div class="english-word">${w.en}</div>
    `;
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

function speak(text, cell) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  document.querySelectorAll(".flash-cell.speaking").forEach(c => c.classList.remove("speaking"));
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
