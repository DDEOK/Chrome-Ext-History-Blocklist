# History Blocklist

등록한 도메인의 Chrome 방문 기록을 **방문 즉시 삭제**하는 확장 프로그램(Manifest V3).
주소창에 사이트 이름 일부를 쳐도 자동완성에 뜨지 않게 하는 것이 목적이다.

`blocked.example` 을 등록하면 그 도메인과 모든 서브도메인(`www.` · `m.` …)의 기록이 남지 않는다.

## 쓰는 법

| 어디서 | 무엇 |
|---|---|
| **주소표시줄** | `hb` + <kbd>Tab</kbd> → 도메인 + <kbd>Enter</kbd>. 등록돼 있으면 해제된다. 결과는 툴바 배지로 (`＋` 차단 · `－` 해제 · `!` 실패) |
| **툴바 아이콘** | 지금 보고 있는 사이트를 한 번에 차단/해제 |
| **설정 화면** | 목록 관리 · 과거 기록 전체 정리 · 통계 |

주소표시줄 키워드는 `manifest.json` 의 `omnibox.keyword` 에서 바꾼다.

## 동작 원리

Chrome 에는 "특정 도메인만 기록하지 않기" 훅이 없다. 그래서 **기록을 막는 것이 아니라 기록된
직후 지운다.** 서비스 워커가 죽어도 새는 곳이 없도록 세 갈래로 잡는다.

| 경로 | 언제 | 역할 |
|---|---|---|
| `history.onVisited` | 방문 직후 | 주 경로. **이 리스너가 잠든 서비스 워커를 깨우므로** 워커가 종료돼 있어도 방문 자체는 놓치지 않는다 |
| 지연 재확인 (1.5초 · 6초) | 삭제 직후 | Chrome 이 제목·파비콘을 붙이며 같은 URL 을 되살리는 경우를 회수 |
| `alarms` 5분 주기 스윕 | 주기적 | 위 둘이 실패했거나 확장이 꺼져 있던 사이의 방문을 회수 |

> `chrome.history` 의 이벤트는 **`onVisited` 와 `onVisitRemoved` 둘뿐**이다.
> 기록이 되살아나는 것을 알려주는 이벤트가 없어서 지연 재확인으로 메운다.
> 없는 API 를 부르면 서비스 워커가 등록 단계에서 통째로 죽으므로
> (`Service worker registration failed`), 쓰는 API 는 `tools/api-surface.test.js` 로 고정해 두었다.

도메인을 새로 등록하면 그 도메인의 **과거 기록도 즉시 정리**한다. 설정 화면의
"전체 방문 기록 훑어 정리" 는 텍스트 검색이 놓치는 항목까지 찾도록 최근 5년치를 기간별로 훑는다.

## 한계 — 확장이 못 하는 것

이 확장이 지우는 것은 **방문 기록뿐**이다.

- 기록 → 삭제 사이 수백 ms 동안은 방문 기록에 남아 있다. 원리상 없앨 수 없는 틈이다.
- 북마크 · 쿠키 · 로그인 세션 · 캐시 · 저장된 비밀번호 · 자동완성 입력값은 건드리지 않는다.
- 주소창의 **검색 엔진 제안**(구글이 주는 것)은 서버 쪽이라 막을 수 없다.
- Chrome 동기화를 켜두었으면 다른 기기로 삭제가 전파되기까지 시차가 있다.

## 권한

| 권한 | 왜 |
|---|---|
| `history` | 방문을 감지하고 기록을 삭제한다 |
| `storage` | 차단 도메인 목록(`sync`)과 통계(`local`) |
| `alarms` | 주기 스윕 |
| `activeTab` | 팝업에서 현재 탭 도메인을 읽는다 (아이콘을 눌렀을 때만) |

호스트 권한(`<all_urls>`)은 쓰지 않는다. 페이지 내용은 읽지 않는다.
주소표시줄 키워드(`omnibox`)와 툴바 배지(`action`)는 **권한이 아니라 manifest 키**라 권한 목록에 없다.

## 설치

