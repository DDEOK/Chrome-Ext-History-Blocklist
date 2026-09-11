// 압축해제로 로드한 확장은 **버전이 화면에서 유일한 식별 수단**이다.
// 버전을 안 올리고 코드만 고치면 chrome://extensions 카드가 그대로라, 새로고침이
// 먹었는지 옛것이 도는지 구별할 방법이 없다 — 실제로 세 번 고치는 동안 1.0.0 이었다.
//
//   node --test tools/

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(ROOT, name), 'utf8'));

test('manifest.json 과 package.json 의 버전이 같다', () => {
  assert.equal(read('manifest.json').version, read('package.json').version);
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
