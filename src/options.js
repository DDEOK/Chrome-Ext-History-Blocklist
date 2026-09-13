import { localizeDocument, t } from './i18n.js';
import { addDomain, getSettings, getStats, removeDomain, setEnabled } from './shared.js';

localizeDocument();

const el = {
  enabled: document.getElementById('enabled'),
  enabledLabel: document.getElementById('enabled-label'),
  form: document.getElementById('add-form'),
  input: document.getElementById('domain-input'),
  status: document.getElementById('status'),
  list: document.getElementById('list'),
  deepSweep: document.getElementById('deep-sweep'),
  sweepResult: document.getElementById('sweep-result'),
  stats: document.getElementById('stats'),
  version: document.getElementById('version'),
};

// 압축해제 로드는 버전이 안 바뀌면 새로고침이 먹었는지 화면으로 구별할 수 없다.
el.version.textContent = `v${chrome.runtime.getManifest().version}`;

function say(text, kind = '') {
  el.status.textContent = text;
  el.status.className = `status ${kind}`;
}

function renderList(domains, addedAt) {
  el.list.replaceChildren();

  if (!domains.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = t('listEmpty');
    el.list.append(li);
    return;
  }

  for (const domain of domains) {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'domain mono';
    name.textContent = domain;
    name.title = domain;

    // 추가 시각은 키 단위 저장의 값이다. 0 이면 옛 배열에서 옮겨온 것이라 시점을 모른다.
    const when = document.createElement('span');
    when.className = 'dim';
    const ts = addedAt?.get(domain);
    when.textContent = ts ? new Date(ts).toLocaleDateString() : '';
    when.title = ts ? new Date(ts).toLocaleString() : t('migratedNoDate');

    const remove = document.createElement('button');
    remove.textContent = t('remove');
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      await removeDomain(domain);
      say(t('removedNow', [domain]), 'ok');
      await render();
    });

    li.append(name, when, remove);
    el.list.append(li);
  }
}

async function render() {
  const [{ enabled, domains, addedAt }, { deletedCount, lastDeletedAt }] = await Promise.all([
    getSettings(),
    getStats(),
  ]);

  el.enabled.checked = enabled;
  el.enabledLabel.textContent = t(enabled ? 'on' : 'off');
  renderList(domains, addedAt);

  const last = lastDeletedAt ? new Date(lastDeletedAt).toLocaleString() : t('statsNever');
  el.stats.textContent = t('statsLine', [deletedCount.toLocaleString(), last]);
}

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const raw = el.input.value;
  if (!raw.trim()) return;

  const result = await addDomain(raw);
  if (result.ok) {
    el.input.value = '';
    say(t('addedNow', [result.domain]), 'ok');
  } else {
    const failure = { duplicate: 'errDuplicate', full: 'errFull' };
    say(t(failure[result.reason] ?? 'errInvalid', [result.domain ?? raw.trim()]), 'error');
  }
  await render();
});

el.enabled.addEventListener('change', async () => {
  await setEnabled(el.enabled.checked);
  await render();
});

el.deepSweep.addEventListener('click', async () => {
  el.deepSweep.disabled = true;
  el.sweepResult.textContent = t('sweepRunning');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'deepSweep' });
    if (!response?.ok) {
      el.sweepResult.textContent = t('sweepFailed', [String(response?.error ?? '')]);
    } else if (response.skipped === 'disabled') {
      el.sweepResult.textContent = t('sweepDisabled');
    } else {
      el.sweepResult.textContent = t('sweepDeleted', [response.deleted.toLocaleString()]);
    }
  } catch (error) {
    el.sweepResult.textContent = t('sweepFailed', [String(error)]);
  }
  el.deepSweep.disabled = false;
  await render();
});

// 팝업이나 다른 기기에서 바꾼 내용이 열려 있는 설정 화면에도 바로 반영되게 한다.
chrome.storage.onChanged.addListener(() => {
  render();
});

await render();
