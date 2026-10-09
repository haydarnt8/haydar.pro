#!/usr/bin/env python3
"""
The grain tile, `public/noise.png`: 256x256, monochrome, 16 grey levels, drawn
from the design's measured distribution (half clipped to black, an eighth to
white). Deterministic: `python3 scripts/generate-noise.py` gives the same bytes.
"""

import random
from pathlib import Path

from PIL import Image

# (grey level, share of the tile)
DISTRIBUTION = [
    (0, 0.5152), (18, 0.0333), (36, 0.0302), (54, 0.0308), (71, 0.0284),
    (86, 0.0246), (102, 0.0256), (118, 0.0251), (134, 0.0253), (150, 0.0212),
    (168, 0.0255), (188, 0.0262), (210, 0.0234), (231, 0.0177), (245, 0.0130),
    (255, 0.1345),
]

SIZE = 256
SEED = 20260916


def main() -> None:
    levels = [lvl for lvl, _ in DISTRIBUTION]
    weights = [w for _, w in DISTRIBUTION]
    rng = random.Random(SEED)

    # Palette mode, so the file is written at 4 bits per pixel.
    index = {lvl: i for i, lvl in enumerate(levels)}
    data = bytes(index[v] for v in rng.choices(levels, weights=weights, k=SIZE * SIZE))

    im = Image.frombytes("P", (SIZE, SIZE), data)
    palette = []
    for lvl in levels:
        palette += [lvl, lvl, lvl]
    im.putpalette(palette + [0, 0, 0] * (256 - len(levels)))

    out = Path(__file__).resolve().parent.parent / "public" / "noise.png"
    im.save(out, "PNG", optimize=True, bits=4)

    # The same tile at 8% alpha, for cards to carry under their own content.
    grain = out.with_name("grain.png")
    im.save(grain, "PNG", optimize=True, bits=4, transparency=bytes([round(0.08 * 255)] * len(levels)))

    mean = sum(lvl * w for lvl, w in DISTRIBUTION)
    var = sum(w * (lvl - mean) ** 2 for lvl, w in DISTRIBUTION)
    print(f"{out}  {out.stat().st_size:,} bytes  {SIZE}x{SIZE}  mean {mean:.1f}  stdev {var ** 0.5:.1f}")
    print(f"{grain}  {grain.stat().st_size:,} bytes  the same tile at 8% alpha")


if __name__ == "__main__":
    main()
