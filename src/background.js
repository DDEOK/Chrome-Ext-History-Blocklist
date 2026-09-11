// 방문 기록을 지우는 본체. 세 갈래로 잡는다.
//   1. history.onVisited — 방문 직후 (주 경로). 이 리스너가 잠든 서비스 워커를 깨우므로
//                          워커가 종료돼 있어도 방문 자체를 놓치지는 않는다.
//   2. 지연 재확인       — 삭제 직후 Chrome 이 같은 URL 을 다시 쓰는 경우를 회수
//   3. alarms 주기 스윕  — 1·2 가 실패했거나 확장이 꺼져 있던 사이의 방문 회수
//
// 과거 기록은 둘로 나눠 턴다: 도메인이 새로 들어오면(직접 등록이든 동기화든) 그 도메인만
// 전 기간 **전수** 로 한 번, 그 뒤로는 주기 스윕의 텍스트 검색이 맡는다.
//
// chrome.history 의 이벤트는 onVisited 와 onVisitRemoved 둘뿐이다.
// onTitleChanged 는 존재하지 않는다 — 쓰면 서비스 워커가 등록 단계에서 죽는다.
// 서비스 워커는 수시로 종료되므로 리스너 등록은 반드시 최상위에서 한다.

import { getSettings, isDomainChange, matchedDomain, migrateLegacyDomains } from './shared.js';
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
/** 주기 스윕이 텍스트 검색과 별개로 통째로 훑는 최근 구간. */
const RECENT_SCAN_MS = 7 * DAY_MS;
const SEARCH_LIMIT = 5_000;
/** 창을 더 쪼개도 의미가 없어지는 하한. 이보다 좁은데도 상한을 치면 포기하고 넘어간다. */
const MIN_WINDOW_MS = 60_000;
/** 전수 스캔을 마친 도메인 표(`storage.local`, 기기별). `{ [domain]: 마친 시각 }` */
const FULL_SCAN_KEY = 'fullScanned';

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

/**
 * 기간을 훑어 걸리는 URL 을 모은다.
 * `history.search` 는 maxResults 를 넘으면 **말없이 잘라내므로**, 상한을 치면 창을 반으로
 * 쪼개 다시 본다. 안 그러면 기록이 몰린 구간에서 오래된 것부터 조용히 빠진다.
 */
async function collectInRange(startTime, endTime, domains, urls) {
  const items = await chrome.history.search({
    text: '',
    startTime,
    endTime,
    maxResults: SEARCH_LIMIT,
  });

  if (items.length >= SEARCH_LIMIT && endTime - startTime > MIN_WINDOW_MS) {
    const mid = startTime + Math.floor((endTime - startTime) / 2);
    await collectInRange(startTime, mid, domains, urls);
    await collectInRange(mid, endTime, domains, urls);
    return;
  }

  for (const item of items) {
    if (matchedDomain(item.url, domains)) urls.add(item.url);
  }
}

/** 전 기간을 창으로 쪼개 훑는다. 대상 도메인만 본다. */
async function scanAllTime(domains) {
  const urls = new Set();
  const now = Date.now();
  for (let end = now; end > now - DEEP_SWEEP_SPAN_MS; end -= DEEP_SWEEP_WINDOW_MS) {
    await collectInRange(end - DEEP_SWEEP_WINDOW_MS, end, domains, urls);
  }
  return deleteUrls(urls);
}

/**
 * 아직 전수 스캔을 안 거친 도메인이 있으면 그것만 골라 한 번 훑는다.
 *
 * 텍스트 검색은 Chrome 의 토큰화에 기대므로 못 잡는 형태가 남는다. "등록하면 과거 기록도
 * 정리된다"가 참이려면 **도메인이 새로 들어온 순간 한 번은 전수로** 봐야 하고, 그 도메인이
 * 다른 기기에서 동기화로 들어온 경우도 마찬가지다(그 기기에는 그 도메인 기록이 쌓여 있다).
 *
 * 마친 표시는 **끝난 뒤에** 남긴다 — 중간에 서비스 워커가 죽으면 표시가 안 되고 다음 주기
 * 스윕이 다시 시도한다. 기기별 상태라 `storage.local` 에 둔다(동기화를 타면 안 된다).
 */
