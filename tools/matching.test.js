// 도메인 매칭은 되돌릴 수 없는 삭제를 좌우한다 — 과매칭이 곧 사고다.
//   node --test tools/
// chrome.* 에 의존하지 않는 순수 함수만 검증한다.

import assert from 'node:assert/strict';
import test from 'node:test';

import { hostMatches, matchedDomain, normalizeDomain } from '../src/shared.js';

test('normalizeDomain — 사람이 넣을 법한 입력을 호스트명으로 줄인다', () => {
  const cases = {
    'blocked.example': 'blocked.example',
    '  BloCkEd.ExAmPlE  ': 'blocked.example',
    'https://blocked.example/board/list?page=2': 'blocked.example',
    'blocked.example/board': 'blocked.example',
    'blocked.example:8443': 'blocked.example',
    '*.blocked.example': 'blocked.example',
    '.blocked.example.': 'blocked.example',
    '한글도메인.kr': 'xn--bj0bj3i97fq8o5lq.kr',
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(normalizeDomain(input), expected, `입력: ${input}`);
  }
});

test('normalizeDomain — www 는 떼고 2단계 도메인은 건드리지 않는다', () => {
  assert.equal(normalizeDomain('www.blocked.example'), 'blocked.example');
  assert.equal(normalizeDomain('https://www.example.com/a/b'), 'example.com');
  // www.com 은 그 자체가 도메인이다 — 떼면 빈 값이 된다
  assert.equal(normalizeDomain('www.com'), 'www.com');
  // www 로 시작할 뿐인 호스트는 그대로 둔다
  assert.equal(normalizeDomain('www2.example.com'), 'www2.example.com');
  assert.equal(normalizeDomain('wwwx.example.com'), 'wwwx.example.com');
});

test('normalizeDomain — 도메인이 아닌 입력은 빈 문자열', () => {
  for (const input of ['', '   ', null, undefined, 'not a domain', '/', '://']) {
    assert.equal(normalizeDomain(input), '', `입력: ${JSON.stringify(input)}`);
  }
});

test('hostMatches — 자신과 서브도메인만 걸린다', () => {
  assert.ok(hostMatches('blocked.example', 'blocked.example'));
  assert.ok(hostMatches('www.blocked.example', 'blocked.example'));
  assert.ok(hostMatches('a.b.blocked.example', 'blocked.example'));

  // 접미사만 같은 남의 도메인을 잡으면 안 된다 — 가장 위험한 오판이다
  assert.ok(!hostMatches('notblocked.example', 'blocked.example'));
  assert.ok(!hostMatches('blocked.example.evil.com', 'blocked.example'));
  assert.ok(!hostMatches('blocked.exam', 'blocked.example'));
  assert.ok(!hostMatches('', 'blocked.example'));
  assert.ok(!hostMatches('blocked.example', ''));
});

test('matchedDomain — http/https 만 대상으로 삼고 걸린 도메인을 돌려준다', () => {
  const domains = ['blocked.example', 'example.com'];

  assert.equal(matchedDomain('https://m.blocked.example/x', domains), 'blocked.example');
  assert.equal(matchedDomain('http://example.com', domains), 'example.com');
  assert.equal(matchedDomain('https://EXAMPLE.com/A', domains), 'example.com');

  assert.equal(matchedDomain('https://other.com', domains), null);
  assert.equal(matchedDomain('chrome://history', domains), null);
  assert.equal(matchedDomain('file:///Users/x/blocked.example.html', domains), null);
  assert.equal(matchedDomain('not a url', domains), null);
  assert.equal(matchedDomain('https://blocked.example', []), null);
});
