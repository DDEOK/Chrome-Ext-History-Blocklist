import { addDomain, getSettings, getStats, removeDomain, setEnabled } from './shared.js';

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

function renderList(domains) {
  el.list.replaceChildren();

  if (!domains.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '등록된 도메인이 없다.';
    el.list.append(li);
    return;
  }

  for (const domain of domains) {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'domain mono';
    name.textContent = domain;
    name.title = domain;

    const remove = document.createElement('button');
    remove.textContent = '삭제';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      await removeDomain(domain);
      say(`${domain} 삭제. 이후 방문부터 기록이 남는다.`, 'ok');
      await render();
    });

    li.append(name, remove);
    el.list.append(li);
  }
}

async function render() {
  const [{ enabled, domains }, { deletedCount, lastDeletedAt }] = await Promise.all([
    getSettings(),
    getStats(),
  ]);

  el.enabled.checked = enabled;
  el.enabledLabel.textContent = enabled ? '켜짐' : '꺼짐';
  renderList(domains);

  const last = lastDeletedAt
    ? new Date(lastDeletedAt).toLocaleString('ko-KR')
    : '없음';
  el.stats.textContent = `지운 기록 ${deletedCount.toLocaleString('ko-KR')}건 · 마지막 삭제 ${last}`;
}

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const raw = el.input.value;
  if (!raw.trim()) return;

  const result = await addDomain(raw);
  if (result.ok) {
    el.input.value = '';
    say(`${result.domain} 추가. 과거 기록도 정리 중이다.`, 'ok');
  } else if (result.reason === 'duplicate') {
    say(`${result.domain} 은(는) 이미 등록돼 있다.`, 'error');
  } else {
    say('도메인으로 읽을 수 없는 입력이다.', 'error');
  }
  await render();
});

el.enabled.addEventListener('change', async () => {
  await setEnabled(el.enabled.checked);
  await render();
});

el.deepSweep.addEventListener('click', async () => {
  el.deepSweep.disabled = true;
  el.sweepResult.textContent = '훑는 중…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'deepSweep' });
    el.sweepResult.textContent = response?.ok
      ? `${response.deleted.toLocaleString('ko-KR')}건 삭제`
      : `실패: ${response?.error ?? '응답 없음'}`;
  } catch (error) {
    el.sweepResult.textContent = `실패: ${error}`;
  }
  el.deepSweep.disabled = false;
  await render();
});

// 팝업에서 바꾼 내용이 열려 있는 설정 화면에도 바로 반영되게 한다.
chrome.storage.onChanged.addListener(() => {
  render();
});

await render();
