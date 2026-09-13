#!/usr/bin/env python3
"""Chrome 웹스토어 업로드용 zip 을 만든다.

스토어 패키지에 들어가면 안 되는 것을 빼는 것이 이 스크립트의 목적이다.

  - `manifest.json` 의 `key` — 스토어가 자체 ID 를 발급한다. 저장소에는 남겨 둔다
    (압축해제로 쓰는 사람의 확장 ID 를 고정해 기기 간 설정 동기화를 유지한다).
  - `tools/` · 문서 · git 메타 — 실행에 필요 없다. 패키지가 작을수록 심사가 단순하다.

`manifest.json` 은 zip **루트**에 있어야 한다(폴더로 감싸면 업로드가 거부된다).

    python3 tools/package.py        # dist/history-blocklist-<버전>.zip
"""

import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# 패키지에 넣을 것만 명시한다 — 제외 목록 방식은 새 파일이 생길 때 조용히 새어 들어간다.
INCLUDE_DIRS = ("src", "icons", "_locales")
INCLUDE_FILES = ("manifest.json",)
# manifest 에서 뺄 키 (스토어가 직접 정하는 것들)
STRIP_MANIFEST_KEYS = ("key", "_comment_key")


def build_manifest() -> tuple[str, str, list[str]]:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    removed = [k for k in STRIP_MANIFEST_KEYS if manifest.pop(k, None) is not None]
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", manifest["version"], removed


def main() -> int:
    body, version, removed = build_manifest()

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    out = DIST / f"history-blocklist-{version}.zip"

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", body)
        for name in INCLUDE_FILES:
            if name == "manifest.json":
                continue
            z.write(ROOT / name, name)
        for directory in INCLUDE_DIRS:
            base = ROOT / directory
            if not base.is_dir():
                print(f"없는 폴더: {directory}", file=sys.stderr)
                return 1
            for path in sorted(base.rglob("*")):
                if path.is_file() and not path.name.startswith("."):
                    z.write(path, str(path.relative_to(ROOT)))

    names = zipfile.ZipFile(out).namelist()
    print(f"{out.relative_to(ROOT)}  ({out.stat().st_size / 1024:.0f} KB · 파일 {len(names)}개)")
    print(f"manifest 에서 뺀 키: {', '.join(removed) or '없음'}")

    # 넣으면 안 되는 것이 섞였는지 마지막으로 본다.
    leaked = [n for n in names if n.startswith(("keys/", "tools/")) or n.endswith((".pem", ".md"))]
    if leaked:
        print("패키지에 들어가면 안 되는 파일:", *leaked, sep="\n  ", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
