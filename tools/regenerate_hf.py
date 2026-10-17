"""
Regenerate selected flashcard images with FLUX.1-schnell via the public
Hugging Face space — for machines without a big GPU.

Run:  uv run --no-project --with gradio_client --with pillow \
          python tools/regenerate_hf.py slug1 slug2 ...
      (or pass --black to redo every image that is solid black / unreadable)

Uses the same prompts, seed and step count as generate_images.py, and writes
to both static/ and mobile/ like it does.
"""

import json
import sys
import time
from pathlib import Path

from gradio_client import Client
from PIL import Image, ImageStat

ROOT       = Path(__file__).resolve().parent.parent
JSONL      = ROOT / "tools" / "image_prompts.jsonl"
STATIC_DIR = ROOT / "static" / "img" / "words"
MOBILE_DIR = ROOT / "mobile" / "assets" / "img" / "words"
SPACE      = "black-forest-labs/FLUX.1-schnell"
SEED       = 42


def is_bad(path):
    try:
        stat = ImageStat.Stat(Image.open(path).convert("L"))
    except Exception:
        return True
    return stat.mean[0] < 8 and stat.stddev[0] < 4


rows = {r["slug"]: r for r in map(json.loads, JSONL.read_text(encoding="utf-8").splitlines()) if r}
args = sys.argv[1:]
if args == ["--black"]:
    slugs = [s for s in rows if is_bad(STATIC_DIR / f"{s}.jpg")]
else:
    slugs = args
unknown = [s for s in slugs if s not in rows]
if unknown:
    sys.exit(f"unknown slugs: {unknown}")

client = Client(SPACE)
print(f"{len(slugs)} images to generate", flush=True)
for i, slug in enumerate(slugs, 1):
    for attempt in range(5):
        try:
            result, _ = client.predict(
                prompt=rows[slug]["prompt"], seed=SEED, randomize_seed=False,
                width=512, height=512, num_inference_steps=4, api_name="/infer",
            )
            break
        except Exception as e:
            wait = 30 * (attempt + 1)
            print(f"  {slug}: {str(e)[:120]} — retrying in {wait}s", flush=True)
            time.sleep(wait)
    else:
        print(f"[{i}/{len(slugs)}] {slug} FAILED", flush=True)
        continue
    img = Image.open(result).convert("RGB")
    if ImageStat.Stat(img.convert("L")).mean[0] < 8:
        print(f"[{i}/{len(slugs)}] {slug} came back black, skipped", flush=True)
        continue
    for d in (STATIC_DIR, MOBILE_DIR):
        img.save(d / f"{slug}.jpg", format="JPEG", quality=92)
    print(f"[{i}/{len(slugs)}] {slug}", flush=True)