async function catchUpFullScan(domains) {
  const stored = await chrome.storage.local.get({ [FULL_SCAN_KEY]: {} });
  const done = stored[FULL_SCAN_KEY] ?? {};
  const pending = domains.filter((d) => !done[d]);
  if (!pending.length) return 0;

  const deleted = await scanAllTime(pending);

  const next = {};
  for (const domain of domains) {
    next[domain] = done[domain] ?? Date.now(); // 목록에서 빠진 도메인은 표에서도 지운다
  }
  for (const domain of pending) next[domain] = Date.now();
  await chrome.storage.local.set({ [FULL_SCAN_KEY]: next });

  return deleted;
}

/**
 * 도메인별 텍스트 검색 + 최근 구간 전수 훑기. 가볍고 자주 돈다.
 * 새로 들어온 도메인이 있으면 그것만 전 기간 전수로 한 번 더 본다.
 */
async function runSweep() {
  const { enabled, domains } = await settings();
  if (!enabled || !domains.length) return 0;

  const urls = new Set();
  for (const domain of domains) {
    const items = await chrome.history.search({
      text: domain,
      startTime: 0,
      maxResults: SEARCH_LIMIT,
    });
    for (const item of items) {
      if (matchedDomain(item.url, domains)) urls.add(item.url);
    }
  }

  const now = Date.now();
  await collectInRange(now - RECENT_SCAN_MS, now, domains, urls);

  const deleted = await deleteUrls(urls);
  return deleted + (await catchUpFullScan(domains));
}

/**
 * 방문 기록 전체를 기간으로 쪼개 훑는다. 느리므로 수동 실행 전용.
 * 꺼져 있으면 **지우지 않는다** — 끈 상태에서 버튼 하나로 기록이 사라지면 안 된다.
 */
async function runDeepSweep() {
  const { enabled, domains } = await settings();
  if (!enabled) return { skipped: 'disabled' };
  if (!domains.length) return { deleted: 0 };

  const deleted = await scanAllTime(domains);

  // 전부 훑었으니 자동 전수 스캔 대기 목록도 비운다.
  const now = Date.now();
  await chrome.storage.local.set({
    [FULL_SCAN_KEY]: Object.fromEntries(domains.map((d) => [d, now])),
  });
  return { deleted };
}

// 알람·설정 변경·버튼이 동시에 부를 수 있다. 겹쳐 돌면 같은 URL 을 두 번 세어
// "지운 기록" 통계가 부풀므로, 진행 중인 것이 있으면 그것을 함께 기다린다.
let sweepInFlight = null;
function sweep() {
  if (!sweepInFlight) {
    sweepInFlight = runSweep().finally(() => {
      sweepInFlight = null;
    });
  }
  return sweepInFlight;
}

let deepSweepInFlight = null;
function deepSweep() {
  if (!deepSweepInFlight) {
    deepSweepInFlight = runDeepSweep().finally(() => {
      deepSweepInFlight = null;
    });
  }
  return deepSweepInFlight;
}

function ensureAlarm() {
  chrome.alarms.get(SWEEP_ALARM, (alarm) => {
    if (!alarm) chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: SWEEP_PERIOD_MINUTES });
  });
}

async function start() {
  ensureAlarm();
  // 옛 배열 저장 구조를 키 단위로 옮긴다. 이미 옮겼으면 아무 일도 하지 않는다.
  const moved = await migrateLegacyDomains().catch(() => 0);
  if (moved) settingsCache = null;
  await sweep().catch(() => {});
}

chrome.history.onVisited.addListener(handleVisit);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  const domainsChanged = isDomainChange(changes);
  if (!domainsChanged && !('enabled' in changes)) return;
  settingsCache = null;
  // 도메인이 늘었으면(다른 기기에서 온 것 포함) 그 기록을 바로 털어야 자동완성에서 사라진다.
  if (domainsChanged) sweep().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SWEEP_ALARM) sweep().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  start().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  start().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'sweep') {
    sweep()
      .then((deleted) => sendResponse({ ok: true, deleted }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (msg?.type === 'deepSweep') {
    deepSweep()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});

start().catch(() => {});
