// 방문 기록을 지우는 본체. 세 갈래로 잡는다.
//   1. history.onVisited — 방문 직후 (주 경로). 이 리스너가 잠든 서비스 워커를 깨우므로
//                          워커가 종료돼 있어도 방문 자체를 놓치지는 않는다.
//   2. 지연 재확인       — 삭제 직후 Chrome 이 같은 URL 을 다시 쓰는 경우를 회수
//   3. alarms 주기 스윕  — 1·2 가 실패했거나 확장이 꺼져 있던 사이의 방문 회수
//
// chrome.history 의 이벤트는 onVisited 와 onVisitRemoved 둘뿐이다.
// onTitleChanged 는 존재하지 않는다 — 쓰면 서비스 워커가 등록 단계에서 죽는다.
// 서비스 워커는 수시로 종료되므로 리스너 등록은 반드시 최상위에서 한다.

import { getSettings, matchedDomain } from './shared.js';
// 주소표시줄 키워드 모드. 정적 import 라 워커 최초 평가에 포함되고,
// 그 안의 리스너도 최상위에서 등록된다 (MV3 가 요구하는 조건).
import './omnibox.js';

const SWEEP_ALARM = 'history-blocklist-sweep';
const SWEEP_PERIOD_MINUTES = 5;
/** 삭제 직후 같은 URL 을 다시 지워보는 시점(ms). 재기록을 짧은 창에서 회수한다. */
const RECHECK_DELAYS_MS = [1_500, 6_000];
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

/**
 * 지운 URL 을 잠시 뒤 다시 지워본다.
 * Chrome 이 제목·파비콘을 붙이며 같은 URL 을 되살리는 경우가 있는데, 이를 알려주는
 * 이벤트가 history API 에 없다. 짧은 재확인으로 메우고, 남는 것은 주기 스윕이 받는다.
 */
function scheduleRecheck(url) {
  for (const delay of RECHECK_DELAYS_MS) {
    setTimeout(() => {
      chrome.history.deleteUrl({ url }).catch(() => {});
    }, delay);
  }
}

async function handleVisit(item) {
  const { enabled, domains } = await settings();
  if (!enabled || !matchedDomain(item?.url, domains)) return;
  await deleteUrls([item.url]);
  scheduleRecheck(item.url);
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
