/**
 * chrome.storage 래퍼 — 이카운트 인증 정보 및 설정 저장
 */

const KEYS = {
  ECOUNT_CREDENTIALS: 'ecount_credentials',
  ECOUNT_SESSION: 'ecount_session',
  ECOUNT_ZONE: 'ecount_zone',
  WORKFLOW_HISTORY: 'workflow_history',
  SETTINGS: 'settings',
  ANTHROPIC_API_KEY: 'anthropic_api_key',
};

/** @param {string} key @param {any} value */
async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

/** @param {string} key @param {any} [defaultValue] */
async function get(key, defaultValue = null) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? defaultValue;
}

/** @param {string} key */
async function remove(key) {
  await chrome.storage.local.remove(key);
}

// ── 이카운트 인증 ──

async function saveCredentials({ comCode, userId, apiCertKey }) {
  await set(KEYS.ECOUNT_CREDENTIALS, { comCode, userId, apiCertKey });
}

async function getCredentials() {
  return get(KEYS.ECOUNT_CREDENTIALS);
}

async function saveSession(sessionId, zoneUrl) {
  await set(KEYS.ECOUNT_SESSION, {
    sessionId,
    zoneUrl,
    savedAt: Date.now(),
  });
}

async function getSession() {
  const session = await get(KEYS.ECOUNT_SESSION);
  if (!session) return null;
  // 세션 24시간 만료 체크
  if (Date.now() - session.savedAt > 24 * 60 * 60 * 1000) {
    await remove(KEYS.ECOUNT_SESSION);
    return null;
  }
  return session;
}

// ── 워크플로우 이력 ──

async function addWorkflowHistory(entry) {
  const history = await get(KEYS.WORKFLOW_HISTORY, []);
  history.unshift({ ...entry, timestamp: Date.now() });
  // 최근 100건만 유지
  if (history.length > 100) history.length = 100;
  await set(KEYS.WORKFLOW_HISTORY, history);
}

async function getWorkflowHistory() {
  return get(KEYS.WORKFLOW_HISTORY, []);
}

// ── Anthropic API Key ──

async function saveAnthropicKey(key) {
  await set(KEYS.ANTHROPIC_API_KEY, key);
}

async function getAnthropicKey() {
  return get(KEYS.ANTHROPIC_API_KEY);
}

// ── 설정 ──

async function saveSettings(settings) {
  const current = await get(KEYS.SETTINGS, {});
  await set(KEYS.SETTINGS, { ...current, ...settings });
}

async function getSettings() {
  return get(KEYS.SETTINGS, {});
}

export {
  KEYS,
  set, get, remove,
  saveCredentials, getCredentials,
  saveSession, getSession,
  addWorkflowHistory, getWorkflowHistory,
  saveAnthropicKey, getAnthropicKey,
  saveSettings, getSettings,
};
