# Privacy Policy — History Blocklist

_Last updated: 2026-09-13_

**History Blocklist reads your browsing history on your own device in order to delete the entries
you asked it to delete. Nothing is transmitted, shared, or sold — the extension makes no network
requests of any kind, and the developer has no access to anything.**

Chrome Web Store disclosure: this extension declares **Web History** as the data it handles, because
it reads history entries locally. Google requires that disclosure even for data that never leaves
the device. No other data category is handled.

## What the extension can access

| Permission | What it is used for |
|---|---|
| `history` | Detect visits and delete history entries for the domains you list. Nothing is read for any other purpose. |
| `storage` | Store your blocked-domain list and a local counter of how many entries were deleted. |
| `alarms` | Run a periodic cleanup of leftover entries. |
| `activeTab` | Read the current tab's domain when you click the toolbar icon, so the popup can offer to block that site. Granted only at the moment you click. |

The extension requests **no host permissions**, injects **no content scripts**, and **does not read page content**.

## Where your data is stored

- **Blocked-domain list** — `chrome.storage.sync`. If you are signed into Chrome with sync enabled, Chrome replicates this to your other devices through your own Google account. The developer has no access to it.
- **Deletion counter and per-device scan state** — `chrome.storage.local`. Stays on that device.

There is no server. The extension makes **no network requests of any kind**.

## What is never done

- No data is sent to the developer or to any third party.
- No analytics, telemetry, crash reporting, or advertising.
- No sale or transfer of user data.
- No remote code is loaded or executed.
- Browsing history is never copied, uploaded, or retained beyond deleting the entries you asked to have deleted.

## Removing your data

Uninstalling the extension removes its stored data. You can also clear the blocked-domain list in the extension's settings page before uninstalling.

## Limited Use disclosure

Use of information received from Chrome APIs adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. Data accessed through the `history` permission is used
solely to provide the extension's single user-facing feature — deleting browsing history for the
domains the user selects — and is never transferred, sold, or used for advertising.

## Source code

The extension is open source: <https://github.com/DDEOK/Chrome-Ext-History-Blocklist>

## Contact

Questions or reports: open an issue at
<https://github.com/DDEOK/Chrome-Ext-History-Blocklist/issues>

---

# 개인정보처리방침 — History Blocklist

_최종 수정: 2026-09-13_

**이 확장은 사용자가 지정한 기록을 지우기 위해 방문 기록을 그 기기 안에서만 읽습니다. 전송·공유·판매는 없고, 네트워크 요청 자체를 하지 않으며, 개발자는 아무것도 볼 수 없습니다.**

Chrome 웹스토어 신고 항목: 기록을 로컬에서 읽으므로 **웹 기록(Web History)** 하나를 신고합니다. 구글은 기기 밖으로 나가지 않는 데이터도 신고하도록 요구합니다. 그 밖의 데이터 유형은 다루지 않습니다.

## 권한별 사용 목적

| 권한 | 무엇에 쓰나 |
|---|---|
| `history` | 등록한 도메인의 방문을 감지하고 그 기록을 삭제합니다. 다른 목적으로 읽지 않습니다. |
| `storage` | 차단 도메인 목록과 삭제 건수 카운터를 저장합니다. |
| `alarms` | 남은 기록을 주기적으로 정리합니다. |
| `activeTab` | 툴바 아이콘을 눌렀을 때만 현재 탭의 도메인을 읽습니다. |

호스트 권한을 요청하지 않고, 콘텐트 스크립트를 넣지 않으며, **페이지 내용을 읽지 않습니다.**

## 저장 위치

- **차단 도메인 목록** — `chrome.storage.sync`. Chrome 동기화를 켜두었다면 **사용자 본인의 Google 계정**을 통해 다른 기기로 복제됩니다. 개발자는 접근할 수 없습니다.
- **삭제 건수·기기별 스캔 상태** — `chrome.storage.local`. 해당 기기에만 남습니다.

서버가 없습니다. 이 확장은 **어떤 네트워크 요청도 하지 않습니다.**

## 하지 않는 것

- 개발자나 제3자에게 데이터를 보내지 않습니다.
- 분석·텔레메트리·오류 보고·광고가 없습니다.
- 사용자 데이터를 판매하거나 이전하지 않습니다.
- 원격 코드를 불러오거나 실행하지 않습니다.
- 방문 기록을 복사·업로드·보관하지 않습니다. 요청받은 항목을 지울 뿐입니다.

## 데이터 삭제

확장을 삭제하면 저장된 데이터도 함께 지워집니다. 설정 화면에서 차단 목록을 먼저 비울 수도 있습니다.

## 문의

<https://github.com/DDEOK/Chrome-Ext-History-Blocklist/issues>
