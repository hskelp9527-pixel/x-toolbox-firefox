// Adapted from X Mention Saver 1.3.0. The queue serializes cross-tab changes.
(() => {
  const api = globalThis.browser || globalThis.chrome;
  const { mergeEntry, migrateEntries, enrichEntries } = globalThis.XMSModel;
  let queue = Promise.resolve();
  const methods = new Set(['list', 'save', 'remove', 'import', 'enrich', 'scan', 'insert']);
  function privileges(sender) {
    let trustedUI = false, trustedContent = false;
    try {
      const url = new URL(sender.url), origin = new URL(api.runtime.getURL('panel.html'));
      trustedUI = sender.id === api.runtime.id && url.protocol === origin.protocol && url.host === origin.host && url.pathname === '/panel.html';
      trustedContent = sender.id === api.runtime.id && Boolean(sender.tab) && sender.frameId === 0 && url.protocol === 'https:' && ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname);
    } catch {}
    return { trustedUI, trustedContent };
  }
  async function work(message, sender) {
    const type = message.type || message.action;
    if (!methods.has(type)) throw new Error('不支持的联系人操作');
    const { trustedUI, trustedContent } = privileges(sender);
    if (!trustedUI && !(trustedContent && ['save', 'enrich'].includes(type))) throw new Error('不允许的请求来源');
    const data = await api.storage.local.get({ mentionEntries: [] });
    let entries = migrateEntries(data.mentionEntries), result = {};
    if (type === 'insert') {
      if (!sender.tab || !(sender.frameId > 0) || !/^[a-f0-9-]{36}$/i.test(message.composerToken || '')) throw new Error('请从 X 输入框旁的小 @ 打开名单后插入');
      if (!Array.isArray(message.ids) || !message.ids.length || message.ids.length > 100) throw new Error('请选择 1–100 位联系人');
      const people = [...new Set(message.ids)].map(id => entries.find(entry => entry.id === id));
      if (people.some(person => !person)) throw new Error('联系人已变化，请重新打开名单');
      const response = await api.tabs.sendMessage(sender.tab.id, {
        type: 'xms-insert-mentions', composerToken: message.composerToken,
        handles: people.map(person => person.handle), separator: ['line', '\n'].includes(message.separator) ? '\n' : ' '
      }, { frameId: 0 });
      if (!response?.ok) throw new Error(response?.error || '输入框不可用，请重新从输入框旁的小 @ 打开名单');
      return { ok: true, inserted: people.length };
    }
    if (type === 'save') {
      result = mergeEntry(entries, message.handle, message.note, trustedUI && Object.hasOwn(message, 'note'), message.displayName, message.avatarUrl);
      entries = result.entries;
    } else if (type === 'remove') {
      entries = entries.filter(entry => entry.id !== message.id);
    } else if (type === 'import') {
      if (!Array.isArray(message.entries) || message.entries.length > 5000) throw new Error('备份格式不正确或超过 5000 条');
      const imported = migrateEntries(message.entries);
      for (const entry of imported.slice().reverse()) entries = mergeEntry(entries, entry.handle, entry.note, false, entry.displayName, entry.avatarUrl).entries;
    } else if (type === 'scan' || type === 'enrich') {
      let profiles = message.profiles;
      if (type === 'scan') {
        if (!sender.tab || !(sender.frameId > 0)) throw new Error('请在 X 页面打开抽屉后扫描');
        try { profiles = (await api.tabs.sendMessage(sender.tab.id, { type: 'xms-scan-profiles' }, { frameId: 0 }))?.profiles; }
        catch { throw new Error('请先刷新 X 页面，再扫描当前已加载的用户'); }
      }
      result = enrichEntries(entries, profiles);
      entries = result.entries;
      if (trustedUI) result.profiles = profiles;
    }
    if (JSON.stringify(data.mentionEntries) !== JSON.stringify(entries)) {
      await api.storage.local.set({ mentionEntries: entries });
      api.runtime.sendMessage({ channel: 'xtb-ui-update' }).catch(() => {});
    }
    return {
      ok: true, duplicate: result.duplicate, handle: result.handle, updated: result.updated,
      ...(trustedUI ? { entries, ...(result.profiles ? { profiles: result.profiles } : {}) } : {})
    };
  }
  globalThis.XTBBackends ||= {};
  globalThis.XTBBackends.mentions = {
    handle(message, sender) {
      const operation = queue.then(() => work(message, sender));
      queue = operation.catch(() => {});
      return operation.catch(error => ({ ok: false, error: error.message }));
    }
  };
})();
