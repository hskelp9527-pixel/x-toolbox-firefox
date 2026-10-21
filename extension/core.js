(() => {
  if(globalThis.XTB)return;
  const api=globalThis.browser??globalThis.chrome,engines={},host=document.createElement('div');
  host.id='x-toolbox-firefox';host.style.cssText='all:initial;position:fixed;inset:0;z-index:2147483500;pointer-events:none';
  const shadow=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}[hidden]{display:none!important}.launch{position:absolute;height:44px;padding:0 12px;background:#0f1419;color:white;border:1px solid #ffffff88;border-radius:24px;box-shadow:0 3px 12px #0003;font:12px/1 system-ui,'Microsoft YaHei',sans-serif;white-space:nowrap;touch-action:none;user-select:none;cursor:grab;pointer-events:auto}.launch:focus-visible{outline:3px solid #1d9bf0;outline-offset:2px}.shade{position:absolute;inset:0;pointer-events:auto;background:#0f141908}.frame{position:absolute;pointer-events:auto;border:1px solid #dce4e8;border-radius:19px;background:white;box-shadow:0 9px 40px #0f14192c;overflow:hidden;color-scheme:light}`;
  const launcher=document.createElement('button');launcher.className='launch';launcher.textContent='◷ 随手箱';launcher.setAttribute('aria-label','打开 X 三合一工具，拖动可换位置');launcher.setAttribute('aria-expanded','false');
  const shade=document.createElement('div');shade.className='shade';shade.hidden=true;
  shadow.append(style,shade,launcher);document.documentElement.append(host);
  let frame=null,opened=false,opening=false,openSequence=0,large=false,position=null,drag=null,suppressUntil=0,token=crypto.randomUUID(),lastTab='schedule',lastFocus=null,activeContext={},owner=globalThis.XSBIdentity?.current()||'';
  const account=()=>globalThis.XSBIdentity?.current()||'';
  const viewport=()=>({x:visualViewport?.offsetLeft||0,y:visualViewport?.offsetTop||0,w:visualViewport?.width||innerWidth,h:visualViewport?.height||innerHeight});
  function place(){const v=viewport(),r=launcher.getBoundingClientRect(),x=v.x+(position?.x??.95)*Math.max(0,v.w-r.width-16)+8,y=v.y+(position?.y??.79)*Math.max(0,v.h-60-r.height-16)+8;launcher.style.left=Math.max(v.x+8,Math.min(x,v.x+v.w-r.width-8))+'px';launcher.style.top=Math.max(v.y+8,Math.min(y,v.y+v.h-r.height-8))+'px';if(frame){const w=Math.max(0,Math.min(460,v.w-16)),maxHeight=Math.max(0,v.h-16),h=Math.min(maxHeight,Math.max(Math.min(120,maxHeight),large?Math.min(530,v.h*.65):Math.min(336,v.h*.45)));frame.style.left=(v.x+(v.w-w)/2)+'px';frame.style.top=(v.y+v.h-h-8)+'px';frame.style.width=w+'px';frame.style.height=h+'px'}}
  function accountSnapshot(name,me=account()){
    const value=engines[name]?.snapshot();
    if(!['schedule','progress'].includes(name)||value?.account===me&&me)return value;
    // Never label a previous account's cached values with the new account's name.
    const status=me?'正在读取当前账号的数据':'等待识别登录账号';
    return name==='schedule'?{account:me,entries:[],scan:null,status,error:''}:{account:me,goals:{post:3,reply:20,quote:5},day:{post:0,reply:0,quote:0,unfollow:0,full:false,log:[]},following:{},scanPaused:false,scanEpoch:0,followLimitUntil:0,followCooldownMin:30,status,highlight:true};
  }
  function updateLauncher(){const last=accountSnapshot('schedule')?.entries?.filter(e=>e.present!==false&&e.at>=Date.now()).sort((a,b)=>b.at-a.at)[0],text=last?'◷ '+new Date(last.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}):'◷ 随手箱';launcher.title=last?'最后一条定时稿：'+new Date(last.at).toLocaleString():'暂无待发布的定时稿';launcher.setAttribute('aria-label',launcher.title+'，点击展开，拖动可换位置');if(launcher.textContent!==text){launcher.textContent=text;place()}}
  function syncOwner(preserveComposer=false){const next=account();if(next===owner)return false;owner=next;close({restoreFocus:false,preserveComposer});return true}
  function changed(){syncOwner();updateLauncher();if(opened)api.runtime.sendMessage({channel:'xtb-core',type:'changed'}).catch(()=>{})}
  async function registerContext(contextToken,contextAccount){const result=await api.runtime.sendMessage({channel:'xtb-core',type:'register-context',token:contextToken,account:contextAccount});if(!result?.ok)throw Error(result?.error||'扩展后台不可用')}
  function retire(old){if(!old)return;old.hidden=true;old.style.pointerEvents='none';setTimeout(()=>old.remove(),60)}
  async function open(tab=lastTab,context={}){
    const preparedToken=context.composerToken,keepPrepared=!!preparedToken&&engines.mentions?.snapshot()?.composerToken===preparedToken;
    syncOwner(keepPrepared);
    const sequence=++openSequence,openingOwner=account(),contextToken=crypto.randomUUID();
    if(!opened&&!opening)lastFocus=document.activeElement;
    // Replacing a panel must not clear the token just prepared by its @ button.
    retire(frame);frame=null;opened=false;opening=true;token=contextToken;
    shade.hidden=false;launcher.hidden=true;launcher.setAttribute('aria-expanded','true');
    const current=()=>sequence===openSequence&&openingOwner===account();
    try{
      if(tab==='mentions'&&!context.composerToken){const prepared=await engines.mentions?.act('prepare',{});context={...context,...prepared};}
      if(!current()){if(sequence===openSequence)syncOwner();return {ok:false,cancelled:true}}
      await registerContext(contextToken,openingOwner);
      if(!current()){if(sequence===openSequence)syncOwner();return {ok:false,cancelled:true}}
      lastTab=tab;activeContext=context;
      frame=document.createElement('iframe');frame.className='frame';frame.title='X 随手箱 · 三合一';frame.src=api.runtime.getURL(`panel.html?token=${contextToken}&tab=${encodeURIComponent(tab)}`);frame.setAttribute('referrerpolicy','no-referrer');
      shadow.append(frame);opening=false;opened=true;document.dispatchEvent(new Event('xtb-panel-open'));place();
      if(tab==='schedule')engines.schedule?.act('refresh',{mode:'quiet'}).catch(()=>{});
      return {ok:true};
    }catch(error){if(sequence===openSequence)close();throw error}
  }
  function close({restoreFocus=true,preserveComposer=false}={}){const active=opened||opening||!!frame;openSequence++;token=crypto.randomUUID();opened=false;opening=false;shade.hidden=true;launcher.hidden=false;launcher.setAttribute('aria-expanded','false');const old=frame;frame=null;retire(old);activeContext={};large=false;if(active&&!preserveComposer)document.dispatchEvent(new Event('xtb-panel-close'));if(active&&restoreFocus&&lastFocus?.isConnected)lastFocus.focus({preventScroll:true});place()}
  globalThis.XTB={register(name,engine){engines[name]=engine;changed()},changed,open,close,account};
  launcher.onclick=()=>{if(Date.now()<suppressUntil)return;(opened||opening?Promise.resolve(close()):open()).catch(()=>{launcher.textContent='◷ 请刷新页面'})};shade.onclick=()=>close();
  launcher.onpointerdown=e=>{if(e.button!==0||e.isPrimary===false)return;const r=launcher.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};launcher.setPointerCapture(e.pointerId)};
  launcher.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(!drag.moved)return;const v=viewport(),r=launcher.getBoundingClientRect();position={x:Math.max(0,Math.min(1,(drag.left+dx-v.x-8)/Math.max(1,v.w-r.width-16))),y:Math.max(0,Math.min(1,(drag.top+dy-v.y-8)/Math.max(1,v.h-60-r.height-16)))};place()};
  function endDrag(e){if(!drag||e.pointerId!==drag.id)return;if(drag.moved){suppressUntil=Date.now()+350;api.runtime.sendMessage({channel:'xtb-core',type:'position',position}).catch(()=>{})}drag=null}
  launcher.onpointerup=endDrag;launcher.onpointercancel=endDrag;
  api.runtime.onMessage.addListener((m,sender,respond)=>{
    if(sender.id!==api.runtime.id)return false;
    syncOwner();
    if(m?.channel==='xtb-action'){(opened||opening?Promise.resolve(close()):open()).catch(()=>{});return false}
    if(m?.channel!=='xtb-page'||m.token!==token||!opened)return false;
    const run=async()=>{
      if(m.type==='snapshot'){const me=account(),result={ok:true,account:me,context:activeContext};for(const name of Object.keys(engines))result[name]=accountSnapshot(name,me);return result}
      if(m.type==='module-action'){const e=engines[m.module];if(!e)throw Error('模块未就绪');return {ok:true,...await e.act(m.action,m.payload)}}
      if(m.type==='host'){if(m.action==='close')close();else if(m.action==='expand'){large=!large;place()}else if(m.action==='open-following'){const me=account();if(!me)throw Error('请先登录 X');location.assign(`/${me}/following`)}else if(m.action==='prepare-mentions'){await engines.mentions?.act('prepare',{})}else throw Error('未知界面操作');return {ok:true}}
      throw Error('未知页面请求');
    };run().then(respond,e=>respond({ok:false,error:e.message}));return true;
  });
  api.storage.local.get({toolboxPosition:null}).then(data=>{if(!drag&&data.toolboxPosition)position=data.toolboxPosition;place()}).catch(()=>{});
  api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.toolboxPosition&&!drag){position=changes.toolboxPosition.newValue;place()}});
  addEventListener('resize',place);visualViewport?.addEventListener('resize',place);visualViewport?.addEventListener('scroll',place);
  new MutationObserver(()=>syncOwner()).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  // The clock/identity poll must not cause the iframe to rebuild its lists every second.
  setInterval(()=>{syncOwner();updateLauncher()},1000);place();
})();
