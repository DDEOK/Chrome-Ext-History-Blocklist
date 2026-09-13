#!/usr/bin/env python3
"""manifest.json 의 `key` 로부터 확장 ID 를 계산한다.

압축해제 확장의 ID 는 **설치 경로**에서 나오므로 기기마다 다르다. `chrome.storage.sync` 는
확장 ID 단위라, 그래서 압축해제로 쓰면 **차단 목록이 기기 간에 따라오지 않는다.**

자기 기기끼리 목록을 공유하고 싶으면 `manifest.json` 에 `key`(공개키)를 넣어 ID 를 고정하면
된다. 이 저장소는 그렇게 하지 않는다 — **`key` 는 그것을 만든 사람의 신원**이라, 공개 저장소에
두면 클론한 사람이 전부 같은 ID 를 쓰게 된다.

직접 고정하려면 (이 저장소에는 커밋하지 말 것):

    openssl genrsa -out key.pem 2048
    openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A

나온 문자열을 `manifest.json` 의 `"key"` 에 넣고 이 스크립트로 ID 를 확인한다. 모든 기기에
같은 값을 넣어야 목록이 공유된다. 웹스토어에서 설치하면 스토어가 발급한 ID 가 기기 간에
같으므로 이 작업이 필요 없다.

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
        print("manifest.json 에 key 가 없다 — ID 는 설치 경로에서 나오고 기기마다 다르다.")
        print("(의도한 기본값이다. 자기 기기끼리 목록을 공유하려면 이 파일 첫머리 안내를 볼 것)")
        return 1

    print(extension_id(key))
    return 0


if __name__ == "__main__":
    sys.exit(main())
