// Passive daily output tracking and loaded-page following scan. UI belongs to the shared drawer.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const M = globalThis.XTBProgressModel, State = globalThis.XTBProgressState;
  const XTB = globalThis.XTB;
  const valid = State.accountKey;
  const myHandle = () => valid(XTB.account());
  const hhmm = date => date.toTimeString().slice(0, 5);
  let S = State.defaults(), activeAccount = null, generation = 0, loadingAccount = null;
  let scanTimer = 0, resetting = false, profileCache = null, readySent = false;
  let unfollowPending = false, unfollowBusyUntil = 0;
  let status = '等待识别登录账号';
  const pageStyle = document.createElement('style');
  pageStyle.id = 'xtb-progress-highlights';
  pageStyle.textContent = '[data-xtbp-no="1"]{background:rgba(255,45,85,.09)!important;box-shadow:inset 3px 0 0 #ff2d55!important}';
  (document.head ?? document.documentElement).append(pageStyle);

  const today = () => ({ ...M.emptyDay(), ...S.days[M.dayKey()] });
  const ownFollowing = () => activeAccount && myHandle() === activeAccount && location.pathname.toLowerCase().replace(/\/$/, '') === `/${activeAccount}/following`;
  function extractCell(cell) {
    const btn = cell.querySelector('[data-testid$="-unfollow"],[data-testid$="-follow"]');
    const match = btn?.getAttribute('data-testid')?.match(/^(\d+)-(unfollow|follow)$/);
    if (!match) return null;
    const links = [...cell.querySelectorAll('a[href]')];
    const link = links.find(a => /^\/[a-z0-9_]{1,15}\/?$/i.test(a.getAttribute('href') ?? ''));
    const handle = valid(link?.getAttribute('href')?.split('/')[1]);
    if (!handle) return null;
    const nameLink = links.find(a => valid(a.getAttribute('href')?.split('/')[1]) === handle && a.textContent.trim() && !a.textContent.trim().startsWith('@'));
    const name = (nameLink?.querySelector('span')?.textContent ?? nameLink?.textContent ?? '').trim();
    const avatar = cell.querySelector('img[src*="pbs.twimg.com/profile_images/"]')?.src ?? '';
    return { handle, uid: match[1], following: match[2] === 'unfollow', f: !!cell.querySelector('[data-testid="userFollowIndicator"]'), name, avatar };
  }
  function refreshHighlights() {
    const enabled = !!S.highlight && ownFollowing() && !S.scanPaused && !resetting;
    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      const row = enabled ? extractCell(cell) : null;
      if (row?.following && !row.f) cell.dataset.xtbpNo = '1';
      else if (cell.hasAttribute('data-xtbp-no')) cell.removeAttribute('data-xtbp-no');
    }
  }
  // Only open X's own, per-person confirmation flow after an explicit drawer action.
  // Recheck live cells after closing the iframe: an account/navigation change must cancel it.
  function unfollowTarget(handle, uid, owner, gen) {
    if (owner !== activeAccount || owner !== myHandle() || gen !== generation || !ownFollowing() || resetting || S.scanPaused) return null;
    const saved = Object.hasOwn(S.following, handle) ? S.following[handle] : null;
    if (!saved || saved.uid !== uid || saved.f || saved.gone) return null;
    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      const row = extractCell(cell);
      if (row?.handle !== handle || row.uid !== uid || !row.following || row.f) continue;
      const button = cell.querySelector(`[data-testid="${uid}-unfollow"]`);
      if (button?.isConnected && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && button.getClientRects().length) return button;
    }
    return null;
  }
  function changed() { refreshHighlights(); XTB.changed(); }
  async function mutate(op, owner = activeAccount, gen = generation) {
    if (!owner || owner !== activeAccount || owner !== myHandle() || gen !== generation) return null;
    const result = await api.runtime.sendMessage({ channel: 'xtb-module', module: 'progress', account: owner, op });
    if (!result || result.error) throw new Error(result?.error ?? '扩展后台不可用');
    if (owner !== activeAccount || owner !== myHandle() || gen !== generation) return null;
    if ((result.state.revision ?? 0) >= (S.revision ?? 0)) S = { ...State.defaults(), ...result.state };
    changed();
    return result;
  }
  async function record(items, fromProfile, owner = activeAccount, gen = generation) {
    const result = await mutate({ type: 'record', items: items.map(({ id, kind, at = new Date() }) => ({ id, kind, time: hhmm(new Date(at)) })) }, owner, gen);
    if (!result) return;
    const added = M.KINDS.filter(kind => result.after[kind] > result.before[kind]);
    if (added.length) status = `${fromProfile ? '已从主页补录' : '已记录发布'}：${added.map(kind => `${M.LABELS[kind]} +${result.after[kind] - result.before[kind]}`).join('，')}`;
    else if (fromProfile && items.length) status = '当前收到的今日内容已核对';
    changed();
  }
  async function scan() {
    scanTimer = 0;
    if (!activeAccount || myHandle() !== activeAccount || resetting || S.scanPaused || !ownFollowing()) { refreshHighlights(); return; }
    const epoch = S.scanEpoch, gen = generation, owner = activeAccount;
    const rows = [...document.querySelectorAll('[data-testid="UserCell"]')].map(extractCell).filter(Boolean);
    if (rows.length) {
      const result = await mutate({ type: 'scan', rows, epoch, day: M.dayKey() }, owner, gen);
      if (result && epoch === S.scanEpoch) status = `已核对当前加载的 ${rows.length} 人；继续浏览可补充`;
    } else status = '关注名单尚未加载，浏览后自动扫描';
    changed();
  }
  function requestScan() {
    if (!scanTimer) scanTimer = setTimeout(() => scan().catch(reportError), 300);
  }
  function reportError() { status = '保存未完成，请刷新 X 页面后重试；原记录保留'; changed(); }
  async function ensureAccount() {
    const next = myHandle();
    if (next === activeAccount || next === loadingAccount) return;
    generation++;
    const gen = generation;
    activeAccount = next; loadingAccount = next; profileCache = null; S = State.defaults();
    status = next ? '正在读取本账号的进度' : '等待识别登录账号'; changed();
    if (!next) { loadingAccount = null; return; }
    try {
      const result = await mutate({ type: 'read' }, next, gen);
      if (!result) return;
      status = '被动记录已开启，浏览自己的主页可补录今日输出';
      if (!readySent) { readySent = true; document.dispatchEvent(new Event('xtbp:ready')); }
      await scan(); changed();
    } catch { if (gen === generation) { activeAccount = null; reportError(); } }
    finally { if (loadingAccount === next) loadingAccount = null; }
  }
  document.addEventListener('xtbp:net', async event => {
    try {
      const { url, body, text, status: httpStatus, account } = JSON.parse(event.detail);
      const owner = activeAccount, gen = generation;
      if (!owner || account?.toLowerCase() !== owner || owner !== myHandle()) return;
      const ok = httpStatus >= 200 && httpStatus < 300;
      if (url.includes('/friendships/create.json')) {
        if (M.followLimited(httpStatus, text)) {
          await mutate({ type: 'settings', followLimitUntil: Date.now() + S.followCooldownMin * 60000 }, owner, gen);
          status = `关注被 X 限速，${S.followCooldownMin} 分钟后可以再试`; changed();
        } else if (ok && !JSON.parse(text)?.errors?.length) await mutate({ type: 'follow', uid: M.unfollowUid(body) }, owner, gen);
        return;
      }
      if (!ok) return;
      if (/\/(UserTweets\w*|User\w*Timeline)$/.test(String(url).split('?')[0])) {
        const items = M.profileTweets(text, owner, M.dayKey());
        const cached = profileCache?.owner === owner && profileCache.key === M.dayKey() ? profileCache.items : [];
        profileCache = { owner, key: M.dayKey(), items: [...new Map([...cached, ...items].map(item => [item.id, item])).values()] };
        await record(items, true, owner, gen); return;
      }
      if (url.includes('/friendships/destroy.json')) {
        if (JSON.parse(text)?.errors?.length) return;
        await mutate({ type: 'unfollow', uid: M.unfollowUid(body) }, owner, gen); return;
      }
      const item = M.classifyCreate(body, text, new Set(S.ownIds));
      if (item) await record([item], false, owner, gen);
    } catch { /* A response or extension reload must not affect X. */ }
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const state = changes.progressAccounts?.newValue?.[activeAccount];
    if (!state || activeAccount !== myHandle() || (state.revision ?? 0) < (S.revision ?? 0)) return;
    const epochChanged = state.scanEpoch !== S.scanEpoch;
    S = { ...State.defaults(), ...state }; changed();
    if (epochChanged && !resetting) requestScan();
  });
  XTB.register('progress', {
    snapshot: () => ({ account: activeAccount, isOwnFollowing: !!ownFollowing(), goals: { ...S.goals }, day: today(), following: structuredClone(S.following), scanPaused: S.scanPaused,
      scanEpoch: S.scanEpoch, followLimitUntil: S.followLimitUntil, followCooldownMin: S.followCooldownMin, status, highlight: S.highlight !== false }),
    async act(action, payload = {}) {
      await ensureAccount();
      if (!activeAccount) return { ok: false, error: '请先登录 X，等待识别当前账号' };
      if (action === 'read') { await mutate({ type: 'read' }); return { ok: true }; }
      if (action === 'toggle-highlight') {
        await mutate({ type: 'highlight', enabled: typeof payload.enabled === 'boolean' ? payload.enabled : !S.highlight });
        return { ok: true };
      }
      if (action === 'settings') {
        await mutate({ type: 'settings', goals: payload.goals, followCooldownMin: payload.followCooldownMin }); return { ok: true };
      }
      if (action === 'open-following') {
        location.assign(`/${activeAccount}/following`); return { ok: true };
      }
      if (action === 'request-unfollow') {
        if (payload.confirmed !== true) return { ok: false, error: '请先确认要取消关注的这一个人' };
        if (unfollowPending || Date.now() < unfollowBusyUntil || document.querySelector('[data-testid="confirmationSheetConfirm"]')) return { ok: false, error: '请先处理 X 当前的确认操作，再选择下一人' };
        const handle = valid(payload.handle), uid = typeof payload.uid === 'string' && /^\d+$/.test(payload.uid) ? payload.uid : '';
        if (!handle || !uid) return { ok: false, error: '目标账号信息不完整，请重新扫描' };
        const owner = activeAccount, gen = generation;
        if (!ownFollowing()) return { ok: false, error: '请先打开自己的正在关注页面，再对当前已加载的人操作' };
        if (!unfollowTarget(handle, uid, owner, gen)) return { ok: false, error: '这位用户未在当前页面加载，或关注关系已变化；请回到名单核对后再试' };
        unfollowPending = true;
        status = `请在 X 中确认是否取消关注 @${handle}`;
        XTB.close({ restoreFocus: false });
        setTimeout(() => {
          try {
            const button = unfollowTarget(handle, uid, owner, gen);
            if (!button || document.querySelector('[data-testid="confirmationSheetConfirm"]')) {
              status = '页面、账号或关注关系已变化，已取消本次操作；请重新核对';
              changed(); return;
            }
            unfollowBusyUntil = Date.now() + 2500;
            button.click();
            // No optimistic removal or counter change. Network observation / scanning owns state.
          } catch {
            status = '未能打开 X 的确认操作，请在原页面重试';
            changed();
          } finally { unfollowPending = false; }
        }, 60);
        return { ok: true, status };
      }
      if (action === 'reset-scan') {
        if (resetting) return { ok: false, error: '正在重新扫描' };
        resetting = true; clearTimeout(scanTimer); scanTimer = 0;
        try {
          await mutate({ type: 'reset' });
          resetting = false;
          await scan();
          const owner = activeAccount, gen = generation;
          if (profileCache?.owner === owner && profileCache.key === M.dayKey()) await record(profileCache.items, true, owner, gen);
          status = ownFollowing() ? '今日扫描已重置，并重新核对当前加载名单' : '今日扫描已重置；打开自己的关注列表可继续扫描';
          changed(); return { ok: true, status };
        } finally { resetting = false; refreshHighlights(); }
      }
      return { ok: false, error: '不支持的进度操作' };
    }
  });
  new MutationObserver(() => { ensureAccount(); requestScan(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-testid', 'href'] });
  ensureAccount();
  // This only reads extension storage. It never fetches X or scrolls the page.
  setInterval(() => { ensureAccount(); mutate({ type: 'read' }).catch(reportError); }, 30000);
  addEventListener('popstate', () => { ensureAccount(); requestScan(); });
})();
