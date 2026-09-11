import {
  addDomain,
  getSettings,
  getStats,
  hostMatches,
  removeDomain,
  setEnabled,
} from './shared.js';

const el = {
  enabled: document.getElementById('enabled'),
  host: document.getElementById('host'),
  toggle: document.getElementById('toggle'),
  status: document.getElementById('status'),
  stats: document.getElementById('stats'),
  options: document.getElementById('open-options'),
  version: document.getElementById('version'),
};

// 압축해제 로드는 버전이 안 바뀌면 새로고침이 먹었는지 화면으로 구별할 수 없다.
el.version.textContent = `v${chrome.runtime.getManifest().version}`;

/** 현재 탭의 호스트명. http/https 가 아니면 null. */
let currentHost = null;
/** 현재 호스트를 덮고 있는 등록 도메인. 없으면 null. */
let coveringDomain = null;

function say(text, kind = '') {
  el.status.textContent = text;
  el.status.className = `status ${kind}`;
}

async function readCurrentHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    const u = new URL(tab.url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function render() {
  const [{ enabled, domains }, { deletedCount }] = await Promise.all([getSettings(), getStats()]);

  el.enabled.checked = enabled;
  el.stats.textContent = `지운 기록 ${deletedCount.toLocaleString('ko-KR')}건 · 등록 ${domains.length}개`;

  coveringDomain = currentHost ? (domains.find((d) => hostMatches(currentHost, d)) ?? null) : null;

  if (!currentHost) {
    el.host.textContent = '이 탭은 대상이 아님';
    el.toggle.textContent = '—';
    el.toggle.disabled = true;
    return;
  }

  el.host.textContent = currentHost;
  el.host.title = currentHost;
  el.toggle.disabled = false;

  if (!coveringDomain) {
    el.toggle.textContent = `${currentHost} 차단`;
    el.toggle.classList.add('primary');
    return;
  }

  el.toggle.classList.remove('primary');
  el.toggle.textContent =
    coveringDomain === currentHost ? `${currentHost} 차단 해제` : `${coveringDomain} 차단 해제`;
  if (coveringDomain !== currentHost) {
    say(`상위 도메인 ${coveringDomain} 규칙에 걸려 있다.`);
  }
}

el.toggle.addEventListener('click', async () => {
  el.toggle.disabled = true;
  if (coveringDomain) {
    await removeDomain(coveringDomain);
    say(`${coveringDomain} 차단 해제. 이후 방문부터 기록이 남는다.`, 'ok');
  } else {
    const result = await addDomain(currentHost);
    say(
      result.ok
        ? `${result.domain} 차단. 과거 기록도 정리 중이다.`
        : '이미 등록돼 있거나 올바른 도메인이 아니다.',
      result.ok ? 'ok' : 'error',
    );
  }
  await render();
});

el.enabled.addEventListener('change', async () => {
  await setEnabled(el.enabled.checked);
  say(el.enabled.checked ? '켰다.' : '껐다. 기록이 그대로 남는다.', el.enabled.checked ? 'ok' : '');
});

el.options.addEventListener('click', () => chrome.runtime.openOptionsPage());

currentHost = await readCurrentHost();
await render();