웹스토어에 올리지 않은 개인용이라 압축해제 로드로 쓴다.

1. `chrome://extensions` 를 연다
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → 이 저장소 폴더 선택

갱신은 `git pull` 후 확장 카드의 **새로고침(↻)**. 카드의 버전 숫자가 바뀌면 반영된 것이다.

### 윈도우에 내려받기

비공개 저장소라 인증이 필요하다. [Git for Windows](https://git-scm.com/download/win) 가 깔려 있으면
같이 들어오는 Git Credential Manager 가 **브라우저로 GitHub 로그인 창**을 띄운다 — 토큰을 직접
만들 필요는 없다. PowerShell 에서:

```powershell
mkdir -Force "$env:USERPROFILE\Develop\github\ddeok" | Out-Null
cd "$env:USERPROFILE\Develop\github\ddeok"
git clone https://github.com/DDEOK/Chrome-History-Blocklist.git
(Resolve-Path .\Chrome-History-Blocklist).Path   # 크롬에서 고를 경로
```

마지막 줄이 찍어준 경로를 위 3번에서 선택한다.

> [!warning] **차단 목록은 기기 간에 따라오지 않는다**
> 목록은 `chrome.storage.sync` 에 있어 같은 Chrome 계정이면 동기화되지만, **그 저장소는 확장
> ID 단위**다. 그리고 압축해제 확장은 `manifest.json` 에 `key` 가 없으면 **ID 가 기기마다
> 달라진다.** 그래서 윈도우에서는 **빈 목록으로 시작**한다.
>
> 맞추려면 확장 ID 를 고정해야 하고, 그 공개키는 Chrome 개발자 대시보드에 zip 을 올려야 나온다
> (게시는 안 해도 된다). 그만한 가치가 없으면 양쪽에서 따로 등록하거나 목록을
> 내보내기/가져오기로 옮긴다.

## 개발

```bash
node --test tools/            # 전체 테스트
python3 tools/make_icons.py   # 아이콘 PNG 재생성 (Pillow 필요)
```

### `src/` 를 고치면 버전을 올린다

압축해제로 로드한 확장은 **버전이 "지금 도는 게 어느 코드인가"를 알려주는 유일한 표시**다.
버전을 그대로 두고 고치면 `chrome://extensions` 카드가 안 변해서 새로고침이 먹었는지 알 수 없다.
`manifest.json` 과 `package.json` 을 같이 올리고 [CHANGELOG](CHANGELOG.md) 에 적는다 —
`tools/manifest.test.js` 가 안 올렸을 때 실패한다. 팝업·설정 화면 머리에도 로드된 버전이 뜬다.

테스트 둘이 각각 다른 종류의 사고를 막는다.

- `matching.test.js` — 도메인 매칭. 되돌릴 수 없는 삭제를 좌우하므로 `src/shared.js` 한 곳에만
  두고 고정한다. 특히 `notblocked.example` 처럼 **접미사만 같은 남의 도메인**을 잡으면 안 된다.
- `api-surface.test.js` — 쓰는 `chrome.*` API 의 실재. 없는 API 는 확장을 로드해야만 드러나고
  그때는 서비스 워커가 통째로 죽는다. 새 API 를 쓰려면 공식 문서에서 확인하고 화이트리스트에
  더해야 한다.
- `manifest.test.js` — 버전. `src/` 를 고치고 버전을 안 올리면 실패한다 (아래).

```text
manifest.json
src/
  background.js   서비스 워커 — 감지·삭제·스윕
  omnibox.js      주소표시줄 키워드 모드 (background 가 정적 import)
  shared.js       도메인 정규화·매칭·설정 접근 (유일한 원본)
  popup.html/js   현재 사이트 한 번에 차단/해제
  options.html/js 목록 관리·전체 정리·통계
  ui.css          팝업·옵션 공용 (라이트/다크 대응)
tools/
  make_icons.py       아이콘 생성기
  matching.test.js    도메인 매칭
  api-surface.test.js 쓰는 chrome API 의 실재
  manifest.test.js    버전 갱신·형식
```
