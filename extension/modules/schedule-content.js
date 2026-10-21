// No standalone widget: the shared bottom drawer consumes this cached engine.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  let account = '', entries = [], scan = null, status = '', error = '';
  let accountRevision = 0, ownerTimer, scanPending = false;
  const currentAccount = () => globalThis.XTB.account();
  const changed = () => globalThis.XTB.changed();
  function setStatus(message = '', failure = '') {
    status = message; error = failure; changed();
  }
  function syncAccount() {
    const owner = currentAccount();
    if (owner === account) return false;
    accountRevision++;
    account = owner; entries = []; scan = null; scanPending = false;
    setStatus();
    return true;
  }
  async function request(type, extra = {}) {
    syncAccount();
    const owner = currentAccount(), revision = accountRevision;
    if (!owner) throw new Error('等待 X 账号加载');
    const response = await api.runtime.sendMessage({ channel: 'xtb-module', module: 'schedule', type, ...extra, account: owner });
    if (owner !== currentAccount() || revision !== accountRevision) throw new Error('账号已切换，请重新操作');
    if (!response?.ok) throw new Error(response?.error ?? '请重新加载扩展并刷新 X');
    account = owner;
    entries = response.entries;
    scan = response.scan;
    changed();
    return response;
  }
  async function act(action, payload = {}) {
    try {
      if (action === 'read') {
        await request('list');
        return { ok: true, status };
      }
      if (action === 'refresh') {
        const interactive = !(payload === 'quiet' || payload?.mode === 'quiet' || payload?.quiet === true || payload?.interactive === false);
        await request('list');
        scanPending = interactive;
        setStatus(interactive ? '正在扫描 X 已安排列表…' : '已读取本机安排；打开 X 定时列表可补录');
        document.dispatchEvent(new CustomEvent('xsb:scan', { detail: interactive ? 'interactive' : 'quiet' }));
        return { ok: true, status };
      }
      return { ok: false, error: '未知发稿操作' };
    } catch (failure) {
      setStatus('', failure.message);
      return { ok: false, error: failure.message };
    }
  }
  globalThis.XTB.register('schedule', {
    snapshot: () => ({ account, entries, scan, status, error }),
    act
  });
  function refreshAccount() {
    if (!syncAccount()) return;
    const owner = account;
    if (owner) request('list').catch(failure => {
      if (owner === currentAccount()) setStatus('', failure.message);
    });
  }
  document.addEventListener('xsb:scan-result', event => {
    if (event.detail === 'need-list' && scanPending) {
      scanPending = false;
      request('open-list').then(() => setStatus('已另开 X 定时列表扫描，当前草稿保留')).catch(failure => setStatus('', failure.message));
    } else if (event.detail === 'error') {
      scanPending = false;
      setStatus('', '扫描未完成，点刷新重试');
    }
  });
  document.addEventListener('xsb:net', event => {
    try {
      if (typeof event.detail !== 'string' || event.detail.length > 4100000) return;
      const network = JSON.parse(event.detail);
      if (network.account !== currentAccount()) return;
      request('network', { event: network }).then(response => {
        if (response.ignored) return;
        scanPending = false;
        if (response.recognized) {
          const operation = new URL(network.url).pathname.split('/').pop();
          setStatus(operation === 'FetchScheduledTweets' ? '已刷新 X 定时列表' : operation === 'DeleteScheduledTweet' ? '已更新安排' : '已自动记录定时稿');
        } else setStatus('', '未识别本次 X 返回，原记录保留；点刷新核对列表');
      }).catch(failure => setStatus('', failure.message));
    } catch { /* Only structured events for the signed-in account are handled. */ }
  });
  new MutationObserver(() => {
    clearTimeout(ownerTimer);
    ownerTimer = setTimeout(refreshAccount, 120);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.scheduleEntries || changes.scheduleScans)) request('list').catch(() => {});
  });
  refreshAccount();
  document.dispatchEvent(new CustomEvent('xsb:ready'));
  // Account identity can change without DOM children changing (e.g. an unloaded
  // navigation). This only rereads local identity/storage, never requests X.
  setInterval(refreshAccount, 3000);
})();
