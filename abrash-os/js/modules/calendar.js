import {Store} from '../store.js';import {escapeHTML} from '../core.js';
const ds=d=>d.toISOString().slice(0,10);
export function render(el){let view=Store.get('calView','month');let anchor=ds(new Date());
  const paint=()=>{const evs=Store.col('events');const tasks=Store.col('tasks').filter(x=>x.due);
    const on=day=>[...evs.filter(e=>e.date===day).map(e=>['📌',e.title]),...tasks.filter(x=>x.due===day).map(x=>[x.done?'✅':'⏰',x.title])];
    let grid='';
    if(view==='month'){const [Y,M]=anchor.slice(0,7).split('-').map(Number);const first=new Date(Y,M-1,1).getDay(),days=new Date(Y,M,0).getDate();const pre=String(M).padStart(2,'0');
      grid=`<div class="grid" style="grid-template-columns:repeat(7,1fr);gap:6px">${['ح','ن','ث','ر','خ','ج','س'].map(x=>`<b class="muted" style="text-align:center">${x}</b>`).join('')}${'<div></div>'.repeat(first)}${Array.from({length:days},(_,i)=>{const day=`${Y}-${pre}-${String(i+1).padStart(2,'0')}`;const it=on(day);return `<div class="item" data-day="${day}" style="justify-content:center;flex-direction:column;gap:2px;${it.length?'border-color:var(--acc)':''}"><b>${i+1}</b>${it.slice(0,2).map(x=>`<span style="font-size:11px">${x[0]} ${escapeHTML(x[1].slice(0,12))}</span>`).join('')}</div>`}).join('')}</div>`}
    else{const a=new Date(anchor+'T12:00:00');const daysN=view==='week'?7:1;const start=new Date(a);if(view==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
      grid=`<div class="list">${Array.from({length:daysN},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const day=ds(d);const it=on(day);
        return `<div class="card"><b>${d.toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'short'})}</b><div class="list" style="margin-top:6px">${it.map(x=>`<div class="item">${x[0]} ${escapeHTML(x[1])}</div>`).join('')||'<div class="muted">—</div>'}</div></div>`}).join('')}</div>`}
    el.innerHTML=`<div class="between"><h2 style="margin:0">📅 التقويم</h2><div class="row"><button class="btn sm ${view==='day'?'primary':''}" data-v="day">يوم</button><button class="btn sm ${view==='week'?'primary':''}" data-v="week">أسبوع</button><button class="btn sm ${view==='month'?'primary':''}" data-v="month">شهر</button><button class="btn sm" id="cPrev">◀</button><button class="btn sm" id="cToday">اليوم</button><button class="btn sm" id="cNext">▶</button><button class="btn primary sm" id="cNew">＋ حدث</button></div></div>
    <div class="card" style="margin-top:12px"><div class="muted" style="margin-bottom:8px">${anchor}</div>${grid}</div>`;
    el.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;Store.set('calView',view);paint()});
    const shift=n=>{const d=new Date(anchor+'T12:00:00');d.setDate(d.getDate()+n*(view==='month'?30:view==='week'?7:1));anchor=ds(d);paint()};
    el.querySelector('#cPrev').onclick=()=>shift(-1);el.querySelector('#cNext').onclick=()=>shift(1);
    el.querySelector('#cToday').onclick=()=>{anchor=ds(new Date());paint()};
    el.querySelectorAll('[data-day]').forEach(d=>d.onclick=()=>{anchor=d.dataset.day;view='day';Store.set('calView',view);paint()});
    el.querySelector('#cNew').onclick=()=>{const title=prompt('عنوان الحدث:');if(!title)return;const date=prompt('التاريخ YYYY-MM-DD',anchor);Store.push('events',{title,date});Store.audit('event_create',{});paint()}};
  paint();
}
