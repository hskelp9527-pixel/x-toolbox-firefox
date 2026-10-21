// The progress module owns its storage queue; no top-level names collide with other tools.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const model = globalThis.XTBProgressModel, stateModel = globalThis.XTBProgressState;
  const contentOps = new Set(['read', 'record', 'scan', 'reset', 'resume', 'unfollow', 'follow', 'settings', 'highlight']);
  const panelOps = new Set(['read', 'reset', 'settings', 'highlight']);
  let pending = Promise.resolve();
  function source(sender) {
    if (sender?.frameId === 0 && /^https:\/\/(x\.com|twitter\.com)\//.test(sender.url ?? '')) return 'content';
    try {
      const url = new URL(sender?.url ?? '');
      const own = new URL(api.runtime.getURL('panel.html'));
      if (url.protocol === own.protocol && url.host === own.host && url.pathname === own.pathname) return 'panel';
    } catch { /* A missing sender is never trusted. */ }
    return '';
  }
  function handle(message, sender) {
    const account = stateModel.accountKey(message?.account);
    const role = source(sender), op = message?.op ?? { type: 'read' };
    if (!role || !(role === 'content' ? contentOps : panelOps).has(op.type)) return Promise.resolve({ error: '进度操作来源不受支持' });
    if (!account) return Promise.resolve({ error: '无法识别当前 X 账号' });
    // The extension UI cannot manufacture a rate-limit observation or write panel geometry here.
    const safeOp = role === 'panel' && op.type === 'settings'
      ? { type: 'settings', goals: op.goals, followCooldownMin: op.followCooldownMin } : op;
    const task = async () => {
      const saved = await api.storage.local.get('progressAccounts');
      const accounts = Object.assign(Object.create(null), saved.progressAccounts ?? {});
      const result = stateModel.update(accounts[account], safeOp, model.dayKey());
      Object.defineProperty(accounts, account, { value: result.state, enumerable: true, configurable: true, writable: true });
      await api.storage.local.set({ progressAccounts: accounts });
      return { ...result, account };
    };
    const job = pending.then(task);
    pending = job.catch(() => {});
    return job.catch(error => ({ error: String(error?.message ?? error) }));
  }
  globalThis.XTBBackends ??= {};
  globalThis.XTBBackends.progress = { handle };
})();
