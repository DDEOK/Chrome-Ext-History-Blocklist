#!/usr/bin/env python3
"""`image/` 의 원본 캡처를 Chrome 웹스토어 규격 스크린샷으로 바꾼다.

스토어는 **1280×800 또는 640×400** 만 받고, PNG 는 **알파 없는 24비트**여야 한다.
화면 캡처는 그 비율이 아니고 보통 RGBA 라 그대로는 못 올린다.

    python3 tools/prepare_screenshots.py            # image/*.png → store/screenshots/
    python3 tools/prepare_screenshots.py --focus top   # 위쪽을 남기고 자른다

비율이 안 맞으면 **가운데를 기준으로 잘라낸다**(`--focus` 로 위/아래 기준 변경). 여백을 덧대지
않는 이유는 스토어가 레터박스를 권하지 않기 때문이다 — 화면 전체가 내용이어야 잘 보인다.
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "image"
OUT = ROOT / "store" / "screenshots"
TARGET = (1280, 800)
TARGET_RATIO = TARGET[0] / TARGET[1]


def crop_to_ratio(im: Image.Image, focus: str) -> Image.Image:
    width, height = im.size
    ratio = width / height

    if abs(ratio - TARGET_RATIO) < 0.001:
        return im

    if ratio > TARGET_RATIO:  # 가로가 넓다 → 좌우를 자른다
        new_width = round(height * TARGET_RATIO)
        offset = (width - new_width) // 2
        return im.crop((offset, 0, offset + new_width, height))

    # 세로가 길다 → 위아래를 자른다
    new_height = round(width / TARGET_RATIO)
    spare = height - new_height
    top = {"top": 0, "bottom": spare}.get(focus, spare // 2)
    return im.crop((0, top, width, top + new_height))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--focus", choices=("top", "center", "bottom"), default="center")
    args = parser.parse_args()

    sources = sorted(p for p in SRC.glob("*.png") if not p.name.startswith("."))
    if not sources:
        print(f"{SRC.relative_to(ROOT)} 에 PNG 가 없다", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    for index, path in enumerate(sources, start=1):
        im = Image.open(path)
        original = im.size
        # 알파를 흰 배경에 합성하지 않고 **버린다** — 화면 캡처의 알파는 의미가 없고,
        # 흰색으로 합성하면 다크 UI 가장자리에 흰 테가 생긴다.
        im = im.convert("RGB")
        im = crop_to_ratio(im, args.focus).resize(TARGET, Image.Resampling.LANCZOS)

        out = OUT / f"screenshot-{index}.png"
        im.save(out, "PNG")
        print(f"{path.name}  {original[0]}×{original[1]} → {out.relative_to(ROOT)}  1280×800 RGB")

    print(f"\n{len(sources)}장 준비됨. 스토어는 최대 5장까지 받는다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
