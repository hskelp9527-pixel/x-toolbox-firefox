// UI stays on the extension origin. Every iframe command is bound to its X tab.
(() => {
  const api=globalThis.browser??globalThis.chrome,contexts=new Map();
  let queue=Promise.resolve();
  const own=sender=>sender.id===api.runtime.id;
  function page(sender){try{const u=new URL(sender.url);return own(sender)&&sender.tab&&sender.frameId===0&&u.protocol==='https:'&&['x.com','twitter.com','www.x.com','www.twitter.com'].includes(u.hostname)}catch{return false}}
  function ui(sender,token){try{const u=new URL(sender.url),base=new URL(api.runtime.getURL('panel.html')),context=contexts.get(sender.tab?.id);return own(sender)&&sender.frameId>0&&u.protocol===base.protocol&&u.host===base.host&&u.pathname===base.pathname&&context&&context.token===token}catch{return false}}
  const toPage=(sender,token,payload)=>api.tabs.sendMessage(sender.tab.id,{channel:'xtb-page',token,...payload},{frameId:0});
  api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(!['xtb-core','xtb-module','xtb-ui'].includes(message?.channel))return false;
    const work=async()=>{
      if(message.channel==='xtb-module'){
        if(!page(sender))throw Error('不允许的模块来源');
        const backend=globalThis.XTBBackends?.[message.module];if(!backend)throw Error('模块未加载');
        return await backend.handle(message,sender);
      }
      if(message.channel==='xtb-core'){
        if(!page(sender))throw Error('不允许的页面来源');
        if(message.type==='register-context'){
          if(!/^[a-f0-9-]{36}$/i.test(message.token??''))throw Error('无效会话');
          contexts.set(sender.tab.id,{token:message.token,account:message.account||'',url:sender.url});return {ok:true};
        }
        if(message.type==='settings-read')return {ok:true,...await api.storage.local.get({toolboxPosition:null})};
        if(message.type==='position'){
          if(!message.position||!['x','y'].every(k=>Number.isFinite(message.position[k])&&message.position[k]>=0&&message.position[k]<=1))throw Error('无效位置');
          const save=()=>api.storage.local.set({toolboxPosition:message.position});const job=queue.then(save);queue=job.catch(()=>{});await job;return {ok:true};
        }
        if(message.type==='changed'){api.runtime.sendMessage({channel:'xtb-ui-update'}).catch(()=>{});return {ok:true}}
        throw Error('未知页面操作');
      }
      if(!ui(sender,message.token))throw Error('页面已变化，请关闭后重新打开工具');
      if(message.type==='read'){
        const snapshot=await toPage(sender,message.token,{type:'snapshot'});if(!snapshot?.ok)throw Error(snapshot?.error||'请刷新 X 页面');
        const people=await globalThis.XTBBackends.mentions.handle({type:'list'},sender);
        if(!people?.ok)throw Error(people?.error||'收藏读取失败');
        return {...snapshot,contacts:people.entries};
      }
      if(message.type==='host')return await toPage(sender,message.token,{type:'host',action:message.action,payload:message.payload});
      if(message.type==='action'){
        if(message.module==='mentions')return await globalThis.XTBBackends.mentions.handle({...(message.payload??{}),type:message.action},sender);
        if(!['schedule','progress'].includes(message.module))throw Error('未知模块');
        return await toPage(sender,message.token,{type:'module-action',module:message.module,action:message.action,payload:message.payload??{}});
      }
      throw Error('未知工具操作');
    };
    work().then(value=>respond(value??{ok:true}),error=>respond({ok:false,error:String(error.message??error)}));return true;
  });
  api.tabs.onRemoved.addListener(id=>contexts.delete(id));
  api.action.onClicked.addListener(tab=>{if(tab.id&&/^https:\/\/(www\.)?(x|twitter)\.com\//.test(tab.url??''))api.tabs.sendMessage(tab.id,{channel:'xtb-action',type:'toggle'},{frameId:0}).catch(()=>{});else api.tabs.create({url:'https://x.com/home'}).catch(()=>{})});
})();
