const levelMapEl = document.getElementById("level-map");
const homeEl = document.getElementById("home");
const deckEl = document.getElementById("deck");
const cardsEl = document.getElementById("cards");

function wordsForLevel(level) {
  if (level.category === "mixed") {
    const cats = LEVELS.filter(l => l.id < 12).map(l => l.category);
    return WORDS.filter(w => cats.includes(w.cat));
  }
  return WORDS.filter(w => w.cat === level.category);
}

function renderHome() {
  deckEl.classList.add("hidden");
  homeEl.classList.remove("hidden");

  levelMapEl.innerHTML = "";
  LEVELS.forEach(level => {
    const wordCount = wordsForLevel(level).length;
    const card = document.createElement("button");
    card.className = "level-card";
    card.innerHTML = `
      <div class="level-num">${level.id}</div>
      <div class="level-name">${level.name}</div>
      <div class="level-meta">${wordCount} words</div>
    `;
    card.onclick = () => openDeck(level);
    levelMapEl.appendChild(card);
  });
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

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "de-DE";
  window.speechSynthesis.speak(utter);
}

function openDeck(level) {
  homeEl.classList.add("hidden");
  deckEl.classList.remove("hidden");
  document.getElementById("deck-title").textContent = level.name;

  cardsEl.innerHTML = "";
  wordsForLevel(level).forEach(w => {
    const card = document.createElement("button");
    card.className = "flashcard";
    card.type = "button";
    card.innerHTML = `
      <div class="card-en">${w.en}</div>
      ${renderMedia(w)}
      <div class="card-de">${w.de} <span class="speaker">&#128266;</span></div>
    `;
    card.onclick = () => speak(w.de);
    cardsEl.appendChild(card);
  });
}

document.getElementById("back-btn").onclick = renderHome;
renderHome();
