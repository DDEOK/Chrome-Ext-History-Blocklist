// 백그라운드·팝업·옵션이 함께 쓰는 도메인 매칭과 설정 접근.
// 매칭 규칙은 한 곳(matchedDomain)에만 두고, 화면 쪽에서 다시 구현하지 않는다.

const SYNC_DEFAULTS = { enabled: true, domains: [] };
const LOCAL_DEFAULTS = { deletedCount: 0, lastDeletedAt: 0 };

/**
 * 사용자가 입력한 문자열을 호스트명으로 정규화한다.
 * URL 통째로·앞뒤 점·`*.` 와일드카드·포트·대문자를 모두 받아준다.
 * 정규화할 수 없으면 빈 문자열을 돌려준다(호출부가 거부 판정에 쓴다).
 */
export function normalizeDomain(raw) {
  let s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '';

  if (s.includes('/') || s.includes('://')) {
    try {
      s = new URL(s.includes('://') ? s : `http://${s}`).hostname;
    } catch {
      s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0];
    }
  }

  s = s.replace(/^\*+\./, '').replace(/^\.+/, '').replace(/\.+$/, '');
  s = s.split('@').pop(); // user:pass@host 형태 방어
  s = s.split(':')[0]; // 포트 제거

  // 퓨니코드 변환은 URL 이 해준다. 여기까지 와서 실패하면 입력이 도메인이 아니다.
  let host;
  try {
    host = new URL(`http://${s}`).hostname;
  } catch {
    return '';
  }
  if (!/^[a-z0-9.-]+$/.test(host) || !host) return '';

  // 주소창에서 URL 을 복사하면 www 가 붙어 온다. 그대로 저장하면 www 없는 주소가
  // 안 걸려 "지웠는데 자동완성에 남는" 상태가 된다. 서브도메인 매칭이 역방향은
  // 못 해주므로 여기서 떼어 상위 도메인으로 등록한다.
  if (host.startsWith('www.') && host.split('.').length > 2) host = host.slice(4);

  return host;
}

/** 호스트명이 도메인 자신이거나 그 서브도메인인가. */
export function hostMatches(hostname, domain) {
  if (!hostname || !domain) return false;
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * URL 이 차단 목록에 걸리면 걸린 도메인을, 아니면 null 을 돌려준다.
 * http/https 가 아닌 스킴(chrome://, file:// 등)은 대상에서 뺀다.
 */
export function matchedDomain(url, domains) {
  if (!url || !domains?.length) return null;
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    host = u.hostname.toLowerCase();
  } catch {
    return null;
  }
  return domains.find((d) => hostMatches(host, d)) ?? null;
}

export async function getSettings() {
  const v = await chrome.storage.sync.get(SYNC_DEFAULTS);
  return {
    enabled: v.enabled !== false,
    domains: Array.isArray(v.domains) ? v.domains : [],
  };
}

export async function getStats() {
  return chrome.storage.local.get(LOCAL_DEFAULTS);
}

export async function setEnabled(enabled) {
  await chrome.storage.sync.set({ enabled: !!enabled });
}

/** 정규화·중복 제거·정렬을 거쳐 저장한다. 저장된 최종 목록을 돌려준다. */
export async function saveDomains(list) {
  const domains = [...new Set(list.map(normalizeDomain).filter(Boolean))].sort();
  await chrome.storage.sync.set({ domains });
  return domains;
}

export async function addDomain(raw) {
  const domain = normalizeDomain(raw);
  if (!domain) return { ok: false, reason: 'invalid' };
  const { domains } = await getSettings();
  if (domains.includes(domain)) return { ok: false, reason: 'duplicate', domain };
  return { ok: true, domain, domains: await saveDomains([...domains, domain]) };
}

export async function removeDomain(domain) {
  const { domains } = await getSettings();
  return saveDomains(domains.filter((d) => d !== domain));
}
