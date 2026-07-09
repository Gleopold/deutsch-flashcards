import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';

const bg = Color(0xFF10151A);
const surface = Color(0xFF1A2129);
const surface2 = Color(0xFF212B34);
const border = Color(0xFF2C3944);
const textColor = Color(0xFFEEF2F5);
const textDim = Color(0xFF8FA1AC);
const accent = Color(0xFFF2C14E);

void main() {
  runApp(const FlashcardsApp());
}

class Level {
  final int id;
  final String name;
  final String category;

  Level.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        category = j['category'];
}

class Word {
  final String en;
  final String de;
  final String cat;
  final String img;
  final String type;

  Word.fromJson(Map<String, dynamic> j)
      : en = j['en'],
        de = j['de'],
        cat = j['cat'],
        img = j['img'],
        type = j['type'];
}

class FlashcardsApp extends StatelessWidget {
  const FlashcardsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Deutsch Flashcards',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: bg,
        colorScheme: const ColorScheme.dark(
          primary: accent,
          surface: surface,
        ),
        fontFamily: 'Roboto',
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final FlutterTts tts = FlutterTts();

  List<Level> levels = [];
  List<Word> words = [];
  String activeCategory = 'all';
  bool quizMode = false;
  bool autoHide = false;
  final Set<Word> revealed = {};
  Word? speaking;

  @override
  void initState() {
    super.initState();
    _loadData();
    _initTts();
  }

  Future<void> _initTts() async {
    await tts.setLanguage('de-DE');
    await tts.setSpeechRate(0.45);
    tts.setCompletionHandler(() => setState(() => speaking = null));
    tts.setCancelHandler(() => setState(() => speaking = null));
  }

  Future<void> _loadData() async {
    final raw = await rootBundle.loadString('assets/words.json');
    final data = jsonDecode(raw) as Map<String, dynamic>;
    setState(() {
      levels = (data['levels'] as List)
          .map((j) => Level.fromJson(j))
          .where((l) => l.category != 'mixed')
          .toList();
      words = (data['words'] as List).map((j) => Word.fromJson(j)).toList();
    });
  }

  List<Word> get deck => activeCategory == 'all'
      ? words
      : words.where((w) => w.cat == activeCategory).toList();

  Future<void> _speak(Word w) async {
    await tts.stop();
    setState(() => speaking = w);
    await tts.speak(w.de);
  }

  void _tapCard(Word w) {
    if (quizMode && !revealed.contains(w)) {
      setState(() {
        if (autoHide) revealed.clear();
        revealed.add(w);
      });
    }
    _speak(w);
  }

  void _hideAll() => setState(() => revealed.clear());

  @override
  Widget build(BuildContext context) {
    final cols = MediaQuery.of(context).size.width > 600 ? 3 : 2;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: bg,
        elevation: 0,
        title: RichText(
          text: const TextSpan(
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.w700, color: textColor),
            children: [
              TextSpan(text: 'Deutsch'),
              TextSpan(text: 'Flashcards', style: TextStyle(color: accent)),
            ],
          ),
        ),
        actions: [
          if (quizMode)
            IconButton(
              tooltip: 'Auto-hide previous card: ${autoHide ? "on" : "off"}',
              icon: Icon(Icons.visibility_off,
                  color: autoHide ? accent : textDim),
              onPressed: () => setState(() => autoHide = !autoHide),
            ),
          IconButton(
            tooltip: 'Quiz mode',
            icon: Icon(Icons.psychology, color: quizMode ? accent : textDim),
            onPressed: () => setState(() {
              quizMode = !quizMode;
              revealed.clear();
            }),
          ),
        ],
      ),
      floatingActionButton: quizMode
          ? FloatingActionButton.extended(
              backgroundColor: accent,
              foregroundColor: const Color(0xFF1A1A1A),
              onPressed: _hideAll,
              icon: const Icon(Icons.refresh),
              label: const Text('hide all'),
            )
          : null,
      body: words.isEmpty
          ? const Center(child: CircularProgressIndicator(color: accent))
          : Column(
              children: [
                SizedBox(
                  height: 48,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      _categoryChip('all', 'All'),
                      for (final l in levels) _categoryChip(l.category, l.name),
                    ],
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: cols,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.85,
                    ),
                    itemCount: deck.length,
                    itemBuilder: (context, i) => _card(deck[i]),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _categoryChip(String cat, String label) {
    final active = activeCategory == cat;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => setState(() {
          activeCategory = cat;
          revealed.clear();
        }),
        selectedColor: accent,
        backgroundColor: surface2,
        labelStyle: TextStyle(
          color: active ? const Color(0xFF1A1A1A) : textDim,
          fontWeight: active ? FontWeight.w600 : FontWeight.w400,
        ),
        side: BorderSide(color: active ? accent : border),
        showCheckmark: false,
      ),
    );
  }

  Widget _card(Word w) {
    final hidden = quizMode && !revealed.contains(w);
    final isSpeaking = speaking == w;

    return GestureDetector(
      onTap: () => _tapCard(w),
      child: Container(
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSpeaking ? accent : border,
            width: isSpeaking ? 2 : 1,
          ),
        ),
        padding: const EdgeInsets.all(10),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _media(w),
            const SizedBox(height: 10),
            Visibility(
              visible: !hidden,
              maintainSize: true,
              maintainAnimation: true,
              maintainState: true,
              child: Text(
                w.de,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: accent,
                ),
              ),
            ),
            Text(
              w.en,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: textDim,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _media(Word w) {
    if (w.type == 'color') {
      final hex = int.parse(w.img.substring(1), radix: 16) | 0xFF000000;
      return Container(
        width: 64,
        height: 64,
        decoration: BoxDecoration(
          color: Color(hex),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white24, width: 2),
        ),
      );
    }
    if (w.type == 'number') {
      return Text(
        w.img,
        style: TextStyle(
          fontSize: w.img.length > 3 ? 30 : 44,
          fontWeight: FontWeight.w700,
          color: accent,
        ),
      );
    }
    final multi = w.img.runes.length > 2;
    return Text(
      w.img,
      textAlign: TextAlign.center,
      style: TextStyle(fontSize: multi ? 34 : 52),
    );
  }
}
