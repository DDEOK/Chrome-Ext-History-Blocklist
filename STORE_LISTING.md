# Chrome Web Store 제출 자료

대시보드에 **그대로 붙여 넣을 문구**를 모아 둔다. 심사가 반려되면 여기 문구를 고치고
무엇을 왜 고쳤는지 남긴다 — 다음 제출 때 같은 자리를 다시 헤매지 않으려는 것이다.

> 이 파일은 확장 패키지에 들어가지 않는다(`tools/package.py` 가 `.md` 를 제외한다).

## 제출 전 점검

- [ ] `python3 tools/package.py` → `dist/history-blocklist-<버전>.zip`
- [ ] zip 안에 `manifest.json` 이 **루트**에 있고 `key` 가 없다 (스크립트가 확인해 준다)
- [ ] `node --test tools/` 전부 통과
- [ ] 스크린샷 1장 이상 (아래 "스토어 자산")

## 스토어 자산

| 항목 | 규격 | 상태 |
|---|---|---|
| 아이콘 | 128×128 PNG | `icons/icon128.png` |
| 스크린샷 | 1280×800 또는 640×400, 최소 1장 | **직접 찍어야 한다** — 팝업(현재 사이트 차단) · 설정 화면(목록) · 주소표시줄 키워드 모드 세 장이면 충분하다 |
| 카테고리 | — | Privacy & Security |
| 기본 언어 | — | English (한국어는 `_locales/ko` 로 자동 적용) |

## 짧은 설명 (132자 이내)

영문 — `manifest` 의 `appDesc` 와 같은 문구를 쓴다:

```
Automatically deletes browsing history for domains you choose, so they stay out of the address bar and history.
```

한국어:

```
지정한 도메인의 방문 기록을 자동으로 삭제해 주소창 자동완성과 방문 기록에서 감춥니다.
```

## 상세 설명

```
Some sites you visit do not need to live in your address bar.

History Blocklist deletes browsing history for the domains you list, the moment it is recorded.
Type part of the site name in the address bar and it will not be suggested.

• Add a domain and every subdomain is covered (www., m., …)
• Past history for a newly added domain is swept in full, automatically
• Block or unblock the site you are on with one click from the toolbar
• Or straight from the address bar: type "hb", press Tab, then the domain

Privacy
This extension makes no network requests at all. Nothing is collected, transmitted, or sold.
It requests no host permissions, injects no content scripts, and never reads page content.
Your blocked-domain list is stored with Chrome's own sync storage, under your Google account.

What it cannot do
Chrome offers no way to skip recording a domain, so this deletes right after recording — there is
a window of a few hundred milliseconds. It does not touch bookmarks, cookies, login sessions,
cache, or saved passwords, and it cannot suppress search-engine suggestions, which come from the
search provider rather than from your history.

Open source (MIT): https://github.com/DDEOK/Chrome-Ext-History-Blocklist
```

## 개인정보 보호 관행 (Privacy practices 탭)

**개인정보처리방침 URL**

```
https://github.com/DDEOK/Chrome-Ext-History-Blocklist/blob/main/PRIVACY.md
```

**단일 목적 (Single purpose)**

```
Delete the user's own browsing history entries for domains the user explicitly lists, so those
sites do not appear in address bar autocomplete or in chrome://history.
```

**권한 사유 (각 권한마다 요구된다)**

| 권한 | 붙여 넣을 문구 |
|---|---|
| `history` | `Required to detect visits and delete history entries for the domains the user has listed. This is the extension's only function. History is never read for any other purpose, never copied, and never leaves the browser.` |
| `storage` | `Stores the user's blocked-domain list (chrome.storage.sync) and a local counter of deleted entries plus per-device scan state (chrome.storage.local). No other data is stored.` |
| `alarms` | `Runs a periodic sweep that removes leftover history entries the immediate deletion missed, for example while the service worker was idle.` |
| `activeTab` | `When the user clicks the toolbar icon, the popup reads only the current tab's domain so it can offer to block that site. Access is granted only at the moment of the click.` |
| 호스트 권한 | **요청하지 않는다** — 그렇게 답한다 |
| 원격 코드 | **사용하지 않는다** — 모든 코드가 패키지에 포함된다 |

**데이터 사용 (Data usage 체크박스)**

수집·전송이 없으므로 데이터 유형을 **하나도 선택하지 않는다.** 아래 세 항목은 모두 동의한다.

- 승인된 용도 외 제3자에게 판매·이전하지 않음
- 제품의 단일 목적과 무관한 용도로 사용·이전하지 않음
- 신용도 판단·대출 목적으로 사용·이전하지 않음

## 심사에서 물어올 만한 것

**"`history` 는 민감 권한인데 왜 필요한가"** — 확장의 유일한 기능이 방문 기록 삭제다. 호스트
권한·콘텐트 스크립트·네트워크 요청이 전부 없어 **기록을 밖으로 낼 경로 자체가 없다.** 소스가
공개돼 있으니 확인 가능하다고 덧붙인다.

**"원격 코드를 쓰는가"** — 안 쓴다. `_locales` 를 포함해 모든 파일이 패키지 안에 있다.

**"왜 `innerHTML` 을 쓰는가"**(소스를 보는 심사자가 있으면) — `src/i18n.js` 한 곳뿐이고, 넣는
값은 **패키지에 동봉된 `_locales/*/messages.json`** 에서만 온다. 사용자 입력·원격 데이터가 그
경로로 들어가지 않는다(도메인 같은 값은 전부 `textContent` 로 넣는다).

## 게시 후

- [ ] 스토어가 발급한 확장 ID 를 기록해 둔다 (저장소의 `key` 와 무관한 별개 값이다)
- [ ] 자기 기기에서 **압축해제 확장을 지우고 스토어판을 설치**한다 — 그래야 기기 간 목록
      동기화가 하나의 ID 로 묶인다. 압축해제판의 목록은 따라오지 않으므로 다시 등록한다
- [ ] README 의 "Install" 절에 스토어 링크를 추가한다
