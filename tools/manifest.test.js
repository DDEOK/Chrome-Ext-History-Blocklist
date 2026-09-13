// 압축해제로 로드한 확장은 **버전이 화면에서 유일한 식별 수단**이다.
// 버전을 안 올리고 코드만 고치면 chrome://extensions 카드가 그대로라, 새로고침이
// 먹었는지 옛것이 도는지 구별할 방법이 없다 — 실제로 세 번 고치는 동안 1.0.0 이었다.
//
//   node --test tools/

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(ROOT, name), 'utf8'));


test('manifest.json 과 package.json 의 버전이 같다', () => {
  assert.equal(read('manifest.json').version, read('package.json').version);
});

test('공개 저장소에 확장 ID 를 고정해 두지 않는다', () => {
  // `key` 는 **그 저장소를 만든 사람의 신원**이다. 공개 저장소에 두면 클론한 사람이
  // 전부 같은 확장 ID 를 물려받는다. 자기 기기끼리 설정을 동기화하려는 사람은
  // tools/extension_id.py 안내대로 각자 키를 만들어 로컬에서만 넣는다.
  assert.ok(!('key' in read('manifest.json')), 'manifest 에 key 가 들어갔다');
});

test('_locales 가 default_locale 과 맞고, 언어마다 키가 같다', () => {
  const manifest = read('manifest.json');
  assert.ok(manifest.default_locale, 'default_locale 이 없으면 __MSG_…__ 가 해석되지 않는다');

  const locales = readdirSync(join(ROOT, '_locales'));
  assert.ok(
    locales.includes(manifest.default_locale),
    `default_locale(${manifest.default_locale}) 의 번역 파일이 없다`,
  );

  // 키가 한쪽에만 있으면 그 언어에서 **빈 문자열**이 나온다 — 오류 없이 화면이 빈다.
  const keysOf = (locale) =>
    new Set(Object.keys(read(join('_locales', locale, 'messages.json'))));
  const base = keysOf(manifest.default_locale);
  for (const locale of locales) {
    if (locale === manifest.default_locale) continue;
    const other = keysOf(locale);
    assert.deepEqual([...base].filter((k) => !other.has(k)), [], `${locale} 에 빠진 키`);
    assert.deepEqual([...other].filter((k) => !base.has(k)), [], `${locale} 에만 있는 키`);
  }
});

test('manifest 가 참조하는 __MSG_…__ 키가 번역 파일에 있다', () => {
  const manifest = read('manifest.json');
  const used = [...JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map((m) => m[1]);
  const messages = read(join('_locales', manifest.default_locale, 'messages.json'));
  for (const key of used) {
    assert.ok(key in messages, `manifest 가 쓰는 ${key} 가 번역 파일에 없다`);
  }
});

test('버전이 Chrome 이 받는 형식이다 — 점으로 이은 정수 1~4개', () => {
  const { version } = read('manifest.json');
  assert.match(version, /^\d+(\.\d+){0,3}$/);
  for (const part of version.split('.')) {
    assert.ok(Number(part) <= 65535, `각 자리는 65535 이하여야 한다: ${part}`);
  }
});

test('커밋된 HEAD 의 버전과 다르면 버전을 올려야 한다', () => {
  let committed;
  try {
    committed = JSON.parse(
      execFileSync('git', ['show', 'HEAD:manifest.json'], { cwd: ROOT, encoding: 'utf8' }),
    ).version;
  } catch {
    return; // 저장소가 아니거나 첫 커밋 전 — 검사할 대상이 없다
  }

  const changed = execFileSync('git', ['status', '--porcelain', '--', 'src', 'manifest.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (!changed) return;

  assert.notEqual(
    read('manifest.json').version,
    committed,
    `src/ 나 manifest 를 고쳤는데 버전이 ${committed} 그대로다.\n` +
      '로드되는 변경마다 버전을 올려야 확장 화면에서 반영 여부를 구별할 수 있다.\n' +
      `바뀐 것:\n${changed}`,
  );
});
