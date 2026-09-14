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
| 스크린샷 | 1280×800 또는 640×400, **알파 없는 24비트 PNG**, 최대 5장 | 아래 "스크린샷 찍는 법" |
| 카테고리 | — | Privacy & Security |
| 기본 언어 | — | English (한국어는 `_locales/ko` 로 자동 적용) |

### 스크린샷 찍는 법

원본을 `image/` 에 넣고 아래를 돌리면 규격(1280×800 · RGB)으로 바뀐다. 비율이 안 맞으면
가운데를 기준으로 잘라낸다.

```bash
python3 tools/prepare_screenshots.py          # image/*.png → store/screenshots/
python3 tools/prepare_screenshots.py --focus top   # 위쪽을 남기고 자를 때
```

찍기 전에 확인할 것 — **첫 시도에서 전부 틀렸던 자리다:**

1. **버전을 먼저 올린다.** 카드에 `2.1.0` 이 떠야 한다. 스크린샷에 옛 버전이 박히면 그대로 남는다
2. **팝업이 다 그려진 뒤에 찍는다.** 크롬 팝업은 포커스를 잃으면 다시 그리는데, 그 순간 캡처하면
   **버튼 라벨과 통계가 빈 채로** 찍힌다(실제로 그랬다). 팝업을 연 뒤 한 박자 쉬고, 찍은 파일을
   **열어서 버튼에 글자가 있는지 눈으로 확인**한다
3. **창을 작게 줄여서 찍는다.** 전체 화면으로 찍으면 확장 UI 가 화면의 1/6 밖에 안 돼 스토어
   목록에서 안 보인다. 브라우저 창을 1280×800 근처로 줄이면 UI 가 프레임을 채운다
4. **시연에는 `example.com` 을 쓴다.** RFC 2606 이 문서·예시 전용으로 예약한 도메인이라 상표
   문제가 없고, 보는 사람이 데모임을 바로 안다(`example.net`·`example.org` 도 같다).
   - **실제로 감추는 도메인이 화면에 보이면 안 된다** — 스토어에 그대로 올라간다. 감추는 것이
     목적인 도구가 그 목록을 공개하는 꼴이다
   - **큰 브랜드를 차단 대상으로 세우지 않는다.** 상표 자체는 문제없지만 "이 서비스를
     숨기라"는 메시지로 읽힐 여지가 있고, `google.com` 을 차단하는 시연은 용도가 모호해 보인다
   - 페이지가 허전하면 팝업·설정 화면 위주로 자른다. 중립적인 실제 사이트가 필요하면
     `wikipedia.org` 정도가 무난하다
5. 기본 언어가 영어이므로 **영어 로케일 화면**이 목록과 어울린다(한국어 화면도 허용되지만
   설명문과 언어가 갈린다)

찍을 장면 셋이면 충분하다 — **팝업**(현재 사이트 차단) · **설정 화면**(목록과 날짜) ·
**주소표시줄 키워드 모드**(`hb` + Tab 으로 칩이 붙은 상태).

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

> 스토어는 **언어별 목록**을 지원한다(제목·짧은 설명·상세 설명을 언어마다 따로 넣는다).
> 기본 언어는 영어이고, 한국어를 추가하면 한국어 브라우저에서 아래 국문이 뜬다.
> **스크린샷만은 언어별로 못 나눈다** — 한 세트를 모든 언어가 공유한다.

### 영어 (기본)

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

### 한국어

