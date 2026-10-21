// The host background loads vendor/schedule/model.js before this adapter.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const model = globalThis.XSB;
  let queue = Promise.resolve();
  const isContent = sender => {
    if (sender?.id !== api.runtime.id || !sender.tab || (sender.frameId ?? 0) !== 0) return false;
    try { return ['https://x.com', 'https://twitter.com'].includes(new URL(sender.url).origin); } catch { return false; }
  };
  const isPanel = sender => sender?.id === api.runtime.id && sender.url?.split(/[?#]/)[0] === api.runtime.getURL('panel.html');
  const allowedOperation = url => {
    try {
      const parsed = new URL(url);
      return ['https://x.com', 'https://twitter.com'].includes(parsed.origin) && /\/(FetchScheduledTweets|CreateScheduledTweet|EditScheduledTweet|UpdateScheduledTweet|DeleteScheduledTweet)$/.test(parsed.pathname);
    } catch { return false; }
  };
  async function perform(message) {
    const owner = model.account(message.account);
    const saved = await api.storage.local.get({ scheduleEntries: [], scheduleScans: [], scheduleClocks: [] });
    if (!Array.isArray(saved.scheduleEntries) || !Array.isArray(saved.scheduleScans) || !Array.isArray(saved.scheduleClocks)) throw new Error('发稿存储无法读取，请先备份');
    let entries = saved.scheduleEntries, scans = saved.scheduleScans, clocks = saved.scheduleClocks;
    let recognized = false, ignored = false;
    if (message.type === 'open-list') await api.tabs.create({ url: 'https://x.com/compose/post/unsent/scheduled' });
    if (message.type === 'network') {
      const event = message.event;
      if (!event || event.account !== owner || typeof event.text !== 'string' || event.text.length > 2e6 || typeof event.body !== 'string' || event.body.length > 2e6 || !allowedOperation(event.url)) throw new Error('发稿扫描数据不完整');
      const parsed = model.networkEvent(event);
      if (parsed) {
        recognized = true;
        const requestedAt = event.requestedAt;
        if (!Number.isFinite(requestedAt) || requestedAt < Date.now() - 86400000 || requestedAt > Date.now() + 60000) throw new Error('扫描请求顺序无效，请刷新 X 页面');
        const clock = clocks.find(item => item.account === owner) ?? { account: owner, snapshotAt: 0, mutationAt: 0, items: [] };
        if (!Array.isArray(clock.items) || !Number.isFinite(clock.snapshotAt) || !Number.isFinite(clock.mutationAt)) throw new Error('发稿扫描状态无法读取');
        const id = parsed.id ?? parsed.records?.[0]?.id;
        const itemAt = clock.items.find(item => item.id === id)?.at ?? 0;
        const stale = parsed.type === 'snapshot'
          ? requestedAt <= clock.mutationAt || requestedAt < clock.snapshotAt
          : requestedAt < Math.max(itemAt, clock.snapshotAt);
        ignored = stale;
        if (!stale) {
          entries = model.applyEvent(entries, parsed);
          if (parsed.type === 'snapshot') {
            clock.snapshotAt = requestedAt;
            scans = [...scans.filter(item => item.account !== owner), { account: owner, at: Date.now(), count: parsed.records.length }];
          } else {
            clock.mutationAt = Math.max(clock.mutationAt, requestedAt);
            clock.items = [...clock.items.filter(item => item.id !== id), { id, at: requestedAt }].slice(-5000);
          }
          clocks = [...clocks.filter(item => item.account !== owner), clock];
          await api.storage.local.set({ scheduleEntries: entries, scheduleScans: scans, scheduleClocks: clocks });
        }
      }
    }
    return { ok: true, recognized, ignored, entries: entries.filter(item => item.account === owner), scan: scans.find(item => item.account === owner) ?? null };
  }
  function handle(message, sender) {
    if (!['list', 'network', 'open-list'].includes(message?.type)) return Promise.resolve({ ok: false, error: '未知发稿操作' });
    if (!(isContent(sender) || (message.type !== 'network' && isPanel(sender)))) return Promise.resolve({ ok: false, error: '发稿操作来源无效' });
    const work = queue.then(() => perform(message));
    queue = work.catch(() => {});
    return work.catch(error => ({ ok: false, error: error.message }));
  }
  globalThis.XTBBackends ??= {};
  globalThis.XTBBackends.schedule = { handle };
})();
