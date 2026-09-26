import {Store} from '../store.js';import {vaultKey,vaultEnc,vaultDec} from '../crypto.js';import {toast} from '../ui.js';import {fullExport} from './backup.js';
// E2E encrypted sync: server stores an OPAQUE blob (salt+iv+ct) + rev counter.
// Key = PBKDF2(sync password, salt). Server never sees plaintext.
// Conflict: push with stale base → 409 → pull, merge (newest updatedAt wins), retry.
const MERGE_COLS=['notes','files','projects','tasks','knowledge','events','goals','ideas'];
const ep=()=>Store.get('settings',{}).syncEndpoint||'/api/sync';
const authEp=()=>ep().replace(/\/sync\/?$/,'');
let token=null;try{token=sessionStorage.getItem('abrash-sync-token')}catch{}
export function mergeAll(remote,skip=new Set()){let n=0;for(const k of MERGE_COLS){const loc=Store.col(k);const byId=new Map(loc.map(x=>[x.id,x]));
  for(const r of (remote[k]||[])){if(skip.has(k+':'+r.id))continue;const l=byId.get(r.id);
    if(!l||new Date(r.updatedAt||r.createdAt||0)>new Date(l.updatedAt||l.createdAt||0)){byId.set(r.id,r);n++}}
  Store.set(k,[...byId.values()])}return n}
export const snap=()=>{const o={};for(const k of MERGE_COLS){o[k]={};for(const x of Store.col(k))o[k][x.id]=x.updatedAt||x.createdAt||''}return o};
export function findConflicts(remote){const base=Store.get('syncBase',{});const out=[];
  for(const k of MERGE_COLS){const loc=new Map(Store.col(k).map(x=>[x.id,x]));
    for(const r of (remote[k]||[])){const b=(base[k]||{})[r.id];const l=loc.get(r.id);if(!b||!l)continue;
      const lt=l.updatedAt||l.createdAt||'',rt=r.updatedAt||r.createdAt||'';
      if(lt>b&&rt>b&&JSON.stringify(l)!==JSON.stringify(r))out.push({col:k,id:r.id,title:r.title||r.name||r.id,mine:l,theirs:r})}}
  return out}
export function resolveConflict(c,side){const arr=Store.col(c.col).map(x=>x.id===c.id?(side==='mine'?c.mine:c.theirs):x);
  Store.set(c.col,arr);const base=Store.get('syncBase',{});base[c.col]=base[c.col]||{};
  const chosen=side==='mine'?c.mine:c.theirs;base[c.col][c.id]=chosen.updatedAt||chosen.createdAt||'';Store.set('syncBase',base)}
export function renderSync(box){box.innerHTML=`<h3>☁ مزامنة مشفرة E2E <span class="pill">rev ${Store.get('syncRev',0)}</span></h3>
  <div class="muted">الخادم يخزن blob مشفرًا فقط — لا يرى بياناتك. كلمة المزامنة منفصلة ولا تُرسل أبدًا.</div>
  <div class="row" style="margin-top:8px"><input id="syU" placeholder="مستخدم الخادم" style="flex:1"><input id="syP" type="password" placeholder="كلمة الخادم" style="flex:1"><button class="btn sm" id="syLogin">${token?'متصل ✓':'اتصال'}</button></div>
  <div class="row" style="margin-top:8px"><input id="syK" type="password" placeholder="كلمة المزامنة (للتشفير)" style="flex:1"><button class="btn sm primary" id="syPush">⬆ دفع</button><button class="btn sm" id="syPull">⬇ سحب ودمج</button></div>
  <div class="muted" id="syMsg"></div><div class="list" id="syConf" style="margin-top:8px"></div>`;
  const msg=t=>box.querySelector('#syMsg').textContent=t;
  box.querySelector('#syLogin').onclick=async()=>{try{const r=await fetch(authEp()+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:box.querySelector('#syU').value,p:box.querySelector('#syP').value})});
    if(!r.ok)throw new Error('login '+r.status);const j=await r.json();token=j.token;try{sessionStorage.setItem('abrash-sync-token',token)}catch{}Store.audit('sync_login',{});msg('متصل ✓');renderSync(box)}catch(e){msg('فشل: '+e.message)}};
  box.querySelector('#syPush').onclick=()=>push(box.querySelector('#syK').value,msg);
  box.querySelector('#syPull').onclick=()=>pull(box.querySelector('#syK').value,msg);
  async function push(pass,m){if(!token)return m('اتصل أولًا');if(!pass||pass.length<8)return m('كلمة المزامنة 8+ أحرف');
    try{const cur=await (await fetch(ep(),{headers:{Authorization:'Bearer '+token}})).json();
      let salt=cur.blob?.salt;if(!salt){const b=new Uint8Array(16);crypto.getRandomValues(b);salt=btoa(String.fromCharCode(...b))}
      const key=await vaultKey(pass,salt);const pack=await vaultEnc(key,fullExport());
      const r=await fetch(ep(),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({base:cur.rev,blob:{salt,iv:pack.iv,ct:pack.ct}})});
      if(r.status===409){const j=await r.json();Store.set('syncRev',j.rev);return m(`تعارض (rev ${j.rev}) — اسحب وادمج أولًا`)}
      if(!r.ok)throw new Error('push '+r.status);const j=await r.json();Store.set('syncRev',j.rev);Store.set('syncBase',snap());Store.audit('sync_push',{rev:j.rev});m('دُفع ✓ rev '+j.rev)}
    catch(e){m('فشل: '+e.message)}}
  async function pull(pass,m){try{const cur=await (await fetch(ep(),{headers:{Authorization:'Bearer '+token}})).json();
    if(!cur.blob)return m('لا نسخة على الخادم');if(!pass)return m('أدخل كلمة المزامنة لفك التشفير');
    const key=await vaultKey(pass,cur.blob.salt);const data=await vaultDec(key,{iv:cur.blob.iv,ct:cur.blob.ct});
    const conf=findConflicts(data);const skip=new Set(conf.map(c=>c.col+':'+c.id));
    const n=mergeAll(data,skip);Store.set('syncRev',cur.rev);Store.audit('sync_pull',{rev:cur.rev,merged:n,conf:conf.length});
    const b=snap(),old=Store.get('syncBase',{});for(const c of conf)b[c.col][c.id]=(old[c.col]||{})[c.id]||'';
    Store.set('syncBase',b);
    paintConf(conf);m(`دُمج ${n} عنصر ✓ rev ${cur.rev}`+(conf.length?` — ${conf.length} تعارض يحتاج اختيارك 👇`:''))}catch(e){m('فشل فك التشفير/السحب: '+e.message)}}
  function paintConf(conf){const cbox=box.querySelector('#syConf');
    cbox.innerHTML=conf.map((c,i)=>`<div class="item"><span>⚠ <b>${(c.title||'').slice(0,40)}</b> <span class="pill">${c.col}</span></span><span style="margin-inline-start:auto" class="row"><button class="btn sm" data-c="${i}" data-s="mine">نسختي</button><button class="btn sm primary" data-c="${i}" data-s="theirs">نسخة الخادم</button></span></div>`).join('');
    cbox.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const c=conf[+b.dataset.c];resolveConflict(c,b.dataset.s);toast('حُل التعارض ✓');cbox.querySelector(`[data-c="${b.dataset.c}"]`).closest('.item').remove()})}
}
