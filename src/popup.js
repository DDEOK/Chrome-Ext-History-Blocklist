import { localizeDocument, t } from './i18n.js';
import {
  addDomain,
  getSettings,
  getStats,
  hostMatches,
  removeDomain,
  setEnabled,
} from './shared.js';

localizeDocument();

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
  el.stats.textContent = t('popupStats', [
    deletedCount.toLocaleString(),
    String(domains.length),
  ]);

  coveringDomain = currentHost ? (domains.find((d) => hostMatches(currentHost, d)) ?? null) : null;

  if (!currentHost) {
    el.host.textContent = t('notApplicableTab');
    el.toggle.textContent = '—';
    el.toggle.disabled = true;
    return;
  }

  el.host.textContent = currentHost;
  el.host.title = currentHost;
  el.toggle.disabled = false;

  if (!coveringDomain) {
    el.toggle.textContent = t('blockHost', [currentHost]);
    el.toggle.classList.add('primary');
    return;
  }

  el.toggle.classList.remove('primary');
  el.toggle.textContent = t('unblockHost', [coveringDomain]);
  if (coveringDomain !== currentHost) say(t('coveredByParent', [coveringDomain]));
}

el.toggle.addEventListener('click', async () => {
  el.toggle.disabled = true;
  if (coveringDomain) {
    const removed = coveringDomain;
    await removeDomain(removed);
    say(t('unblockedNow', [removed]), 'ok');
  } else {
    const result = await addDomain(currentHost);
    const failure = { duplicate: 'errDuplicate', full: 'errFull' };
    say(
      result.ok
        ? t('blockedNow', [result.domain])
        : t(failure[result.reason] ?? 'errInvalid', [result.domain ?? currentHost]),
      result.ok ? 'ok' : 'error',
    );
  }
  await render();
});

el.enabled.addEventListener('change', async () => {
  await setEnabled(el.enabled.checked);
  say(t(el.enabled.checked ? 'turnedOn' : 'turnedOff'), el.enabled.checked ? 'ok' : '');
});

el.options.addEventListener('click', () => chrome.runtime.openOptionsPage());

currentHost = await readCurrentHost();
await render();