```
주소창에 남지 않았으면 하는 사이트가 있습니다.

History Blocklist 는 등록한 도메인의 방문 기록을 기록되는 즉시 지웁니다.
주소창에 사이트 이름 일부를 쳐도 자동완성에 뜨지 않습니다.

• 도메인을 하나 넣으면 모든 서브도메인이 함께 걸립니다 (www., m., …)
• 새로 등록한 도메인의 과거 기록은 자동으로 전부 정리합니다
• 지금 보고 있는 사이트는 툴바 아이콘에서 한 번에 차단하거나 해제합니다
• 주소창에서 바로도 됩니다 — "hb" 를 치고 Tab, 이어서 도메인

개인정보
이 확장은 네트워크 요청을 전혀 하지 않습니다. 수집도, 전송도, 판매도 없습니다.
호스트 권한을 요청하지 않고, 콘텐트 스크립트를 넣지 않으며, 페이지 내용을 읽지 않습니다.
차단 도메인 목록은 Chrome 자체 동기화 저장소에, 사용자 본인의 Google 계정 아래 보관됩니다.

할 수 없는 것
Chrome 에는 특정 도메인만 기록하지 않게 하는 기능이 없어서, 기록된 직후에 지웁니다 —
그 사이 수백 밀리초의 틈이 있습니다. 북마크·쿠키·로그인 세션·캐시·저장된 비밀번호는
건드리지 않습니다. 주소창에 뜨는 검색 엔진 제안은 방문 기록이 아니라 검색 서비스가
주는 것이라 막을 수 없습니다.

오픈소스 (MIT): https://github.com/DDEOK/Chrome-Ext-History-Blocklist
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

> [!warning] "전송하지 않으니 체크할 것이 없다"는 **틀렸다**
> 구글의 `handle` 은 *collecting, transmitting, using, or sharing* 을 전부 포함하고, FAQ 가
> 못박고 있다 — *"Extensions are required to disclose how they handle user data, **even when data
> is processed or stored locally** and is not transmitted to external servers or third parties."*
> **읽기만 해도 신고 대상**이다. 빠뜨리면 나중에 허위 신고로 정지될 수 있다.

| 데이터 유형 | 체크 | 근거 |
|---|:---:|---|
| **웹 기록** | **☑** | `chrome.history` 로 방문 URL·제목·시각을 읽는다. 항목 설명 그대로다 |
| 개인 식별 정보 | ☐ | 접근하지 않는다 |
| 건강 정보 | ☐ | |
| 금융 및 결제 정보 | ☐ | |
| 인증 정보 | ☐ | |
| 개인적인 커뮤니케이션 | ☐ | |
| 위치 | ☐ | |
| 사용자 활동 | ☐ | 클릭·마우스·스크롤·키 입력을 보지 않는다 |
| 웹사이트 콘텐츠 | ☐ | **페이지 내용을 읽지 않는다** — 호스트 권한도 콘텐트 스크립트도 없다 |

확인 3개는 **전부 체크**한다. 셋 다 사실이다.

- 승인된 용도 외 제3자에게 판매·이전하지 않음
- 제품의 단일 목적과 무관한 용도로 사용·이전하지 않음
- 신용도 판단·대출 목적으로 사용·이전하지 않음

**`PRIVACY.md` 와 어긋나지 않게 유지한다** — 심사자가 대조한다. 그 문서도 "수집 안 함"이 아니라
"웹 기록을 로컬에서 읽고, 전송·공유·판매는 없다"로 적혀 있다.

## 심사에서 물어올 만한 것

**"`history` 는 민감 권한인데 왜 필요한가"** — 확장의 유일한 기능이 방문 기록 삭제다. 호스트
권한·콘텐트 스크립트·네트워크 요청이 전부 없어 **기록을 밖으로 낼 경로 자체가 없다.** 소스가
공개돼 있으니 확인 가능하다고 덧붙인다.

**"원격 코드를 쓰는가"** — 안 쓴다. `_locales` 를 포함해 모든 파일이 패키지 안에 있다.

**"왜 `innerHTML` 을 쓰는가"**(소스를 보는 심사자가 있으면) — `src/i18n.js` 한 곳뿐이고, 넣는
값은 **패키지에 동봉된 `_locales/*/messages.json`** 에서만 온다. 사용자 입력·원격 데이터가 그
경로로 들어가지 않는다(도메인 같은 값은 전부 `textContent` 로 넣는다).

## 제출 기록

| | |
|---|---|
| 최초 제출 | 2026-09-13 · v2.1.0 |
| 상태 | **게시됨** — 2026-09-14 확인. **제출에서 게시까지 하루 안** |
| 스토어 주소 | <https://chromewebstore.google.com/detail/igdgdlihohidgldoodpoljhbhgmdpbol> |
| 스토어 확장 ID | `igdgdlihohidgldoodpoljhbhgmdpbol` |
| 스토어 주소 (승인 후) | `https://chromewebstore.google.com/detail/igdgdlihohidgldoodpoljhbhgmdpbol` |
| 데이터 신고 | **웹 기록 하나만** 체크 · 확인 3개 전부 체크 |
| 등록 계정 | 개인 Google 계정 (회사 Workspace 아님 — 이메일은 영영 못 바꾼다) |
| 개인정보처리방침 | 공개 저장소의 `PRIVACY.md` — **저장소를 비공개로 돌리면 URL 이 죽고 정책 위반이 된다** |

패키지 실측(제출본 기준): 파일 16개(`src`·`icons`·`_locales`·`manifest` 만) · `key` 없음 ·
호스트 권한 없음 · 콘텐트 스크립트 없음 · 원격 코드 없음 · `_locales` 양쪽 55키 일치.
**스토어가 위 ID 를 새로 발급한 것이 zip 에 `key` 가 없었다는 증거다.**

**이 ID 는 저장소의 것과 다르다.** 압축해제로 로드한 확장과 스토어판은 크롬 입장에서 **서로 다른
확장**이고, `chrome.storage.sync` 통도 따로다. 승인되면 세 기기 모두 스토어판으로 갈아타야
목록이 하나로 묶인다.

## 게시 후 — 전부 완료 (2026-09-14)

- [x] 스토어가 발급한 확장 ID 기록 (위 표)
- [x] 세 기기(회사 맥·집 맥·윈도우)에서 **압축해제 확장을 지우고 스토어판 설치** — 목록 동기화 확인
- [x] README "Install" 절에 스토어 링크 추가
- [x] 한국어 목록 추가 (위 "상세 설명"의 국문) — 2026-09-14 제출, 심사 대기

## 다음 갱신 때

1. `src/` 를 고치고 **버전을 올린다**(`manifest.json`·`package.json` 둘 다 · `CHANGELOG.md`)
2. `python3 tools/package.py`
3. 대시보드 → Package 탭 → 새 zip 업로드 → 제출. **갱신도 심사를 거친다**
4. 통과하면 기존 사용자에게 자동 배포된다. 문제가 생기면 **롤백**으로 즉시 되돌린다

절차 일반은 볼트 `10_Knowledge/Tooling/Chrome 웹스토어 확장 게시 절차 — 등록·제출·심사·갱신`.
