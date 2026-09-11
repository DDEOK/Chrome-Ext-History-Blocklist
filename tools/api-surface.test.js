// 없는 chrome API 를 부르면 서비스 워커가 **등록 단계에서 통째로 죽는다**.
// 확장을 실제로 로드하기 전에는 안 드러나고, 화면에는 "Service worker registration
// failed" 만 뜬다. 실제로 chrome.history.onTitleChanged(존재하지 않는 이벤트)로 한 번
//밟았다 — chrome.history 의 이벤트는 onVisited 와 onVisitRemoved 둘뿐이다.
//
// 그래서 쓰는 API 를 화이트리스트로 고정한다. 새 API 를 쓰려면 공식 문서에서 실재를
// 확인하고 여기 이름을 더해야 한다. 목록에 더하는 그 한 줄이 확인 절차다.
//
//   node --test tools/

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** developer.chrome.com 에서 실재를 확인한 것만 (2026-09-11 확인). */
const VERIFIED = new Set([
  'chrome.alarms.create',
  'chrome.alarms.get',
  'chrome.alarms.onAlarm',
  'chrome.history.deleteUrl',
  'chrome.history.onVisited',
  'chrome.history.search',
  'chrome.runtime.onInstalled',
  'chrome.runtime.onMessage',
  'chrome.runtime.onStartup',
  'chrome.runtime.openOptionsPage',
  'chrome.runtime.sendMessage',
  'chrome.storage.local',
  'chrome.storage.onChanged',
  'chrome.storage.sync',
  'chrome.tabs.query',
]);

/** manifest 에 선언한 권한으로 쓸 수 있어야 한다. activeTab 은 여기 적지 않는다(호출 시점 부여). */
const PERMISSION_OF = {
  alarms: 'alarms',
  history: 'history',
  storage: 'storage',
};

function usedApis() {
  const found = new Map(); // api -> 파일 목록
  for (const name of readdirSync(SRC_DIR).filter((f) => f.endsWith('.js'))) {
    const source = readFileSync(join(SRC_DIR, name), 'utf8');
    for (const [api] of source.matchAll(/\bchrome\.[a-zA-Z]+\.[a-zA-Z]+/g)) {
      found.set(api, [...(found.get(api) ?? []), name]);
    }
  }
  return found;
}

test('쓰는 chrome API 는 모두 실재가 확인된 것이다', () => {
  const unverified = [...usedApis()]
    .filter(([api]) => !VERIFIED.has(api))
    .map(([api, files]) => `${api} (${files.join(', ')})`);

  assert.deepEqual(
    unverified,
    [],
    `공식 문서에서 확인하지 않은 chrome API 다. 실재를 확인하고 VERIFIED 에 더해라:\n  ${unverified.join('\n  ')}`,
  );
});

test('화이트리스트에 죽은 항목이 없다', () => {
  const used = new Set(usedApis().keys());
  const dead = [...VERIFIED].filter((api) => !used.has(api));
  assert.deepEqual(dead, [], `이제 안 쓰는 API 다. VERIFIED 에서 지워라:\n  ${dead.join('\n  ')}`);
});

test('쓰는 API 의 권한이 manifest 에 선언돼 있다', () => {
  const manifest = JSON.parse(
    readFileSync(join(SRC_DIR, '..', 'manifest.json'), 'utf8'),
  );
  const declared = new Set(manifest.permissions ?? []);

  const missing = [...usedApis().keys()]
    .map((api) => PERMISSION_OF[api.split('.')[1]])
    .filter((permission) => permission && !declared.has(permission));

  assert.deepEqual([...new Set(missing)], [], 'manifest.json 의 permissions 에 빠진 권한이 있다');
});
