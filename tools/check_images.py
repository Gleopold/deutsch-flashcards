"""
Flag bad flashcard pictures with a small local vision model (Apple Silicon, MLX).

Run:  uv run --no-project --with mlx-vlm python tools/check_images.py [slug ...]
Writes tools/image_check.json: {slug: {"ok": bool, "issues": [...], "raw": "..."}}.
Already-checked slugs are skipped, so it can be stopped and resumed.
"""

import json
import re
import sys
from pathlib import Path

from mlx_vlm import generate, load
from mlx_vlm.prompt_utils import apply_chat_template

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "static" / "img" / "words"
OUT = ROOT / "tools" / "image_check.json"
MODEL = "mlx-community/Qwen3-VL-4B-Instruct-4bit"

QUESTION = """This picture is a flashcard for the English word/phrase: "{en}".
Inspect it carefully and answer each line with yes or no:
MATCH: does the picture clearly illustrate "{en}" so a learner would guess it?
HANDS: does any hand have the wrong number of fingers, fused or extra fingers, or a malformed shape?
BODY: are any faces, arms, legs or bodies distorted, duplicated or anatomically wrong?
TEXT: does the picture contain any letters, words or numbers?
BLANK: is the picture empty, black, or almost featureless?
Reply with exactly five lines, e.g. "MATCH: yes"."""


def parse(raw):
    ans = {k: v.lower() for k, v in re.findall(r"(MATCH|HANDS|BODY|TEXT|BLANK)\s*:\s*(yes|no)", raw, re.I)}
    issues = []
    if ans.get("MATCH") == "no":
        issues.append("does not match word")
    for k, label in (("HANDS", "bad hands"), ("BODY", "distorted body"), ("TEXT", "contains text"), ("BLANK", "blank")):
        if ans.get(k) == "yes":
            issues.append(label)
    if len(ans) < 5:
        issues.append("unparsed answer")
    return issues


def main():
    rows = {r["slug"]: r for r in map(json.loads, (ROOT / "tools" / "image_prompts.jsonl").read_text().splitlines()) if r}
    done = json.loads(OUT.read_text()) if OUT.exists() else {}
    slugs = sys.argv[1:] or sorted(p.stem for p in IMG.glob("*.jpg"))
    todo = [s for s in slugs if s not in done or sys.argv[1:]]
    model, processor = load(MODEL)
    for i, slug in enumerate(todo, 1):
        en = rows.get(slug, {}).get("en", slug.replace("_", " "))
        prompt = apply_chat_template(processor, model.config, QUESTION.format(en=en), num_images=1)
        raw = generate(model, processor, prompt, [str(IMG / f"{slug}.jpg")], max_tokens=40,
                       temperature=0.0, verbose=False)
        raw = getattr(raw, "text", raw)
        issues = parse(raw)
        done[slug] = {"en": en, "ok": not issues, "issues": issues, "raw": raw.strip()}
        print(f"[{i}/{len(todo)}] {slug}: {'ok' if not issues else ', '.join(issues)}", flush=True)
        if i % 10 == 0:
            OUT.write_text(json.dumps(done, indent=1, ensure_ascii=False))
    OUT.write_text(json.dumps(done, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
