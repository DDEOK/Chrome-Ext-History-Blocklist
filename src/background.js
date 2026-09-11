// 방문 기록을 지우는 본체. 세 갈래로 잡는다.
//   1. history.onVisited      — 방문 직후 (주 경로)
//   2. history.onTitleChanged — 제목이 늦게 붙으며 Chrome 이 기록을 다시 쓰는 경우
//   3. alarms 주기 스윕       — 서비스 워커가 죽어 1·2 를 놓친 방문 회수
// 서비스 워커는 수시로 종료되므로 리스너 등록은 반드시 최상위에서 한다.

import { getSettings, matchedDomain } from './shared.js';

const SWEEP_ALARM = 'history-blocklist-sweep';
const SWEEP_PERIOD_MINUTES = 5;
const DAY_MS = 86_400_000;
/** 깊은 스윕이 거슬러 올라가는 기간. Chrome 기본 보존 기간(90일)보다 넉넉하게 잡는다. */
const DEEP_SWEEP_SPAN_MS = 5 * 365 * DAY_MS;
const DEEP_SWEEP_WINDOW_MS = 30 * DAY_MS;

let settingsCache = null;

async function settings() {
  if (!settingsCache) settingsCache = await getSettings();
  return settingsCache;
}

// 통계는 read-modify-write 라 동시 갱신이 겹치면 값이 밀린다. 프로미스 사슬로 직렬화한다.
let statChain = Promise.resolve();
function bumpDeleted(n) {
  if (n <= 0) return statChain;
  statChain = statChain
    .then(async () => {
      const { deletedCount = 0 } = await chrome.storage.local.get({ deletedCount: 0 });
      await chrome.storage.local.set({
        deletedCount: deletedCount + n,
        lastDeletedAt: Date.now(),
      });
    })
    .catch(() => {});
  return statChain;
}

async function deleteUrls(urls) {
  let deleted = 0;
  for (const url of urls) {
    try {
      await chrome.history.deleteUrl({ url });
      deleted += 1;
    } catch {
      // 이미 지워졌거나 지울 수 없는 항목은 건너뛴다.
    }
  }
  await bumpDeleted(deleted);
  return deleted;
}

async function handleVisit(item) {
  const { enabled, domains } = await settings();
  if (!enabled || !matchedDomain(item?.url, domains)) return;
  await deleteUrls([item.url]);
}

/** 도메인별 텍스트 검색으로 잔여 기록을 훑는다. 가볍고 자주 돌린다. */
async function sweep() {
  const { enabled, domains } = await settings();
  if (!enabled || !domains.length) return 0;

  const urls = new Set();
  for (const domain of domains) {
    const items = await chrome.history.search({
      text: domain,
      startTime: 0,
      maxResults: 10_000,
    });
    for (const item of items) {
      if (matchedDomain(item.url, domains)) urls.add(item.url);
    }
  }
  return deleteUrls(urls);
}

/**
 * 방문 기록 전체를 기간으로 쪼개 훑는다.
 * 텍스트 검색이 놓치는 항목(URL 인코딩·리다이렉트 등)까지 잡지만 느리므로 수동 실행 전용.
 */
async function deepSweep() {
  const { domains } = await settings();
  if (!domains.length) return 0;

  const urls = new Set();
  const now = Date.now();
  for (let end = now; end > now - DEEP_SWEEP_SPAN_MS; end -= DEEP_SWEEP_WINDOW_MS) {
    const items = await chrome.history.search({
      text: '',
      startTime: end - DEEP_SWEEP_WINDOW_MS,
      endTime: end,
      maxResults: 10_000,
    });
    for (const item of items) {
      if (matchedDomain(item.url, domains)) urls.add(item.url);
    }
  }
  return deleteUrls(urls);
}

function ensureAlarm() {
  chrome.alarms.get(SWEEP_ALARM, (alarm) => {
    if (!alarm) chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: SWEEP_PERIOD_MINUTES });
  });
}

chrome.history.onVisited.addListener(handleVisit);
chrome.history.onTitleChanged.addListener(handleVisit);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (!('domains' in changes) && !('enabled' in changes)) return;
  settingsCache = null;
  // 도메인을 새로 등록했으면 그 도메인의 과거 기록도 바로 털어야 자동완성에서 사라진다.
  if ('domains' in changes) sweep().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SWEEP_ALARM) sweep().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  sweep().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  sweep().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const run = { sweep, deepSweep }[msg?.type];
  if (!run) return false;
  run()
    .then((deleted) => sendResponse({ ok: true, deleted }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true; // 비동기 응답
});

ensureAlarm();
