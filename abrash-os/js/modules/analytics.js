import {Store} from '../store.js';import {bars,lineChart} from '../ui.js';
export function render(el){const notes=Store.col('notes').filter(n=>!n.deleted).length,files=Store.col('files').length,projs=Store.col('projects').length;
  const done=Store.col('tasks').filter(x=>x.done).length,open=Store.col('tasks').filter(x=>!x.done).length;
  const late=Store.col('tasks').filter(x=>!x.done&&x.due&&new Date(x.due)<new Date()).length;
  const days=[...Array(7)].map((_,i)=>{const d=new Date(Date.now()-(6-i)*864e5).toISOString().slice(0,10);return Store.col('audits').filter(a=>(a.at||'').startsWith(d)).length});
  el.innerHTML=`<h2 style="margin:0">📊 ABRASH ANALYTICS</h2><div class="grid g4" style="margin-top:12px">
  <div class="card"><h3>ملاحظات</h3><div class="stat">${notes}</div></div><div class="card"><h3>ملفات</h3><div class="stat">${files}</div></div>
  <div class="card"><h3>مشاريع</h3><div class="stat">${projs}</div></div><div class="card"><h3>مهام: مكتملة/متأخرة</h3><div class="stat">${done}/${late}</div></div></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><h3>نشاطي خلال الأسبوع</h3><canvas class="chart" id="c1"></canvas></div>
  <div class="card"><h3>التوزيع</h3><canvas class="chart" id="c2"></canvas></div></div>`;
  lineChart(el.querySelector('#c1'),days);bars(el.querySelector('#c2'),[],[notes,files,projs,done,open]);
}
