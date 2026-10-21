globalThis.XSB = (() => {
  const MAX = 5000;
  const account = value => {
    const name = String(value ?? '').replace(/^@/, '').trim();
    if (!/^[A-Za-z0-9_]{1,15}$/.test(name)) throw new Error('请先在 X 登录并显示当前账号');
    return name.toLowerCase();
  };
  const parse = v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
  function timestamp(value) {
    if (value === null || value === undefined || value === '') throw new Error('时间无效');
    let n = typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : Date.parse(value);
    if (n > 0 && n < 1e12) n *= 1000;
    if (!Number.isFinite(n) || n < Date.UTC(2006, 0, 1) || n > Date.UTC(2200, 0, 1)) throw new Error('时间超出支持范围');
    return Math.round(n);
  }
  const text = v => String(v ?? '').trim().slice(0, 1000);
  function localTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new Error('请选择完整日期和时间');
    const [, y, m, d, h, min] = match.map(Number);
    const date = new Date(y, m - 1, d, h, min);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date.getHours() !== h || date.getMinutes() !== min) throw new Error('日期无效，或此时间因夏令时不存在');
    return timestamp(date.getTime());
  }
  function validEntry(e) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || e.id.length > 200 || !['manual', 'x'].includes(e.source)) throw new Error('备份包含无效记录');
    if (typeof e.text !== 'string' || e.text.length > 1000) throw new Error('备份内容格式不正确');
    return { id: e.id, account: account(e.account), at: timestamp(e.at), text: e.text, source: e.source,
      present: e.present !== false, updatedAt: timestamp(e.updatedAt ?? Date.now()) };
  }
  function upsert(entries, entry) {
    const e = validEntry(entry);
    const existing = entries.find(old => old.account === e.account && (old.id === e.id || (old.at === e.at && old.text === e.text && old.source !== e.source)));
    // A manual note must never downgrade an observed X record.
    if (existing?.source === 'x' && e.source === 'manual') return entries;
    const next = entries.filter(old => old !== existing && !(old.id === e.id && old.account === e.account));
    if (next.length >= MAX) throw new Error('记录超过 5000 条，请先导出并清理历史');
    return [...next, e];
  }
  function manual(entries, owner, at, summary, id) {
    const a = account(owner), t = timestamp(at), note = text(summary);
    const prior = id && entries.find(e => e.account === a && e.id === id);
    if (prior?.source === 'x') throw new Error('请在 X 定时列表中修改安排，再扫描更新');
    const same = entries.find(e => e.account === a && e.at === t && e.text === note);
    return upsert(entries, { id: prior?.id ?? same?.id ?? `manual:${crypto.randomUUID()}`, account: a, at: t, text: note, source: 'manual', present: true, updatedAt: Date.now() });
  }
  function scheduledRecord(node, owner) {
    if (!node || typeof node !== 'object') return null;
    const at = node.scheduling_info?.execute_at ?? node.execute_at ?? node.scheduled_at ?? node.scheduled_time;
    const id = node.rest_id ?? node.scheduled_tweet_id ?? node.id;
    const request = node.tweet_create_request ?? node.tweet_request ?? node.post_tweet_request ?? node;
    if (at == null || id == null) return null;
    try { return validEntry({ id: `x:${id}`, account: owner, at: timestamp(at), text: text(request.status ?? request.tweet_text ?? node.text), source: 'x', present: true, updatedAt: Date.now() }); } catch { return null; }
  }
  function networkEvent(event) {
    const owner = account(event.account);
    const operation = new URL(event.url).pathname.split('/').pop();
    if (Number(event.status) < 200 || Number(event.status) >= 300) return null;
    const response = parse(event.text);
    if (!response?.data || response.errors?.length) return null;
    const variables = parse(parse(event.body)?.variables) ?? {};
    if (operation === 'FetchScheduledTweets') {
      const list = response.data.viewer?.scheduled_tweet_list;
      if (!Array.isArray(list) || list.length > MAX) return null;
      const records = list.map(n => scheduledRecord(n, owner));
      // An unknown nonempty schema is not an empty list; leave stored state intact.
      if (records.some(e => !e)) return null;
      return { type: 'snapshot', owner, records };
    }
    if (['CreateScheduledTweet', 'EditScheduledTweet', 'UpdateScheduledTweet'].includes(operation)) {
      const node = response.data.tweet ?? response.data.scheduled_tweet_create ?? response.data.scheduled_tweet_update ?? response.data.scheduled_tweet_edit;
      if (!node || typeof node !== 'object') return null;
      const record = scheduledRecord({ ...variables, ...node }, owner);
      return record ? { type: 'upsert', owner, records: [record] } : null;
    }
    if (operation === 'DeleteScheduledTweet') {
      // Do not assume an arbitrary successful HTTP response means deletion succeeded.
      const result = response.data.scheduled_tweet_delete;
      if (!variables.scheduled_tweet_id || !result || (typeof result === 'object' && result.success === false)) return null;
      return { type: 'missing', owner, id: `x:${variables.scheduled_tweet_id}` };
    }
    return null;
  }
  function applyEvent(entries, event) {
    let next = entries;
    if (event.type === 'snapshot') {
      const ids = new Set(event.records.map(e => e.id));
      next = entries.map(e => e.account === event.owner && e.source === 'x' ? { ...e, present: ids.has(e.id) } : e);
    }
    if (event.type === 'missing') return entries.map(e => e.account === event.owner && e.id === event.id ? { ...e, present: false, updatedAt: Date.now() } : e);
    for (const record of event.records ?? []) next = upsert(next, record);
    return next;
  }
  function importBackup(entries, payload) {
    if (payload?.format !== 'x-schedule-board' || payload.version !== 1 || !Array.isArray(payload.entries) || payload.entries.length > MAX) throw new Error('请选择本插件导出的 JSON 备份');
    const validated = payload.entries.map(validEntry);
    let next = entries;
    for (const entry of validated) next = upsert(next, entry);
    return next;
  }
  return { account, timestamp, text, localTime, validEntry, upsert, manual, scheduledRecord, networkEvent, applyEvent, importBackup };
})();
