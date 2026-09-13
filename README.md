# History Blocklist

A Chrome extension (Manifest V3) that **deletes browsing history for domains you choose, the
moment it is recorded** — so those sites never show up in address-bar autocomplete.

Add `blocked.example` and that domain plus every subdomain (`www.`, `m.`, …) leaves no trace in
your history.

> 한국어 설명은 [아래](#한국어)에 있습니다.

**No network requests. No host permissions. No content scripts. No analytics.**
See [PRIVACY.md](PRIVACY.md).

## How it works

Chrome has no hook for "don't record this domain." So this extension is not a blocker but a
**cleaner** — it deletes right after the visit is recorded. Three paths cover the gaps, because a
Manifest V3 service worker is terminated whenever it goes idle.

| Path | When | Role |
|---|---|---|
| `history.onVisited` | Right after a visit | Main path. This listener **wakes the sleeping service worker**, so visits are never missed |
| Delayed re-check (1.5 s, 6 s) | Right after deletion | Recovers entries Chrome resurrects while attaching the title or favicon |
| `alarms` sweep every 5 min | Periodic | Recovers anything the first two missed, or visits made while the extension was off |

> `chrome.history` exposes exactly two events — `onVisited` and `onVisitRemoved`. There is no event
> for "an entry came back", which is why the delayed re-check exists rather than an observer.

### Past history

When a domain is **new** — whether you added it here or it arrived from another device over sync —
that domain alone is swept across **all time**. Text search relies on Chrome's tokenizer and misses
some shapes, and "adding a domain also cleans its past" has to be true.

A domain is swept in full only once (tracked per device in `chrome.storage.local`). The completion
mark is written **after** the sweep finishes, so if the service worker dies mid-scan the next
periodic sweep retries.

## Limits — what this cannot do

This extension deletes **browsing history only**.

- There is a window of a few hundred milliseconds where the visit is in history. That gap cannot be
  closed; Chrome offers no way to skip recording.
- Bookmarks, cookies, login sessions, cache, saved passwords and autofill are untouched.
- **Search engine suggestions** in the address bar come from the search provider, not from your
  history, and cannot be blocked by any extension.
- With Chrome sync on, deletions take a moment to reach your other devices.

## Permissions

| Permission | Why |
|---|---|
| `history` | Detect visits and delete history entries |
| `storage` | The blocked-domain list (`sync`) and counters (`local`) |
| `alarms` | The periodic sweep |
| `activeTab` | Read the current tab's domain when you click the toolbar icon — only then |

No host permissions (`<all_urls>`), no content scripts, no remote code. `omnibox` and `action` are
manifest keys rather than permissions.

## Using it

| Where | What |
|---|---|
| **Address bar** | `hb` + <kbd>Tab</kbd> → domain + <kbd>Enter</kbd>. Already listed? It is unblocked instead. The toolbar badge reports the result (`＋` blocked · `－` unblocked · `!` not a domain) |
| **Toolbar icon** | Block or unblock the site you are on, in one click |
| **Settings page** | Manage the list · sweep everything again · statistics |

Change the address-bar keyword in `manifest.json` → `omnibox.keyword`.

## Install

Not published to the Chrome Web Store yet — load it unpacked:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select this repository folder

To update: `git pull`, then press **↻** on the extension card. The version number on the card is
how you confirm the reload took effect.

## Syncing across devices

| | |
|---|---|
| **The extension itself** | Not synced. Chrome only syncs extensions installed from the Web Store — clone and load unpacked on each device |
| **Code updates** | `git pull` + ↻ on each device |
| **The blocked-domain list** | **Synced** through `chrome.storage.sync`, if you are signed into the same Chrome account |

The list is stored as **one key per domain** (`d:example.com` → the time it was added). Holding the
whole list in a single key would lose data: `chrome.storage.sync` keeps only the last write per key,
so two devices each adding a domain would erase one another's addition. Splitting the keys lets the
server merge them — and removes the need for conflict-resolution timestamps. The limit is 512 items
(`MAX_ITEMS`); adding is refused at 480.

List sync requires **the same extension ID on every device**. An unpacked extension derives its ID
from the install path unless `manifest.json` carries a `key`, so this repository pins one. The `key`
is a public key and is safe to publish. `python3 tools/extension_id.py` recomputes the ID from it.

> Changing `key` makes the existing list **look deleted** — the old ID's `storage.sync` bucket is no
> longer read, and there is no way to reach it. `tools/manifest.test.js` pins the resulting ID so it
> cannot change by accident.

## Development

```bash
node --test tools/            # all tests
python3 tools/make_icons.py   # regenerate icon PNGs (needs Pillow)
python3 tools/package.py      # build the Web Store zip into dist/
```

### Bump the version whenever `src/` changes

For an unpacked extension the version number is **the only visible sign of which code is running**.
Change `manifest.json` and `package.json` together and add a [CHANGELOG](CHANGELOG.md) entry —
`tools/manifest.test.js` fails if you forget. The popup and settings page also show the loaded
version.

### The tests each guard a different kind of accident

- `matching.test.js` — domain matching. It decides irreversible deletions, so it lives in
  `src/shared.js` alone and is pinned here. The dangerous case is a **different domain that merely
  shares a suffix**: `notblocked.example` must not match `blocked.example`.
- `api-surface.test.js` — that every `chrome.*` API used actually exists. A nonexistent one is only
  discovered when the extension is loaded, and it kills the whole service worker. Adding an API means
  confirming it in the official docs and adding it to the allowlist.
- `manifest.test.js` — version bumps, the pinned extension ID, `default_locale`, and that every
  locale defines the same message keys (a key missing in one language renders as an empty string).

```text
manifest.json
_locales/{en,ko}/messages.json   UI strings
src/
  background.js   service worker — detect, delete, sweep
  omnibox.js      address-bar keyword mode (statically imported by background)
  shared.js       domain normalization, matching, settings access (single source)
  i18n.js         fills data-i18n attributes from _locales
  popup.html/js   block or unblock the current site
  options.html/js list management, full sweep, statistics
  ui.css          shared by popup and options (light/dark aware)
tools/
  package.py          build the Web Store zip
  make_icons.py       icon generator
  extension_id.py     compute the extension ID from manifest key
  *.test.js           see above
```

## License

[MIT](LICENSE)

---

<a name="한국어"></a>

# 한국어

등록한 도메인의 Chrome 방문 기록을 **방문 즉시 삭제**하는 확장 프로그램(Manifest V3)입니다.
주소창에 사이트 이름 일부를 쳐도 자동완성에 뜨지 않게 하는 것이 목적입니다.

`blocked.example` 을 등록하면 그 도메인과 모든 서브도메인(`www.` · `m.` …)의 기록이 남지 않습니다.

**네트워크 요청 없음 · 호스트 권한 없음 · 콘텐트 스크립트 없음 · 분석 없음.**
자세한 것은 [PRIVACY.md](PRIVACY.md).

## 동작 원리

Chrome 에는 "특정 도메인만 기록하지 않기" 훅이 없습니다. 그래서 이 확장은 차단기가 아니라
**청소기**입니다 — 기록된 직후 지웁니다. 서비스 워커가 수시로 종료되므로 세 갈래로 잡습니다.

| 경로 | 언제 | 역할 |
|---|---|---|
| `history.onVisited` | 방문 직후 | 주 경로. **이 리스너가 잠든 서비스 워커를 깨우므로** 방문 자체는 놓치지 않습니다 |
| 지연 재확인 (1.5초 · 6초) | 삭제 직후 | 제목·파비콘이 붙으며 되살아나는 항목을 회수 |
| `alarms` 5분 주기 스윕 | 주기적 | 위 둘이 놓쳤거나 확장이 꺼져 있던 사이의 방문을 회수 |

도메인이 **새로 들어오면**(직접 등록이든 동기화로 받은 것이든) 그 도메인만 전 기간 전수로 한 번
훑습니다. 텍스트 검색은 Chrome 의 토큰화에 기대 못 잡는 형태가 남기 때문입니다.

## 한계

지우는 것은 **방문 기록뿐**입니다.

- 기록 → 삭제 사이 수백 ms 동안은 방문 기록에 남아 있습니다. 원리상 없앨 수 없는 틈입니다.
- 북마크 · 쿠키 · 로그인 세션 · 캐시 · 저장된 비밀번호는 건드리지 않습니다.
- 주소창의 **검색 엔진 제안**은 서버가 주는 것이라 확장이 막을 수 없습니다.
- Chrome 동기화를 켜두었으면 다른 기기로 삭제가 전파되기까지 시차가 있습니다.

## 쓰는 법

| 어디서 | 무엇 |
|---|---|
| **주소표시줄** | `hb` + <kbd>Tab</kbd> → 도메인 + <kbd>Enter</kbd>. 등록돼 있으면 해제됩니다. 결과는 툴바 배지로 (`＋` 차단 · `－` 해제 · `!` 실패) |
| **툴바 아이콘** | 지금 보고 있는 사이트를 한 번에 차단/해제 |
| **설정 화면** | 목록 관리 · 과거 기록 전체 정리 · 통계 |

## 설치

아직 웹스토어에 없습니다 — 압축해제 로드로 씁니다.

1. `chrome://extensions` 를 엽니다
2. 오른쪽 위 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드** → 이 저장소 폴더 선택

갱신은 `git pull` 후 확장 카드의 **↻**. 카드의 버전 숫자가 바뀌면 반영된 것입니다.
