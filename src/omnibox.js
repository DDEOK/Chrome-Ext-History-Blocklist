// 주소표시줄 키워드 모드. `hb` 를 치고 Tab 을 누르면 주소표시줄 왼쪽에 확장 칩이 붙고,
// 이어서 친 도메인을 차단·해제한다. 확장이 그 칩 영역을 쓸 수 있는 유일한 방법이다.
//
// 결과를 알릴 창이 없어서(알림은 notifications 권한이 필요하다) 툴바 배지를 잠깐 띄운다.
// 배지는 "action" manifest 키만으로 되고 추가 권한이 없다.

import {
  addDomain,
  getSettings,
  hostMatches,
  normalizeDomain,
  removeDomain,
} from './shared.js';

/** 제안 description 은 XML 로 파싱된다 — 사용자가 친 문자열을 그대로 넣으면 깨진다. */
function escapeXml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );
}

const BADGE_MS = 2_500;
const BADGE = {
  blocked: { text: '＋', color: '#2563eb' },
  unblocked: { text: '－', color: '#6b7280' },
  failed: { text: '!', color: '#b91c1c' },
};

function flashBadge(kind) {
  const { text, color } = BADGE[kind];
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), BADGE_MS);
}

/** 입력 문자열에 대해 "지금 누르면 무슨 일이 일어나는가" 를 한 줄로. */
async function describe(input) {
  const domain = normalizeDomain(input);
  if (!domain) {
    return '<dim>History Blocklist</dim> 차단하거나 해제할 도메인을 입력하세요';
  }

  const { domains } = await getSettings();
  const covering = domains.find((d) => hostMatches(domain, d));
  return covering
    ? `<match>${escapeXml(covering)}</match> 차단 <dim>해제</dim> — 이후 방문부터 기록이 남는다`
    : `<match>${escapeXml(domain)}</match> <dim>차단</dim> — 서브도메인 포함, 과거 기록도 정리한다`;
}

chrome.omnibox.onInputStarted.addListener(() => {
  chrome.omnibox.setDefaultSuggestion({
    description: '<dim>History Blocklist</dim> 차단하거나 해제할 도메인을 입력하세요',
  });
});

chrome.omnibox.onInputChanged.addListener(async (input, suggest) => {
  chrome.omnibox.setDefaultSuggestion({ description: await describe(input) });

  // 등록된 도메인을 함께 띄운다 — 철자를 다시 치지 않고 골라서 해제할 수 있다.
  const { domains } = await getSettings();
  const query = input.trim().toLowerCase();
  suggest(
    domains
      .filter((d) => !query || d.includes(query))
      .slice(0, 8)
      .map((d) => ({
        content: d,
        description: `<dim>해제</dim> <match>${escapeXml(d)}</match>`,
      })),
  );
});

chrome.omnibox.onInputEntered.addListener(async (input) => {
  const domain = normalizeDomain(input);
  if (!domain) {
    flashBadge('failed');
    return;
  }

  const { domains } = await getSettings();
  const covering = domains.find((d) => hostMatches(domain, d));
  if (covering) {
    await removeDomain(covering);
    flashBadge('unblocked');
    return;
  }

  const result = await addDomain(domain);
  flashBadge(result.ok ? 'blocked' : 'failed');
});
