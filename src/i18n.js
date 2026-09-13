// 화면의 고정 문구를 `_locales/` 의 번역으로 채운다.
//
// HTML 에는 문구 대신 키만 둔다 — 문구를 HTML 과 messages.json 양쪽에 두면 사본이 갈라진다.
//   data-i18n       → textContent
//   data-i18n-html  → innerHTML (문구 안에 <span>·<kbd> 같은 표시용 태그가 있는 것)
//   data-i18n-title → title 속성
//   data-i18n-ph    → placeholder 속성
//
// innerHTML 에 넣는 문구는 **이 저장소가 쓰는 번역 파일**에서만 오고 사용자 입력이 섞이지
// 않는다. 값이 들어가는 자리는 전부 textContent 쪽이다.

export const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);

const APPLY = [
  ['data-i18n', (el, text) => (el.textContent = text)],
  ['data-i18n-html', (el, text) => (el.innerHTML = text)],
  ['data-i18n-title', (el, text) => el.setAttribute('title', text)],
  ['data-i18n-ph', (el, text) => el.setAttribute('placeholder', text)],
];

/**
 * 문서 안의 i18n 속성을 전부 채운다. 키가 없으면 그 자리를 건드리지 않는다 —
 * 번역이 빠져도 HTML 에 적어 둔 원문이 남아 화면이 비지 않는다.
 * `<title data-i18n="…">` 도 textContent 라 같은 규칙으로 처리된다.
 */
export function localizeDocument(root = document) {
  for (const [attribute, set] of APPLY) {
    for (const el of root.querySelectorAll(`[${attribute}]`)) {
      const text = t(el.getAttribute(attribute));
      if (text) set(el, text);
    }
  }
  document.documentElement.lang = chrome.i18n.getUILanguage();
}
