#!/usr/bin/env python3
"""manifest.json 의 `key` 로부터 확장 ID 를 계산한다.

압축해제 확장은 `key` 가 없으면 **설치 경로**에서 ID 가 나와 기기마다 달라지고,
`chrome.storage.sync` 가 확장 ID 단위라 설정이 기기 간에 안 따라온다.
`key` 를 박으면 경로와 무관하게 ID 가 고정된다 — 그 ID 가 무엇이 될지 미리 알려준다.

ID 규칙: 공개키(DER)의 SHA-256 앞 16바이트를 16진수로 쓰고, 각 자리를 0→a … f→p 로 옮긴다.

    python3 tools/extension_id.py
"""

import base64
import hashlib
import json
import sys
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent.parent / "manifest.json"
# 0-9a-f 를 a-p 로 옮기는 표. Chrome 이 ID 에 16진수 대신 이 알파벳을 쓴다.
HEX_TO_ALPHA = str.maketrans("0123456789abcdef", "abcdefghijklmnop")


def extension_id(key_b64: str) -> str:
    der = base64.b64decode(key_b64)
    digest = hashlib.sha256(der).hexdigest()[:32]
    return digest.translate(HEX_TO_ALPHA)


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    key = manifest.get("key")
    if not key:
        print("manifest.json 에 key 가 없다 — ID 가 설치 경로에서 나오므로 기기마다 다르다.")
        return 1

    print(extension_id(key))
    return 0


if __name__ == "__main__":
    sys.exit(main())
