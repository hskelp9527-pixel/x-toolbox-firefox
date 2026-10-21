// Auto-record successful X scheduling. Refresh replays X's own captured list GET.
// Credentials stay inside the page closure; no headers/cookies reach extension storage.
(() => {
  const watched = value => {
    try {
      const url = new URL(String(value), location.href);
      return ['https://x.com', 'https://twitter.com'].includes(url.origin) && /\/(FetchScheduledTweets|CreateScheduledTweet|EditScheduledTweet|UpdateScheduledTweet|DeleteScheduledTweet)$/.test(url.pathname);
    } catch { return false; }
  };
  const owner = () => globalThis.XSBIdentity.current();
  let ready = false;
  let listTemplate = null, scanning = false, scanAgain = false;
  let lastOrder = 0;
  const order = () => (lastOrder = Math.max(Date.now(), lastOrder + 0.01));
  const pending = [];
  function emit(event) {
    if (typeof event.text !== 'string' || event.text.length > 2e6 || !event.account) return;
    const serialized = JSON.stringify(event);
    if (ready) document.dispatchEvent(new CustomEvent('xsb:net', { detail: serialized }));
    else if (pending.length < 20) pending.push(serialized);
  }
  document.addEventListener('xsb:ready', () => {
    ready = true;
    pending.splice(0).forEach(detail => document.dispatchEvent(new CustomEvent('xsb:net', { detail })));
  }, { once: true });
  const original = window.fetch;
  const signal = value => document.dispatchEvent(new CustomEvent('xsb:scan-result', { detail: value }));
  async function scanList(interactive = false) {
    if (scanning) { scanAgain = true; return; }
    const account = owner();
    if (!account || !listTemplate || listTemplate.account !== account) { if (interactive) signal('need-list'); return; }
    scanning = true;
    const requestedAt = order();
    try {
      // Replay only the same GET that X already used. Request headers remain in
      // this page closure and are never sent to the extension or persisted.
      const request = listTemplate.request.clone();
      const response = await original.call(window, request, { cache: 'no-store' });
      const text = await response.text();
      emit({ url: request.url, account, requestedAt, body: '', text, status: response.status });
      if (!response.ok) signal('error');
    } catch { signal('error'); }
    finally { scanning = false; if (scanAgain) { scanAgain = false; scanList(); } }
  }
  document.addEventListener('xsb:scan', event => scanList(event.detail === 'interactive'));
  window.fetch = function(input, init) {
    const url = input instanceof Request ? input.url : new URL(String(input), location.href).href, account = owner(), requestedAt = order();
    let body;
    try {
      if (watched(url)) body = init?.body != null ? Promise.resolve(String(init.body)) : input instanceof Request ? input.clone().text() : Promise.resolve('');
      if (/\/FetchScheduledTweets$/.test(new URL(url).pathname) && ['https://x.com','https://twitter.com'].includes(new URL(url).origin)) {
        const request = new Request(input instanceof Request ? input.clone() : url, init);
        if (request.method === 'GET') listTemplate = { request, account };
      }
    } catch { /* preserve X */ }
    const result = original.apply(this, arguments);
    if (body) result.then(response => Promise.all([body, response.clone().text()]).then(([b, text]) => {
      emit({ url, account, requestedAt, body: b, text, status: response.status });
      if (response.ok && /\/(CreateScheduledTweet|EditScheduledTweet|UpdateScheduledTweet|DeleteScheduledTweet)$/.test(new URL(url).pathname)) scanList();
    })).catch(() => {});
    return result;
  };
  const { open, send, setRequestHeader } = XMLHttpRequest.prototype;
  const state = new WeakMap();
  XMLHttpRequest.prototype.open = function(method, url) { state.set(this, { url: new URL(String(url), location.href).href, method: String(method).toUpperCase(), headers: [] }); return open.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    const result = setRequestHeader.apply(this, arguments), request = state.get(this);
    if (request && /\/FetchScheduledTweets$/.test(new URL(request.url).pathname)) request.headers.push([name,value]);
    return result;
  };
  XMLHttpRequest.prototype.send = function(body) {
    const request = state.get(this);
    if (request && watched(request.url)) {
      const account = owner(), requestedAt = order();
      try {
        if (request.method === 'GET' && /\/FetchScheduledTweets$/.test(new URL(request.url).pathname) && ['https://x.com','https://twitter.com'].includes(new URL(request.url).origin)) {
          listTemplate = { account, request: new Request(request.url, { method:'GET', headers:request.headers, credentials:'include' }) };
        }
      } catch { /* preserve X */ }
      this.addEventListener('load', () => {
        try {
          const text = this.responseType === 'json' ? JSON.stringify(this.response) : ['', 'text'].includes(this.responseType) ? this.responseText : '';
          emit({ url: new URL(request.url, location.href).href, account, requestedAt, body: typeof body === 'string' ? body : '', text, status: this.status });
          if (this.status >= 200 && this.status < 300 && /\/(CreateScheduledTweet|EditScheduledTweet|UpdateScheduledTweet|DeleteScheduledTweet)$/.test(new URL(request.url).pathname)) scanList();
        } catch { /* preserve X */ }
      }, { once: true });
    }
    return send.apply(this, arguments);
  };
})();
