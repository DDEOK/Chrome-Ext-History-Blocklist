#!/usr/bin/env python3
"""`image/` 의 원본 캡처를 Chrome 웹스토어 규격 스크린샷으로 바꾼다.

스토어는 **1280×800 또는 640×400** 만 받고, PNG 는 **알파 없는 24비트**여야 한다.
화면 캡처는 그 비율이 아니고 보통 RGBA 라 그대로는 못 올린다.

    python3 tools/prepare_screenshots.py                       # 전부 가운데 기준
    python3 tools/prepare_screenshots.py --focus top           # 기본 기준을 바꾼다
    python3 tools/prepare_screenshots.py screenshot_01=right   # 파일별로 다르게

비율이 안 맞으면 잘라낸다. **기준을 파일마다 정할 수 있어야 한다** — 팝업이 오른쪽 끝에 붙은
캡처를 가운데로 자르면 그 팝업이 잘리고, 세로로 긴 설정 화면을 가운데로 자르면 제목과 통계가
동시에 날아간다. 실제로 둘 다 밟았다.

기준값은 잘리는 축에만 적용된다 — 가로가 넓으면 `left|center|right`, 세로가 길면
`top|center|bottom`. 여백을 덧대지 않는 이유는 스토어가 레터박스를 권하지 않기 때문이다.

**자른 뒤에는 결과를 눈으로 본다.** 이 스크립트는 무엇이 잘려나갔는지 알려주지만, 그것이
중요한 부분인지는 사람만 안다.
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


HORIZONTAL = ("left", "center", "right")
VERTICAL = ("top", "center", "bottom")


def crop_to_ratio(im: Image.Image, focus: str) -> tuple[Image.Image, str]:
    """비율을 1.6 으로 맞춰 자르고, 어느 쪽을 얼마나 버렸는지 함께 돌려준다."""
    width, height = im.size
    ratio = width / height

    if abs(ratio - TARGET_RATIO) < 0.001:
        return im, "자르지 않음"

    if ratio > TARGET_RATIO:  # 가로가 넓다 → 좌우를 자른다
        keep = round(height * TARGET_RATIO)
        spare = width - keep
        left = {"left": 0, "right": spare}.get(focus, spare // 2)
        where = focus if focus in HORIZONTAL else "center"
        note = f"좌우 {spare}px 잘라냄 (기준 {where}: 왼쪽 {left} · 오른쪽 {spare - left})"
        return im.crop((left, 0, left + keep, height)), note

    # 세로가 길다 → 위아래를 자른다
    keep = round(width / TARGET_RATIO)
    spare = height - keep
    top = {"top": 0, "bottom": spare}.get(focus, spare // 2)
    where = focus if focus in VERTICAL else "center"
    note = f"위아래 {spare}px 잘라냄 (기준 {where}: 위 {top} · 아래 {spare - top})"
    return im.crop((0, top, width, top + keep)), note


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--focus",
        choices=sorted(set(HORIZONTAL) | set(VERTICAL)),
        default="center",
        help="기본 기준. 잘리는 축에만 적용된다",
    )
    parser.add_argument(
        "overrides",
        nargs="*",
        metavar="파일명=기준",
        help="파일별 기준 (확장자 없이). 예: screenshot_01=right",
    )
    args = parser.parse_args()

    per_file = {}
    for item in args.overrides:
        if "=" not in item:
            print(f"'파일명=기준' 형식이어야 한다: {item}", file=sys.stderr)
            return 1
        name, _, value = item.partition("=")
        per_file[name] = value

    sources = sorted(p for p in SRC.glob("*.png") if not p.name.startswith("."))
    if not sources:
        print(f"{SRC.relative_to(ROOT)} 에 PNG 가 없다", file=sys.stderr)
        return 1

    unknown = set(per_file) - {p.stem for p in sources}
    if unknown:
        print(f"그런 파일이 없다: {', '.join(sorted(unknown))}", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    for index, path in enumerate(sources, start=1):
        im = Image.open(path)
        original = im.size
        # 알파를 흰 배경에 합성하지 않고 **버린다** — 화면 캡처의 알파는 의미가 없고,
        # 흰색으로 합성하면 다크 UI 가장자리에 흰 테가 생긴다.
        im = im.convert("RGB")
        cropped, note = crop_to_ratio(im, per_file.get(path.stem, args.focus))

        out = OUT / f"screenshot-{index}.png"
        cropped.resize(TARGET, Image.Resampling.LANCZOS).save(out, "PNG")
        print(f"{path.name}  {original[0]}×{original[1]} → {out.name}  1280×800 RGB")
        print(f"    {note}")

    print(f"\n{len(sources)}장 준비됨(최대 5장). **결과를 열어 잘린 곳을 확인할 것.**")
    return 0


if __name__ == "__main__":
    sys.exit(main())
