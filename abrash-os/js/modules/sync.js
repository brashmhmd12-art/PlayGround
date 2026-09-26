import {Store} from '../store.js';import {escapeHTML} from '../core.js';import {vaultKey,vaultEnc,vaultDec} from '../crypto.js';import {toast} from '../ui.js';import {fullExport} from './backup.js';
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
// ---- field-level 3-way merge (round 8) ----
// Base stores per-field VALUE HASHES (not values): light, no duplication of
// big blobs. Scalars merge per field; arrays/objects merge atomically.
// Returns {merged, added, conflicts:[{col,id,field,mine,theirs}]}.
export const hashVal=s=>{s=String(s);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16)};
const H=v=>hashVal(JSON.stringify(v??null));
export const snapV2=()=>{const o={};for(const k of MERGE_COLS){o[k]={};for(const x of Store.col(k)){o[k][x.id]={};for(const f of Object.keys(x))if(f!=='id')o[k][x.id][f]=H(x[f])}}return o};
const nowISO=()=>new Date().toISOString();
export function mergeFields(remote){const base=Store.get('syncBaseV2',{});const out={merged:0,added:0,conflicts:[]};
  for(const k of MERGE_COLS){const loc=new Map(Store.col(k).map(x=>[x.id,x]));let touched=false;
    for(const r of (remote[k]||[])){const l=loc.get(r.id);
      if(!l){loc.set(r.id,r);out.added++;touched=true;continue}
      const b=(base[k]||{})[r.id];
      if(!b){ // predates V2 base → item-level newest-wins fallback
        const rt=r.updatedAt||r.createdAt||'',lt=l.updatedAt||l.createdAt||'';
        if(rt>lt&&JSON.stringify(l)!==JSON.stringify(r)){loc.set(r.id,r);out.merged++}continue}
      const fields=[...new Set([...Object.keys(l),...Object.keys(r)])].filter(f=>f!=='id'&&f!=='updatedAt'&&f!=='createdAt');
      const item={...l};let changed=false;
      for(const f of fields){const lh=H(l[f]),rh=H(r[f]),bh=b[f];
        if(lh===rh)continue;
        if(bh===undefined){continue} // unknown field history → keep local (safe)
        if(lh===bh){item[f]=r[f];changed=true}
        else if(rh===bh){/* local won */}
        else out.conflicts.push({col:k,id:r.id,field:f,mine:l[f],theirs:r[f]})}
      if(changed){item.updatedAt=nowISO();loc.set(r.id,item);out.merged++;touched=true}}
    if(touched)Store.set(k,[...loc.values()])}
  return out}
export function resolveField(c,side){const arr=Store.col(c.col).map(x=>{if(x.id!==c.id)return x;
    const nx={...x,[c.field]:side==='mine'?c.mine:c.theirs,updatedAt:nowISO()};return nx});
  Store.set(c.col,arr);const base=Store.get('syncBaseV2',{});base[c.col]=base[c.col]||{};base[c.col][c.id]=base[c.col][c.id]||{};
  const chosen=side==='mine'?c.mine:c.theirs;base[c.col][c.id][c.field]=H(chosen);Store.set('syncBaseV2',base)}
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
      if(!r.ok)throw new Error('push '+r.status);const j=await r.json();Store.set('syncRev',j.rev);Store.set('syncBaseV2',snapV2());Store.audit('sync_push',{rev:j.rev});m('دُفع ✓ rev '+j.rev)}
    catch(e){m('فشل: '+e.message)}}
  async function pull(pass,m){try{const cur=await (await fetch(ep(),{headers:{Authorization:'Bearer '+token}})).json();
    if(!cur.blob)return m('لا نسخة على الخادم');if(!pass)return m('أدخل كلمة المزامنة لفك التشفير');
    const key=await vaultKey(pass,cur.blob.salt);const data=await vaultDec(key,{iv:cur.blob.iv,ct:cur.blob.ct});
    const res=mergeFields(data);
    const b=snapV2(),old=Store.get('syncBaseV2',{});
    for(const c of res.conflicts){b[c.col][c.id]=b[c.col][c.id]||{};if(old[c.col]?.[c.id]?.[c.field]!==undefined)b[c.col][c.id][c.field]=old[c.col][c.id][c.field]}
    Store.set('syncBaseV2',b);Store.set('syncRev',cur.rev);
    Store.audit('sync_pull',{rev:cur.rev,...res,conf:res.conflicts.length});
    paintConf(res.conflicts);m(`دُمج ${res.merged}+${res.added} ✓ rev ${cur.rev}`+(res.conflicts.length?` — ${res.conflicts.length} حقل متعارض 👇`:''))}catch(e){m('فشل فك التشفير/السحب: '+e.message)}}
  const prev=v=>escapeHTML(JSON.stringify(v??'—').slice(0,120));
  function paintConf(conf){const cbox=box.querySelector('#syConf');
    cbox.innerHTML=conf.map((c,i)=>`<div class="item" style="flex-direction:column;align-items:stretch"><span>⚠ <b>${(c.id||'').slice(0,12)}</b> <span class="pill">${c.col}.${c.field}</span></span><div class="grid g2" style="width:100%"><div class="muted">نسختي: ${prev(c.mine)}</div><div class="muted">الخادم: ${prev(c.theirs)}</div></div><span class="row"><button class="btn sm" data-c="${i}" data-s="mine">نسختي</button><button class="btn sm primary" data-c="${i}" data-s="theirs">نسخة الخادم</button></span></div>`).join('');
    cbox.querySelectorAll('[data-c]').forEach(btn=>btn.onclick=()=>{const c=conf[+btn.dataset.c];resolveField(c,btn.dataset.s);toast('حُل الحقل ✓');btn.closest('.item').remove()})}
}
