// Isolated content only. Complete saved contact collections never enter this script.
(() => {
  const pattern = /^@[A-Za-z0-9_]{1,15}$/;
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0 auto auto 0;z-index:2147483647;display:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `button{box-sizing:border-box;height:32px;padding:0 12px;border:1px solid #b9d9fb;border-radius:999px;background:#fff;color:#0866b9;box-shadow:0 3px 14px #0002;font:600 13px/1 system-ui,sans-serif;white-space:nowrap;cursor:pointer}button:hover{background:#edf6ff}button:focus-visible{outline:2px solid #0866b9;outline-offset:2px}button:disabled{cursor:default}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '+ 保存';
  button.setAttribute('aria-label', '保存选中的 X 用户名');
  shadow.append(style, button);
  document.documentElement.append(host);
  let handle = '';
  let displayName = '';
  let avatarUrl = '';
  let busy = false;
  let feedback = false;
  let timer;
  let frame;
  const hide = () => { host.style.display = 'none'; handle = ''; feedback = false; clearTimeout(timer); };

  function refresh() {
    if (busy) return;
    if (document.querySelector('[data-xtb-panel]')) { hide(); return; }
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!pattern.test(text) || !selection.rangeCount || selection.isCollapsed) { hide(); return; }
    // Do not offer a save button in a post editor or a form field.
    const node = selection.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (element?.closest('input,textarea,[contenteditable]:not([contenteditable="false"])')) { hide(); return; }
    const rects = [...selection.getRangeAt(0).getClientRects()].filter(rect => rect.width && rect.height);
    if (!rects.length) { hide(); return; }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) { hide(); return; }
    if (text !== handle) { feedback = false; clearTimeout(timer); }
    handle = text;
    const profile = globalThis.XMSProfiles.extract(element, text);
    displayName = profile.displayName;
    avatarUrl = profile.avatarUrl;
    if (!feedback) button.textContent = '+ 保存';
    button.disabled = false;
    host.style.display = 'block';
    const { width, height } = button.getBoundingClientRect();
    const gap = 8;
    let left, top;
    if (rect.right + gap + width <= innerWidth - gap) {
      left = rect.right + gap; top = rect.top + (rect.height - height) / 2;
    } else if (rect.left - gap - width >= gap) {
      left = rect.left - gap - width; top = rect.top + (rect.height - height) / 2;
    } else {
      left = Math.max(gap, Math.min(rect.left, innerWidth - width - gap));
      top = rect.bottom + gap;
      if (top + height > innerHeight - gap) top = rect.top - height - gap;
    }
    top = Math.max(gap, Math.min(top, innerHeight - height - gap));
    if (rects.some(part => left < part.right && left + width > part.left && top < part.bottom && top + height > part.top)) { hide(); return; }
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh); };
  // Preserve the selection when clicking the floating button.
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', async () => {
    if (busy || !handle) return;
    busy = true;
    const savedHandle = handle;
    button.disabled = true;
    button.textContent = '保存中…';
    try {
      const result = await (globalThis.browser??globalThis.chrome).runtime.sendMessage({ channel:'xtb-module', module:'mentions', type: 'save', handle: savedHandle, displayName, avatarUrl });
      if (!result?.ok) throw new Error(result?.error || '保存失败');
      button.textContent = result.duplicate ? '✓ 已收藏' : '✓ 已保存';
    } catch {
      button.textContent = '保存失败，请重试';
    } finally {
      busy = false;
      feedback = true;
      button.disabled = false;
      timer = setTimeout(hide, 1800);
      if (window.getSelection()?.toString().trim() !== savedHandle) schedule();
    }
  });
  document.addEventListener('selectionchange', schedule);
  document.addEventListener('xtb-panel-open', hide);
  document.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
})();


// Keep one small @ beside each editor; the shared extension drawer owns all UI.
(() => {
  const editorSelector = '[contenteditable="true"][data-testid^="tweetTextarea_"],textarea[data-testid^="tweetTextarea_"]';
  const mounted = new Map();
  let launcher, composerToken, bookmark, recentEditor, status='点击输入框旁的 @，可直接加入联系人';
  function remember(editor) {
    if (editor instanceof HTMLTextAreaElement) return {editor,start:editor.selectionStart,end:editor.selectionEnd};
    const selection=window.getSelection();
    if(selection?.rangeCount&&editor.contains(selection.getRangeAt(0).commonAncestorContainer))return {editor,range:selection.getRangeAt(0).cloneRange()};
    return bookmark?.editor===editor?bookmark:{editor};
  }
  function invalidate() {
    launcher?.setAttribute('aria-expanded','false');
    composerToken=null; launcher=null; bookmark=null;
    status='点击输入框旁的 @，可直接加入联系人'; XTB.changed();
  }
  function prepare(editor=recentEditor) {
    if (!editor?.isConnected || !mounted.has(editor)) {
      invalidate(); return {ok:true,canInsert:false,composerToken:null};
    }
    const saved=remember(editor); invalidate(); bookmark=saved;
    launcher=mounted.get(editor).button; composerToken=crypto.randomUUID();
    launcher.setAttribute('aria-expanded','true');
    status='点击联系人，加入刚才的输入框'; XTB.changed();
    return {ok:true,canInsert:true,composerToken};
  }
  function open(button) {
    const editor=[...mounted].find(([,record])=>record.button===button)?.[0];
    if(!editor?.isConnected)return;
    recentEditor=editor;
    const prepared=prepare(editor);
    XTB.open('mentions',{composerToken:prepared.composerToken});
  }
  document.addEventListener('focusin', event=> {
    const editor=event.target.closest?.(editorSelector);
    if(editor){recentEditor=editor;if(!composerToken)bookmark=remember(editor);}
  },true);
  document.addEventListener('selectionchange',()=>{
    const editor=document.activeElement?.closest?.(editorSelector);
    if(editor&&(!composerToken||bookmark?.editor===editor)) {recentEditor=editor;bookmark=remember(editor);}
  });
  document.addEventListener('xtb-panel-close',invalidate);
  function toolbarFor(editor) {
    // Stop before crossing another composer. A page-wide first toolbar could
    // attach a reply's launcher to the main post editor.
    for (let scope = editor.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
      if (scope.querySelectorAll(editorSelector).length !== 1) break;
      const toolbar = scope.querySelector('[data-testid="toolBar"],[role="toolbar"]');
      if (toolbar && !editor.contains(toolbar)) return toolbar;
    }
    return null;
  }
  function iconGroup(toolbar) {
    const originalButton = toolbar.querySelector('button:not([data-xms-launcher]),[role="button"]:not([data-xms-launcher])');
    const group = originalButton?.parentElement;
    // Use the existing icon row where available; never create another row.
    if (group && toolbar.contains(group) && ['flex', 'inline-flex'].includes(getComputedStyle(group).display) && getComputedStyle(group).flexDirection === 'row') return group;
    return toolbar;
  }
  function placeFloating() {
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || innerWidth), bottom = top + (viewport?.height || innerHeight);
    for (const [editor, record] of mounted) {
      if (!record.floating || !editor.isConnected) continue;
      const rect = editor.getBoundingClientRect();
      record.button.style.display = rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right ? 'inline-flex' : 'none';
      record.button.style.left = `${Math.max(left + 2, Math.min(rect.right - 32, right - 32))}px`;
      record.button.style.top = `${Math.max(top + 2, Math.min(rect.top + 2, bottom - 32))}px`;
    }
  }
  const resizeObserver = new ResizeObserver(() => { placeFloating(); });
  function mount() {
    for (const [editor, record] of mounted) {
      if (!editor.isConnected) {
        if (record.button === launcher) invalidate();
        record.button.remove(); resizeObserver.unobserve(editor); mounted.delete(editor);
      }
    }
    for (const editor of document.querySelectorAll(editorSelector)) {
      const toolbar = toolbarFor(editor);
      const current = mounted.get(editor);
      if (current?.button.isConnected && current.toolbar === toolbar) continue;
      current?.button.remove();
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = '@'; button.dataset.xmsLauncher = '';
      button.title = '记得 @';
      button.setAttribute('aria-label', '打开记得 @ 收藏'); button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.style.cssText = 'box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex:0 0 30px;width:30px;height:30px;min-width:30px;max-height:30px;padding:0;margin:0;border:0;border-radius:50%;background:transparent;color:rgb(29,155,240);font:600 20px/1 system-ui;cursor:pointer;touch-action:manipulation;vertical-align:middle';
      button.addEventListener('pointerdown', () => { bookmark=remember(editor); });
      button.addEventListener('click', () => open(button));
      let floating = !toolbar;
      if (toolbar) {
        const beforeHeight = toolbar.getBoundingClientRect().height;
        iconGroup(toolbar).append(button);
        // A crowded/wrapping toolbar must not gain a second line.
        if (toolbar.getBoundingClientRect().height > beforeHeight + 0.5) {
          button.remove(); floating = true;
        }
      }
      if (floating) {
        button.dataset.xmsFloating = '';
        button.style.position = 'fixed'; button.style.zIndex = '2147483400';
        document.documentElement.append(button);
      }
      mounted.set(editor, { button, toolbar, floating }); resizeObserver.observe(editor);
    }
    placeFloating();
    if (launcher && !launcher.isConnected) invalidate();
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true; requestAnimationFrame(() => { scheduled = false; mount(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  (globalThis.browser??globalThis.chrome).runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==(globalThis.browser??globalThis.chrome).runtime.id||message?.type!=='xms-insert-mentions')return;
    try{
      const editor=bookmark?.editor;
      if(!composerToken||message.composerToken!==composerToken||!editor?.isConnected||![...mounted].some(([node,record])=>node===editor&&record.button===launcher))throw new Error('原输入框已关闭，请从需要填写的输入框重新打开 @');
      if(editor instanceof HTMLTextAreaElement?(editor.disabled||editor.readOnly):!editor.isContentEditable)throw new Error('此输入框暂时无法编辑，请使用复制');
      if(!Array.isArray(message.handles)||!message.handles.length||message.handles.length>100||message.handles.some(handle=>typeof handle!=='string'||! /^[A-Za-z0-9_]{1,15}$/.test(handle)))throw new Error('用户名格式不正确');
      const separator=message.separator==='\n'?'\n':' ',mentions=message.handles.map(handle=>'@'+handle).join(separator);
      editor.focus();
      if(document.activeElement!==editor&&!editor.contains(document.activeElement))throw new Error('无法定位原输入框，请重新打开 @');
      let before,after,range;
      if(editor instanceof HTMLTextAreaElement){before=editor.value.slice(0,bookmark.start);after=editor.value.slice(bookmark.end);}
      else{
        range=bookmark.range;
        if(!range||!editor.contains(range.commonAncestorContainer)){range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}
        const left=range.cloneRange();left.selectNodeContents(editor);left.setEnd(range.startContainer,range.startOffset);before=left.toString();
        const right=range.cloneRange();right.selectNodeContents(editor);right.setStart(range.endContainer,range.endOffset);after=right.toString();
        const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      }
      const text=(before&&!/\s$/.test(before)?separator:'')+mentions+(!after||!/^\s/.test(after)?separator:'');
      if(editor instanceof HTMLTextAreaElement){
        editor.setSelectionRange(bookmark.start,bookmark.end);
        if(!document.execCommand('insertText',false,text))throw new Error('此输入框暂不支持直接加入，请使用复制');
      }else if(!document.execCommand('insertText',false,text))throw new Error('此输入框暂不支持直接加入，请使用复制');
      bookmark=remember(editor);status='已加入原输入框';XTB.changed();respond({ok:true});
    }catch(error){respond({ok:false,error:error.message});}
    return false;
  });

  XTB.register('mentions', {
    snapshot:()=>({canInsert:Boolean(composerToken&&bookmark?.editor?.isConnected),composerToken:composerToken||null,status}),
    act:async(action)=>{
      if(action==='prepare')return prepare();
      if(action==='scan')return {ok:true,profiles:globalThis.XMSProfiles.scan()};
      if(action==='invalidate'){invalidate();return {ok:true};}
      if(action==='read')return {ok:true};
      return {ok:false,error:'不支持的联系人操作'};
    }
  });
  const reposition=()=>placeFloating();
  window.visualViewport?.addEventListener('resize',reposition);
  window.visualViewport?.addEventListener('scroll',reposition);
  window.addEventListener('resize',reposition);
  document.addEventListener('scroll',reposition,true);
  mount();
})();

// Scan already-loaded profile blocks only. Known contacts are enriched, never auto-saved.
(() => {
  let timer, signature='';
  const scan=()=>globalThis.XMSProfiles.scan();
  (globalThis.browser??globalThis.chrome).runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==(globalThis.browser??globalThis.chrome).runtime.id||message?.type!=='xms-scan-profiles')return;
    respond({profiles:scan()});return false;
  });
  const update=()=>{
    const profiles=scan(),next=JSON.stringify(profiles);if(next===signature)return;signature=next;
    (globalThis.browser??globalThis.chrome).runtime.sendMessage({channel:'xtb-module',module:'mentions',type:'enrich',profiles}).catch(()=>{});
  };
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(update,350);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href']});
  update();
})();
