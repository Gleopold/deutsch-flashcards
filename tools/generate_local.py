"""
Generate flashcard pictures locally on Apple Silicon with FLUX.2 [klein] 4B (MLX, 4-bit)
via mflux. Each picture runs in a fresh `mflux-generate-flux2 --low-ram` process: on an
8 GB Mac that's ~40 s per picture, and faster than keeping one process alive (memory
pressure builds up and it starts swapping).

Run:  python3 tools/generate_local.py [--out DIR] [--seed N] [--force] [slug ...]
      (no slugs = every prompt in image_prompts.jsonl, most common words first;
       existing outputs are skipped, so it can be stopped and resumed)
Output: tools/out_klein/<slug>.jpg — review there, then copy into static/ and mobile/.
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLE = ("simple flat vector illustration, clean bold outlines, minimal shading, solid soft pastel colors, "
         "plain white background, centered, single clear subject, no text, no letters, no watermark")


def prompt_for(row):
    # image_prompts.jsonl prompts end with the old FLUX.1 style suffix; swap in ours
    return row["prompt"].split(", simple flat vector icon")[0] + ", " + STYLE


def frequency_order(slugs):
    """Most common words first, using the same ranking as the web app (frequency.js)."""
    words = (ROOT / "static" / "words.js").read_text()
    freq = re.findall(r'"([^"|]+)\|([^"]+)"', (ROOT / "static" / "frequency.js").read_text())
    rank = {}
    for i, (de, en) in enumerate(freq):
        m = re.search(r'\{ en: "' + re.escape(en) + r'", de: "' + re.escape(de) + r'"[^\n]*?img: "img/words/([^"]+)\.jpg"', words)
        if m:
            rank.setdefault(m.group(1), i)
    return sorted(slugs, key=lambda s: rank.get(s, 10**6))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--out", default=str(ROOT / "tools" / "out_klein"))
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--force", action="store_true", help="overwrite existing outputs")
    args = ap.parse_args()

    rows = {r["slug"]: r for r in map(json.loads, (ROOT / "tools" / "image_prompts.jsonl").read_text().splitlines()) if r}
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    slugs = args.slugs or frequency_order(list(rows))
    todo = [s for s in slugs if args.force or not (out / f"{s}.jpg").exists()]
    print(f"{len(todo)} to generate", flush=True)

    t0 = time.time()
    for i, slug in enumerate(todo, 1):
        with tempfile.TemporaryDirectory() as tmp:
            png = Path(tmp) / "out.png"
            r = subprocess.run(["uvx", "--from", "mflux", "--with", "pillow<13", "mflux-generate-flux2", "-m", "flux2-klein-4b",
                                "-q", "4", "--low-ram", "--steps", "4", "--seed", str(args.seed),
                                "--width", "512", "--height", "512", "--no-exif",
                                "--prompt", prompt_for(rows[slug]), "--output", str(png)],
                               capture_output=True, text=True)
            if r.returncode or not png.exists():
                print(f"[{i}/{len(todo)}] {slug} FAILED: {r.stderr[-300:]}", flush=True)
                continue
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "92",
                            str(png), "--out", str(out / f"{slug}.jpg")], capture_output=True, check=True)
        el = time.time() - t0
        print(f"[{i}/{len(todo)}] {slug}  {el / i:.0f}s/img, ETA {el / i * (len(todo) - i) / 60:.0f} min", flush=True)


if __name__ == "__main__":
    sys.exit(main())
