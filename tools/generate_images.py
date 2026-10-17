"""
Resumable FLUX.1-schnell image generator for deutsch-flashcards.

Run:  python tools/generate_images.py
Re-run safely — already-existing images are skipped automatically.
Ctrl+C safe — partial runs pick up from where they stopped.
"""

import json
import shutil
import signal
import sys
import time
from pathlib import Path

import torch
from diffusers import FluxPipeline
from PIL import Image
from torchao.quantization import quantize_, Int8WeightOnlyConfig

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent
JSONL      = ROOT / "tools" / "image_prompts.jsonl"
STATIC_DIR = ROOT / "static" / "img" / "words"
MOBILE_DIR = ROOT / "mobile" / "assets" / "img" / "words"
MODEL_ID   = "black-forest-labs/FLUX.1-schnell"
SEED       = 42

# ── Generation settings ──────────────────────────────────────────────────────
WIDTH, HEIGHT       = 512, 512
NUM_STEPS           = 4
GUIDANCE_SCALE      = 0.0   # required for schnell

# ── Graceful Ctrl+C ──────────────────────────────────────────────────────────
_stop = False

def _handle_sigint(sig, frame):
    global _stop
    print("\n[!] Ctrl+C received — finishing current image then stopping.")
    _stop = True

signal.signal(signal.SIGINT, _handle_sigint)

# ── Load prompts ─────────────────────────────────────────────────────────────
rows = [json.loads(line) for line in JSONL.read_text(encoding="utf-8").splitlines() if line.strip()]
total = len(rows)

# ── Check which are already done ─────────────────────────────────────────────
STATIC_DIR.mkdir(parents=True, exist_ok=True)
MOBILE_DIR.mkdir(parents=True, exist_ok=True)

pending = [r for r in rows if not (STATIC_DIR / f"{r['slug']}.jpg").exists()]
already_done = total - len(pending)

if not pending:
    print(f"All {total} images already exist — nothing to do.")
    sys.exit(0)

print(f"[setup] {already_done}/{total} already done. Generating {len(pending)} remaining.")

# ── Load pipeline ─────────────────────────────────────────────────────────────
# Strategy: quantize transformer to int8 (~8.5 GB) so it fits in VRAM alongside
# CLIP + VAE. T5-XXL (10 GB fp16) stays on CPU — text encoding is fast there.
print(f"[setup] Loading {MODEL_ID} ...")
# bfloat16, not float16: FLUX overflows in fp16 and outputs all-black images.
pipe = FluxPipeline.from_pretrained(MODEL_ID, dtype=torch.bfloat16)

# Quantize transformer to int8 (~8.5 GB) so it fits in VRAM during denoising.
# cpu_offload then swaps whole modules sequentially: T5 -> GPU briefly for
# text encoding, transformer -> GPU for all 4 denoising steps (no layer swapping).
print("[setup] Quantizing transformer to int8 ...")
quantize_(pipe.transformer, Int8WeightOnlyConfig())

pipe.enable_model_cpu_offload()
pipe.set_progress_bar_config(disable=True)

generator = torch.Generator("cpu").manual_seed(SEED)

# ── Generate ──────────────────────────────────────────────────────────────────
t0 = time.time()
generated = 0

for row in pending:
    if _stop:
        break

    slug    = row["slug"]
    prompt  = row["prompt"]
    out_jpg = STATIC_DIR / f"{slug}.jpg"
    mob_jpg = MOBILE_DIR / f"{slug}.jpg"

    # current index in the full list (for progress display)
    global_idx = rows.index(row) + 1

    # reset generator to fixed seed per image for reproducibility
    generator.manual_seed(SEED)

    image: Image.Image = pipe(
        prompt=prompt,
        width=WIDTH,
        height=HEIGHT,
        num_inference_steps=NUM_STEPS,
        guidance_scale=GUIDANCE_SCALE,
        generator=generator,
    ).images[0]

    image.save(str(out_jpg), format="JPEG", quality=92)
    shutil.copy2(out_jpg, mob_jpg)

    generated += 1
    done_so_far = already_done + generated
    elapsed = time.time() - t0
    avg_s   = elapsed / generated
    eta_s   = avg_s * (len(pending) - generated)
    print(f"[{done_so_far}/{total}] {slug}  ({avg_s:.1f}s/img, ETA {eta_s/60:.1f}min)", flush=True)

# ── Summary ───────────────────────────────────────────────────────────────────
elapsed = time.time() - t0
print(f"\n{'Done!' if not _stop else 'Stopped.'} "
      f"Generated {generated} images in {elapsed/60:.1f} min "
      f"({elapsed/generated:.1f}s/img avg)." if generated else "")
