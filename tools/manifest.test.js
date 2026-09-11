// 압축해제로 로드한 확장은 **버전이 화면에서 유일한 식별 수단**이다.
// 버전을 안 올리고 코드만 고치면 chrome://extensions 카드가 그대로라, 새로고침이
// 먹었는지 옛것이 도는지 구별할 방법이 없다 — 실제로 세 번 고치는 동안 1.0.0 이었다.
//
//   node --test tools/

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(ROOT, name), 'utf8'));

/**
 * 세 기기가 같은 `chrome.storage.sync` 통을 쓰려면 확장 ID 가 같아야 하고,
 * ID 는 manifest 의 `key` 에서만 나온다. 이 값이 바뀌면 **설정이 조용히 사라진 것처럼**
 * 보이므로(옛 ID 통에 남는다) 상수로 못박는다.
 */
const EXPECTED_ID = 'jhkhlikcigccmladmjnknhfijmjlnccc';
const HEX_TO_ALPHA = { ...Object.fromEntries([...'0123456789abcdef'].map((c, i) => [c, 'abcdefghijklmnop'[i]])) };

function extensionId(keyB64) {
  const digest = createHash('sha256').update(Buffer.from(keyB64, 'base64')).digest('hex');
  return [...digest.slice(0, 32)].map((c) => HEX_TO_ALPHA[c]).join('');
}

test('manifest.json 과 package.json 의 버전이 같다', () => {
  assert.equal(read('manifest.json').version, read('package.json').version);
});

test('확장 ID 가 고정돼 있다 — 기기 간 설정 동기화의 전제', () => {
  const { key } = read('manifest.json');
  assert.ok(key, 'manifest 에 key 가 없으면 ID 가 설치 경로에서 나와 기기마다 달라진다');
  assert.equal(extensionId(key), EXPECTED_ID);
});

test('manifest 의 공개키가 keys/extension-key.pem 에서 나온 것이다', () => {
  const pem = readFileSync(join(ROOT, 'keys', 'extension-key.pem'), 'utf8');
  const derived = createPublicKey(pem).export({ type: 'spki', format: 'der' }).toString('base64');
  assert.equal(derived, read('manifest.json').key, '개인키를 다시 만들었으면 manifest 의 key 도 바꿔야 한다');
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
