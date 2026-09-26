import {Store} from '../store.js';import {escapeHTML} from '../core.js';import {toast,empty} from '../ui.js';import {globalSearch} from './search.js';
const sum=t=>t.split(/[.\n]/).filter(x=>x.trim()).slice(0,3).join(' · ').slice(0,300)||'لا محتوى كافٍ للتلخيص';
export function render(el){el.innerHTML=`<h2 style="margin:0">✨ ABRASH AI — مساعد داخلي (محلي افتراضيًا)</h2><p class="muted">يلخص · يحلل · يحوّل الملاحظات إلى خطط · يبحث في بياناتك فقط بإذنك. الاقتراحات قابلة للتعطيل من الإعدادات.</p>
  <div class="card"><div class="row"><input id="aiQ" placeholder='مثال: ما المشاريع التي لم أعمل عليها منذ أسبوع؟' style="flex:2"><button class="btn primary sm" id="aiGo">اسأل</button><button class="btn sm" id="aiCloud" title="عبر خادمك فقط — المفتاح في بيئة الخادم">☁ سحابي</button></div><div id="aiOut" style="margin-top:10px"></div></div>
  <div class="grid g3" style="margin-top:12px"><div class="card"><h3>📝 تلخيص ملاحظة</h3><select id="aiN">${Store.col('notes').filter(n=>!n.deleted).map(n=>`<option value="${n.id}">${escapeHTML(n.title)}</option>`).join('')}</select><button class="btn sm" id="aiSum">لخص</button><div id="aiSumOut" class="muted"></div></div>
  <div class="card"><h3>🗂 تنظيم مقترح</h3><button class="btn sm" id="aiOrg">اقترح تنظيم الملفات</button><div id="aiOrgOut" class="muted"></div></div>
  <div class="card"><h3>📋 ملاحظة → خطة</h3><select id="aiP">${Store.col('notes').filter(n=>!n.deleted).map(n=>`<option value="${n.id}">${escapeHTML(n.title)}</option>`).join('')}</select><button class="btn sm primary" id="aiPlan">حوّل</button></div></div>
  <div class="card" style="margin-top:12px"><h3>سجل الأسئلة</h3><div class="list">${Store.col('aiLog').slice(0,10).map(x=>`<div class="item">💬 ${escapeHTML(x.q)}<span class="muted" style="margin-inline-start:auto">${escapeHTML((x.a||'').slice(0,80))}</span></div>`).join('')||'<div class="muted">لا أسئلة بعد</div>'}</div></div>`;
  const log=(q,a)=>Store.push('aiLog',{q,a});
  el.querySelector('#aiGo').onclick=()=>{const q=el.querySelector('#aiQ').value.trim();if(!q)return;let a='';
    if(/لم أعمل|متوقفة|أسبوع/.test(q)){const stale=Store.col('projects').filter(p=>Date.now()-new Date(p.updatedAt).getTime()>7*864e5);a=stale.length?('مشاريع متوقفة: '+stale.map(p=>p.name).join('، ')):'لا مشاريع متوقفة — ممتاز 🎉'}
    else if(/متأخر|مهام/.test(q)){const late=Store.col('tasks').filter(x=>!x.done);a=`لديك ${late.length} مهام مفتوحة: `+late.slice(0,5).map(x=>x.title).join('، ')}
    else{const r=globalSearch(q);a=r.length?r.slice(0,5).map(x=>`[${x.type}] ${x.title}`).join('\n'):'لا نتائج في بياناتك'}
    el.querySelector('#aiOut').innerHTML=`<div class="item">🤖 ${escapeHTML(a)}</div>`;log(q,a);Store.audit('ai_ask',{q:q.slice(0,60)})};
  el.querySelector('#aiCloud').onclick=async()=>{const q=el.querySelector('#aiQ').value.trim();if(!q)return;const ep=Store.get('settings',{}).aiEndpoint||'/api/ai';
    el.querySelector('#aiOut').innerHTML='<div class="muted">… يتصل بخادمك</div>';
    try{const ctx=Store.col('notes').filter(n=>!n.deleted).slice(0,10).map(n=>n.title+': '+(n.body||'').slice(0,200)).join('\n');
      const r=await fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:q,context:ctx})});
      if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();el.querySelector('#aiOut').innerHTML=`<div class="item">☁ ${escapeHTML(j.answer||'—')}</div>`;log(q,'[cloud] '+(j.answer||''))}
    catch{el.querySelector('#aiOut').innerHTML='<div class="muted">تعذر الاتصال — شغّل الخادم (node server/server.js) واضبط AI_KEY في بيئته. المحلي يعمل دائمًا.</div>'}};
  el.querySelector('#aiSum').onclick=()=>{const n=Store.col('notes').find(x=>x.id===el.querySelector('#aiN').value);el.querySelector('#aiSumOut').textContent=n?sum(n.body||''):'—'};
  el.querySelector('#aiOrg').onclick=()=>{const untagged=Store.col('files').filter(f=>!(f.tags||[]).length).length;el.querySelector('#aiOrgOut').textContent=`${untagged} ملفات بلا وسم. اقتراح: مجلدات مشاريع/ + وسم حسب النوع + أرشفة الألبومات القديمة.`};
  el.querySelector('#aiPlan').onclick=()=>{const n=Store.col('notes').find(x=>x.id===el.querySelector('#aiP').value);if(!n)return;const p=Store.push('projects',{name:n.title,desc:sum(n.body||''),stage:'PLANNING',priority:'P1'});(n.body||'').split('\n').filter(x=>x.trim()).slice(0,5).forEach(l=>Store.push('tasks',{title:l.slice(0,80),projectId:p.id,priority:'P2',done:false}));toast('أُنشئت خطة مشروع 🚀');location.hash='#/projects'};
}
