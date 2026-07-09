# Deutsch Flashcards — Flutter app

The same flashcards as the web app, as a native Android/iOS app with
proper on-device German text-to-speech (usually much better voices
than the browser).

## First-time setup

You need the [Flutter SDK](https://docs.flutter.dev/get-started/install)
and, for Android, Android Studio with an emulator or a phone with USB
debugging. Then, from this `mobile/` directory:

```
flutter create . --platforms=android,ios
flutter pub get
flutter run
```

`flutter create .` generates the android/ and ios/ platform folders
around the committed Dart code — it won't overwrite `lib/main.dart`
or `pubspec.yaml`.

## Features

- All categories from the web app, horizontal chip bar to filter
- Tap a card to hear the German word (on-device TTS, de-DE)
- Quiz mode (brain icon, top right): hides the German word until you
  tap; the eye icon toggles auto-hide of the previously revealed card;
  "hide all" button resets the board
- 2-column grid on phones, 3 on tablets

## Updating the vocabulary

The word list lives in the web app (`../static/words.js`). After
editing it, regenerate the app's copy:

```
node sync_words.mjs
```

and rebuild.
