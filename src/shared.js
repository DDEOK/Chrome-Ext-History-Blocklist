// 백그라운드·팝업·옵션이 함께 쓰는 도메인 매칭과 설정 접근.
// 매칭 규칙은 한 곳(matchedDomain)에만 두고, 화면 쪽에서 다시 구현하지 않는다.
//
// 저장 구조: 도메인 하나에 키 하나(`d:example.com` → 추가 시각 ms).
// 목록 전체를 배열 한 키에 담으면 `chrome.storage.sync` 가 **키 단위로 마지막 쓰기만**
// 남기므로, 두 기기가 각각 추가하면 한쪽 추가분이 통째로 사라진다. 키를 쪼개면 서버가
// 키 단위로 병합해 둘 다 남는다 — 충돌 해소용 타임스탬프가 따로 필요 없어진다.

const DOMAIN_PREFIX = 'd:';
/** v1.2.0 이하가 쓰던 배열 키. 첫 실행에 옮기고 지운다. */
const LEGACY_KEY = 'domains';
/** storage.sync 의 MAX_ITEMS 는 512. `enabled` 등 여유를 두고 상한을 잡는다. */
const MAX_DOMAINS = 480;

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

/** 저장된 키 전체에서 도메인 목록과 추가 시각을 뽑는다. 아직 안 옮긴 배열도 함께 읽는다. */
function readDomains(all) {
  const addedAt = new Map();
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(DOMAIN_PREFIX)) continue;
    addedAt.set(key.slice(DOMAIN_PREFIX.length), Number(value) || 0);
  }
  // 마이그레이션 전이거나 옛 버전 기기가 아직 쓰고 있는 배열
  for (const domain of Array.isArray(all[LEGACY_KEY]) ? all[LEGACY_KEY] : []) {
    if (!addedAt.has(domain)) addedAt.set(domain, 0);
  }
  return addedAt;
}

export async function getSettings() {
  const all = await chrome.storage.sync.get(null);
  const addedAt = readDomains(all);
  return {
    enabled: all.enabled !== false,
    domains: [...addedAt.keys()].sort(),
    addedAt,
  };
}

export async function getStats() {
  return chrome.storage.local.get(LOCAL_DEFAULTS);
}

export async function setEnabled(enabled) {
  await chrome.storage.sync.set({ enabled: !!enabled });
}

export async function addDomain(raw) {
  const domain = normalizeDomain(raw);
  if (!domain) return { ok: false, reason: 'invalid' };

  const { domains } = await getSettings();
  if (domains.includes(domain)) return { ok: false, reason: 'duplicate', domain };
  if (domains.length >= MAX_DOMAINS) return { ok: false, reason: 'full', domain };

  await chrome.storage.sync.set({ [DOMAIN_PREFIX + domain]: Date.now() });
  return { ok: true, domain };
}

export async function removeDomain(domain) {
  await chrome.storage.sync.remove(DOMAIN_PREFIX + domain);

  // 아직 안 옮긴 배열에도 있으면 같이 뺀다. 안 그러면 지워도 다시 읽혀 되살아난다.
  const stored = await chrome.storage.sync.get(LEGACY_KEY);
  const legacy = stored[LEGACY_KEY];
  if (Array.isArray(legacy) && legacy.includes(domain)) {
    await chrome.storage.sync.set({ [LEGACY_KEY]: legacy.filter((d) => d !== domain) });
  }
}

/**
 * v1.2.0 이하의 `domains` 배열을 키 단위 저장으로 옮긴다. 없으면 아무 일도 하지 않는다.
 * 원본은 지우기 전에 **그 기기의 로컬 저장소**에 사본을 남긴다 — 동기화를 타지 않으므로
 * 잘못돼도 기기마다 되돌릴 근거가 남는다. 여러 기기가 각자 실행해도 결과가 같다.
 */
export async function migrateLegacyDomains() {
  const stored = await chrome.storage.sync.get(LEGACY_KEY);
  const legacy = stored[LEGACY_KEY];
  if (!Array.isArray(legacy) || !legacy.length) return 0;

  await chrome.storage.local.set({
    legacyDomainsBackup: legacy,
    legacyBackupAt: Date.now(),
  });

  const now = Date.now();
  const entries = Object.fromEntries(
    legacy.filter(Boolean).map((domain) => [DOMAIN_PREFIX + domain, now]),
  );
  await chrome.storage.sync.set(entries);
  await chrome.storage.sync.remove(LEGACY_KEY);
  return legacy.length;
}

/** 저장 구조가 바뀌었는지 화면·백그라운드가 판정할 때 쓴다. */
export function isDomainChange(changes) {
  return Object.keys(changes).some((k) => k.startsWith(DOMAIN_PREFIX) || k === LEGACY_KEY);
}

export const STORAGE = { DOMAIN_PREFIX, LEGACY_KEY, MAX_DOMAINS };
