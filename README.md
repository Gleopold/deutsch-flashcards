# Deutsch Flashcards

A local Flask web app for browsing German vocabulary flashcards —
picture, English word, German word, and a click to hear it spoken aloud.

## Run it

```
pip install flask
python3 app.py
```

Then open http://localhost:5000

## What's inside

- 257 words grouped into 11 categories: pronouns, numbers, colors,
  family, days & months, everyday objects, animals, food & drink,
  basic verbs, adjectives, and basic phrases. An "All" view shows
  every word.
- Click a card (or press space) to hear the German word spoken using
  your browser's built-in text-to-speech.
- Use the prev/next buttons or arrow keys to move through the deck.

## Files

- `app.py` — Flask server
- `templates/index.html` — page markup
- `static/words.js` — the vocabulary data (edit this to add more words)
- `static/app.js` — flashcard logic (category filtering, navigation, speech)
- `static/style.css` — styling
- `mobile/` — Flutter app (Android/iOS) with the same cards and
  on-device German TTS; see `mobile/README.md` for build steps
