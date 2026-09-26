import {Store} from '../store.js';import {escapeHTML,download,fmtD} from '../core.js';import {toast,confirmDlg} from '../ui.js';import {can,myRole} from '../perms.js';
const KEYS=['users','settings','notes','files','projects','tasks','knowledge','events','goals','ideas','devices','sessions','logins','audits','vaultMeta','vaultItems','widgets'];
export function fullExport(){const o={app:'abrash-os',at:new Date().toISOString()};KEYS.forEach(k=>o[k]=Store.get(k,[]));return o}
export function fullImport(o){KEYS.forEach(k=>{if(o[k]!==undefined)Store.set(k,o[k])})}
export function render(el){el.innerHTML=`<h2 style="margin:0">⇪ النسخ الاحتياطي — بياناتك ملكك</h2><p class="muted">تصدير كامل · استيراد · سجل النسخ · لا احتجاز لبياناتك</p>
  <div class="row"><button class="btn primary sm" id="bNow">نسخ احتياطي الآن</button><button class="btn sm" id="bExp">تصدير JSON ⬇</button><label class="btn sm">استيراد ⬆<input type="file" id="bImp" hidden accept="application/json"></label>${can(myRole(),'wipe')?'<button class="btn sm danger" id="bWipe">حذف كل البيانات</button>':'<span class="pill">المسح للمالك فقط</span>'}</div>
  <div class="card" style="margin-top:12px"><h3>سجل النسخ (${Store.col('backups').length})</h3><div class="list">${Store.col('backups').map(b=>`<div class="item">💾 ${fmtD(b.createdAt)} · ${b.size}B <button class="btn sm" data-r="${b.id}">استرجاع</button></div>`).join('')||'<div class="muted">لا نسخ بعد — فعّل التلقائي من هنا</div>'}</div></div>
  <div class="card" style="margin-top:12px" id="syncBox"></div>`;
  el.querySelector('#bNow').onclick=()=>{const o=fullExport();const s=JSON.stringify(o);Store.push('backups',{size:s.length,data:s.slice(0,4_000_000)});Store.audit('backup',{size:s.length});toast('حُفظت نسخة ✓');render(el)};
  el.querySelector('#bExp').onclick=()=>{download('abrash-backup.json',JSON.stringify(fullExport()));Store.audit('export',{});toast('صُدّرت بياناتك بالكامل ✓')};
  el.querySelector('#bImp').onchange=e=>{const f=e.target.files[0];const r=new FileReader();r.onload=()=>{try{fullImport(JSON.parse(r.result));Store.audit('restore',{});toast('استُعيدت ✓');render(el)}catch{toast('ملف تالف ⛔')}};r.readAsText(f)};
  el.querySelector('#bWipe')?.addEventListener('click',async()=>{if(await confirmDlg('حذف نهائي','مسح كل شيء؟')){['notes','files','projects','tasks','knowledge','events','goals','ideas','devices','sessions','logins','audits','vaultMeta','vaultItems','widgets','backups'].forEach(k=>Store.set(k,k==='settings'?Store.get(k,{}):[]));render(el)}});
  el.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const bk=Store.col('backups').find(x=>x.id===b.dataset.r);try{fullImport(JSON.parse(bk.data));toast('استُعيدت النسخة ✓')}catch{toast('تعذر الاسترجاع')}});
  if(!Store.col('backups').length&&Store.col('notes').length>=3){/* auto first backup */try{const o=fullExport();Store.push('backups',{size:JSON.stringify(o).length,data:JSON.stringify(o).slice(0,4_000_000),auto:true})}catch{}}
  import('./sync.js').then(m=>m.renderSync(el.querySelector('#syncBox'))).catch(()=>{el.querySelector('#syncBox').innerHTML='<div class="muted">المزامنة متاحة عبر http(s) فقط</div>'});
}
