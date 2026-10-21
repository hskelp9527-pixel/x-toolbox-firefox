// Read the signed-in account only. Mobile may expose its avatar without a profile tab.
// The optional twid comparison reads only a public numeric user id into memory;
// cookie text is never cached, returned, emitted, or saved by this module.
globalThis.XSBIdentity=(()=>{
  let sawExplicit=false,cachedText='',cachedAccount='',cachedId='';
  let observedCookieId=null,lastHandle='',blockedHandle='',sessionChanged=false;
  const reserved=new Set(['home','explore','notifications','messages','settings','search','compose','i','intent','share','undefined','null']);
  const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_]{1,15}$/.test(value)&&!reserved.has(value.toLowerCase())?value.toLowerCase():'';
  function publicSessionId(){
    try{
      const raw=document.cookie.split(';').find(part=>part.trimStart().startsWith('twid='));
      if(!raw)return '';
      const decoded=decodeURIComponent(raw.trim().slice(5)).replace(/^"|"$/g,'');
      return /^u=\d+$/.test(decoded)?decoded.slice(2):'';
    }catch{return '';}
  }
  function linkHandle(link){
    if(!link)return '';
    try{
      const url=new URL(link.getAttribute('href'),location.href),match=/^\/([A-Za-z0-9_]{1,15})\/?$/.exec(url.pathname);
      return url.protocol==='https:'&&['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname)&&match?valid(match[1]):'';
    }catch{return '';}
  }
  function explicitHandle(){
    const profile=linkHandle(document.querySelector('a[data-testid="AppTabBar_Profile_Link"]'));
    if(profile)return profile;
    // Only the authenticated account switcher is trusted; timeline/profile avatars
    // and the currently visited URL can belong to anyone.
    for(const control of document.querySelectorAll('[data-testid="SideNav_AccountSwitcher_Button"]')){
      const names=new Set();
      for(const avatar of control.querySelectorAll('[data-testid^="UserAvatar-Container-"]')){
        const handle=valid(avatar.getAttribute('data-testid').slice('UserAvatar-Container-'.length));
        if(handle)names.add(handle);
      }
      for(const link of control.querySelectorAll('a[href]')){
        const handle=linkHandle(link);if(handle)names.add(handle);
      }
      for(const span of control.querySelectorAll('span')){
        const text=span.textContent.trim(),match=/^@([A-Za-z0-9_]{1,15})$/.exec(text);
        if(match){const handle=valid(match[1]);if(handle)names.add(handle);}
      }
      // Never select an arbitrary account from an expanded multi-account list.
      if(names.size===1)return [...names][0];
    }
    return '';
  }
  function serverSession(){
    const prefix='window.__INITIAL_STATE__=';
    const source=[...document.querySelectorAll('script:not([src])')].map(script=>script.textContent.trimStart()).find(text=>text.startsWith(prefix));
    if(!source||source.length>2e6)return {id:'',handle:''};
    if(source===cachedText)return {id:cachedId,handle:cachedAccount};
    cachedText=source;cachedAccount='';cachedId='';
    try{
      const start=source.indexOf('{',prefix.length);if(start<0)return {id:'',handle:''};
      let depth=0,inString=false,escaped=false,end;
      for(let i=start;i<source.length;i++){
        const char=source[i];
        if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;}
        else if(char==='"')inString=true;
        else if(char==='{')depth++;
        else if(char==='}'&&!--depth){end=i+1;break;}
      }
      if(!end)return {id:'',handle:''};
      const state=JSON.parse(source.slice(start,end)),id=String(state.session?.user_id??'');
      if(!/^\d+$/.test(id))return {id:'',handle:''};
      const user=state.entities?.users?.entities?.[id];
      cachedAccount=valid(user?.screen_name??user?.core?.screen_name);
      if(cachedAccount)cachedId=id;
    }catch{/* Unknown state never selects an arbitrary user. */}
    return {id:cachedId,handle:cachedAccount};
  }
  function current(){
    const cookieId=publicSessionId();
    if(observedCookieId!==null&&cookieId!==observedCookieId){sessionChanged=true;blockedHandle=lastHandle;}
    observedCookieId=cookieId;
    const explicit=explicitHandle();
    if(explicit){
      sawExplicit=true;
      // The cookie can change before X replaces its old account-menu DOM.
      if(sessionChanged&&explicit===blockedHandle){
        const ssr=serverSession();
        if(!cookieId||ssr.id!==cookieId||ssr.handle!==explicit)return '';
      }
      lastHandle=explicit;blockedHandle='';return explicit;
    }
    const ssr=serverSession();
    if(!ssr.handle)return '';
    if(cookieId){
      if(ssr.id!==cookieId)return '';
      // A cached initial session must not override a later explicit account.
      if(sawExplicit&&lastHandle!==ssr.handle)return '';
      lastHandle=ssr.handle;return ssr.handle;
    }
    // Without a public session id, SSR is usable only before any switch or
    // explicit UI identity. Once provenance is uncertain, wait for X's menu.
    if(sessionChanged||sawExplicit)return '';
    lastHandle=ssr.handle;return ssr.handle;
  }
  return {current};
})();
