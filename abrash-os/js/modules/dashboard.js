import {Store} from '../store.js';import {escapeHTML,fmtD} from '../core.js';import {t} from '../i18n.js';
const W={tasks:'المهام اليومية',projects:'المشاريع النشطة',notes:'آخر الملاحظات',files:'آخر الملفات',goals:'أهداف الشهر',activity:'نشاط الحساب'};
export function render(el){const s=Store.get('settings',{widgets:[]});const ws=s.widgets?.length?s.widgets:Object.keys(W);
  const tasks=Store.col('tasks').filter(x=>!x.done);const projs=Store.col('projects').filter(p=>p.stage!=='COMPLETED');
  const notes=Store.col('notes').filter(n=>!n.deleted).slice(0,5);const files=Store.col('files').slice(0,5);
  const goals=Store.col('goals').slice(0,4);const audits=Store.col('audits').slice(0,6);
  const done=Store.col('tasks').filter(x=>x.done).length,total=Store.col('tasks').length;
  const pct=total?Math.round(done/total*100):0;
  el.innerHTML=`<div class="between"><div><h2 style="margin:0">محمد ابراش — Command Center</h2><div class="muted">${new Date().toLocaleString('ar',{dateStyle:'full',timeStyle:'short'})} · completion ${pct}%</div></div>
  <div class="row"><button class="btn sm" id="cwBtn">تخصيص الواجهة ⚙</button><a class="btn sm primary" href="#/ai">اسأل ABRASH AI ✨</a></div></div>
  <div class="grid g4" style="margin-top:12px">
  <div class="card"><h3>⏱ إنجاز المهام</h3><div class="stat">${pct}%</div><div class="bar"><i style="width:${pct}%"></i></div></div>
  <div class="card"><h3>📁 المشاريع</h3><div class="stat">${projs.length}</div><div class="muted">نشط الآن</div></div>
  <div class="card"><h3>🗒 الملاحظات</h3><div class="stat">${Store.col('notes').filter(n=>!n.deleted).length}</div><div class="muted">مخزنة محليًا · offline ✓</div></div>
  <div class="card"><h3>💾 التخزين</h3><div class="stat">${files.length}</div><div class="muted">ملفات + نسخ احتياطية قابلة للتصدير</div></div>
  <div class="card" id="wxCard"><h3>🌤 الطقس</h3><div class="muted" id="wxBody">—</div></div></div>
  <div class="grid g2" style="margin-top:14px" id="wgrid"></div>
  <div class="card" style="margin-top:14px"><h3>⚡ اختصارات سريعة</h3><div class="row">
  ${['#/notes|＋ ملاحظة','#/tasks|＋ مهمة','#/projects|＋ مشروع','#/vault|🔒 الخزنة','#/backup|⇪ نسخ احتياطي','#/graph|🕸 الذاكرة'].map(x=>{const[a,b]=x.split('|');return `<a class="btn sm" href="${a}">${b}</a>`}).join('')}</div></div>`;
  const g=el.querySelector('#wgrid');
  const card=(title,inner)=>`<div class="card" data-w><h3>${title}</h3>${inner}</div>`;
  let h='';
  if(ws.includes('tasks'))h+=card(W.tasks,tasks.slice(0,5).map(x=>`<div class="item">⬜ ${escapeHTML(x.title)} <span class="pill">${escapeHTML(x.priority||'')}</span></div>`).join('')||'لا مهام — يومك نظيف ✨');
  if(ws.includes('projects'))h+=card(W.projects,projs.slice(0,5).map(p=>`<div class="item">🚀 ${escapeHTML(p.name)} <span class="tag">${escapeHTML(p.stage||'IDEA')}</span></div>`).join('')||'لا مشاريع نشطة');
  if(ws.includes('notes'))h+=card(W.notes,notes.map(n=>`<div class="item">📝 ${escapeHTML(n.title)}<span class="muted" style="margin-inline-start:auto">${fmtD(n.updatedAt)}</span></div>`).join('')||'لا ملاحظات بعد');
  if(ws.includes('files'))h+=card(W.files,files.map(f=>`<div class="item">📎 ${escapeHTML(f.name)} <span class="pill">${escapeHTML(f.folder||'')}</span></div>`).join('')||'لا ملفات');
  if(ws.includes('goals'))h+=card(W.goals,goals.map(x=>`<div style="margin:8px 0">${escapeHTML(x.title)} — ${x.progress||0}%<div class="bar"><i style="width:${x.progress||0}%"></i></div></div>`).join('')||'حدد هدفك الأول من تبويب الأهداف 🎯');
  if(ws.includes('activity'))h+=card(W.activity,audits.map(a=>`<div class="item">🔹 ${escapeHTML(a.action)} <span class="muted" style="margin-inline-start:auto">${fmtD(a.at)}</span></div>`).join(''));
  const sugs=s.aiSuggest===false?'':suggest();
  g.innerHTML=h+(sugs?`<div class="card"><h3>🤖 اقتراحات قابلة للتعطيل</h3>${sugs}</div>`:'');
  el.querySelector('#cwBtn').onclick=()=>{const cur=Store.get('settings',{});const box=document.createElement('div');box.innerHTML=Object.entries(W).map(([k,v])=>`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-k="${k}" ${(cur.widgets||[]).includes(k)?'checked':''} style="width:auto"> ${v}</label>`).join('');import('../ui.js').then(({confirmDlg})=>confirmDlg('تخصيص الواجهة',box).then(ok=>{if(!ok)return;cur.widgets=[...box.querySelectorAll('input:checked')].map(i=>i.dataset.k);Store.set('settings',cur);render(el)}))};
  const wx=Store.get('settings',{}).weather;
  if(wx?.on&&wx.lat&&wx.lon)fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(wx.lat)}&longitude=${encodeURIComponent(wx.lon)}&current=temperature_2m,weather_code`).then(r=>r.json()).then(j=>{const b=el.querySelector('#wxBody');if(b)b.innerHTML=`<div class="stat">${j.current?.temperature_2m??'—'}°</div><div class="muted">كود ${j.current?.weather_code??'—'} · Open-Meteo</div>`}).catch(()=>{const b=el.querySelector('#wxBody');if(b)b.textContent='تعذر الجلب (offline؟)'});
  else{const b=el.querySelector('#wxBody');if(b)b.textContent='معطّل — فعّله من الإعدادات ⚙'}
}
function suggest(){const out=[];const stale=Store.col('projects').filter(p=>Date.now()-new Date(p.updatedAt).getTime()>7*864e5);if(stale.length)out.push(`مشاريع متوقفة منذ أسبوع: <b>${stale.length}</b> — راجع <a href="#/projects">المختبر</a>`);const late=Store.col('tasks').filter(x=>!x.done&&x.due&&new Date(x.due)<new Date());if(late.length)out.push(`مهام متأخرة: <b>${late.length}</b>`);const untagged=Store.col('notes').filter(n=>!n.deleted&&!(n.tags||[]).length);if(untagged.length)out.push(`ملاحظات بلا وسم تحتاج ترتيب: <b>${untagged.length}</b>`);return out.map(s=>`<div class="item">💡 ${s}</div>`).join('')}
