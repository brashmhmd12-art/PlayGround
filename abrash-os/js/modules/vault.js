import {Store} from '../store.js';import {escapeHTML} from '../core.js';import {hashPass,verifyPass,vaultKey,vaultEnc,vaultDec,rnd} from '../crypto.js';import {toast,empty} from '../ui.js';
let KEY=null,lockTimer=null;
export function lockVault(){KEY=null;clearTimeout(lockTimer);import('../core.js').then(()=>{});document.dispatchEvent(new CustomEvent('vaultlock'))}
function armAuto(){clearTimeout(lockTimer);const m=+Store.get('settings',{vaultLockMin:5}).vaultLockMin||5;lockTimer=setTimeout(()=>{if(KEY){lockVault();toast('🔒 Vault auto-locked');rerender()}},m*60*1000)}
let cur=null;
function rerender(){if(cur)render(cur)}
export function render(el){cur=el;const meta=Store.get('vaultMeta',null);
  if(!KEY){el.innerHTML=`<div class="card" style="max-width:460px;margin:30px auto;text-align:center"><h2>🔒 ABRASH VAULT</h2><p class="muted">طبقة حماية إضافية — PIN/كلمة منفصلة + تشفير AES-GCM + قفل تلقائي</p>
    ${meta?`<label>PIN / كلمة الخزنة</label><input type="password" id="vPin"><button class="btn primary" id="vOpen" style="margin-top:10px">فتح الخزنة</button>`:`<label>أنشئ PIN للخزنة (6+ أحرف)</label><input type="password" id="vNew"><button class="btn primary" id="vCreate" style="margin-top:10px">إنشاء وتشفير</button>`}
    <p class="fine">المفتاح يُمسح من الذاكرة عند القفل. لا يُخزن PIN كنص.</p></div>`;
    if(meta){el.querySelector('#vOpen').onclick=async()=>{const pin=el.querySelector('#vPin').value;if(!await verifyPass(pin,meta.salt,meta.hash)){Store.audit('vault_fail',{});return toast('PIN خاطئ ⛔')}KEY=await vaultKey(pin,meta.salt);Store.audit('vault_access',{ok:true});armAuto();render(el)}};
    else{el.querySelector('#vCreate').onclick=async()=>{const pin=el.querySelector('#vNew').value;if(pin.length<6)return toast('6+ أحرف');const {salt,hash}=await hashPass(pin);Store.set('vaultMeta',{salt,hash});KEY=await vaultKey(pin,salt);Store.set('vaultItems',[]);Store.audit('vault_create',{});armAuto();render(el)}};return}
  const items=Store.get('vaultItems',[]);
  el.innerHTML=`<div class="between"><h2 style="margin:0">🔒 ABRASH VAULT <span class="pill">مشفرة · auto-lock</span></h2><div class="row"><button class="btn sm" id="vAdd">＋ عنصر سري</button><button class="btn sm" id="vLock">قفل 🔒</button></div></div><div class="list" style="margin-top:12px" id="vL"></div>`;
  const draw=async()=>{const box=el.querySelector('#vL');box.innerHTML='';for(const it of items){try{const d=await vaultDec(KEY,it.pack);const div=document.createElement('div');div.className='item';div.innerHTML=`<span>🗝 <b></b> <span class="pill"></span></span><span style="margin-inline-start:auto" class="row"><button class="btn sm">إظهار</button><button class="btn sm danger">حذف</button></span>`;div.querySelector('b').textContent=d.title;div.querySelector('.pill').textContent=d.kind||'secret';const[sh,del]=div.querySelectorAll('button');sh.onclick=()=>toast('القيمة: '+d.value.slice(0,120));del.onclick=()=>{Store.set('vaultItems',Store.get('vaultItems',[]).filter(x=>x.id!==it.id));Store.audit('vault_delete',{id:it.id});render(el)};box.appendChild(div)}catch{}}
    if(!items.length)box.innerHTML=empty('الخزنة فارغة — مفاتيح / أكواد / مستندات حساسة')};
  el.querySelector('#vLock').onclick=()=>{lockVault();render(el)};
  el.querySelector('#vAdd').onclick=async()=>{const title=prompt('العنوان:');if(!title)return;const value=prompt('القيمة السرية:');if(value==null)return;const pack=await vaultEnc(KEY,{title,value,kind:'secret',at:new Date().toISOString()});const arr=Store.get('vaultItems',[]);arr.unshift({id:rnd(8),pack});Store.set('vaultItems',arr);Store.audit('vault_add',{});armAuto();draw()};
  el.onclick=armAuto;el.onkeydown=armAuto;draw();
}
document.addEventListener('vaultlock',()=>{});
