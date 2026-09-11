#!/usr/bin/env python3
"""확장 아이콘(PNG 4종)을 생성한다.

시계(방문 기록) 위에 사선(차단)을 그은 도형. 1024px 로 그린 뒤 축소해
16px 에서도 형태가 뭉개지지 않게 한다.

    python3 tools/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

S = 1024  # 원본 크기
SIZES = (16, 32, 48, 128)
OUT_DIR = Path(__file__).resolve().parent.parent / "icons"

BG = (37, 99, 235, 255)  # --accent 와 같은 파랑
FG = (255, 255, 255, 255)
SLASH = (239, 68, 68, 255)


def draw_icon() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 둥근 사각형 배경
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)

    # 시계판 — 16px 에서는 테두리 원의 안쪽이 뭉개진다. 꽉 찬 원이 형태가 가장 잘 남는다
    m = int(S * 0.2)
    d.ellipse([m, m, S - m, S - m], fill=FG)

    # 시침·분침 (10시 10분) — 바탕색으로 파낸다
    cx = cy = S // 2
    hand = int(S * 0.05)
    d.line([cx, cy, cx, cy - int(S * 0.19)], fill=BG, width=hand)
    d.line([cx, cy, cx + int(S * 0.14), cy], fill=BG, width=hand)

    # 차단 사선 — 바탕색 테두리를 깔아 시계판과 분리한다
    p0, p1 = int(S * 0.12), int(S * 0.88)
    d.line([p0, p0, p1, p1], fill=BG, width=int(S * 0.2))
    d.line([p0, p0, p1, p1], fill=SLASH, width=int(S * 0.115))

    return img


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    base = draw_icon()
    for size in SIZES:
        path = OUT_DIR / f"icon{size}.png"
        base.resize((size, size), Image.Resampling.LANCZOS).save(path)
        print(f"wrote {path.relative_to(OUT_DIR.parent)}")


if __name__ == "__main__":
    main()
