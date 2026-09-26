import {Store} from '../store.js';import {escapeHTML} from '../core.js';import {toast,empty} from '../ui.js';
const ST=['RAW','RESEARCH','VALIDATION','BUILDING','LAUNCHED'];
export function render(el){el.innerHTML=`<div class="between"><h2 style="margin:0">💡 IDEA LAB</h2><button class="btn primary sm" id="iNew">＋ فكرة</button></div><div class="kanban" style="margin-top:12px">${ST.map(s=>`<div class="col"><b>${s}</b><div class="list" data-s="${s}" style="margin-top:8px"></div></div>`).join('')}</div>`;
  const draw=()=>{const arr=Store.col('ideas');el.querySelectorAll('[data-s]').forEach(col=>{const s=col.dataset.s;col.innerHTML=arr.filter(x=>x.stage===s).map(x=>`<div class="item" data-id="${x.id}">💡 <b>${escapeHTML(x.title)}</b><span style="margin-inline-start:auto" class="row"><button class="btn sm" data-n="r" data-id="${x.id}">▶</button><button class="btn sm danger" data-n="d" data-id="${x.id}">✕</button></span></div><div class="muted" style="font-size:12px">مشكلة: ${escapeHTML(x.problem||'—')} · حل: ${escapeHTML(x.solution||'—')} · جمهور: ${escapeHTML(x.audience||'—')}</div>`).join('')||'<div class="muted">—</div>'});
    el.querySelectorAll('[data-n=r]').forEach(b=>b.onclick=()=>{const it=arr.find(x=>x.id===b.dataset.id);const i=Math.min(ST.length-1,ST.indexOf(it.stage)+1);Store.update('ideas',it.id,{stage:ST[i]});draw()});
    el.querySelectorAll('[data-n=d]').forEach(b=>b.onclick=()=>{Store.remove('ideas',b.dataset.d);draw()})};
  el.querySelector('#iNew').onclick=()=>{const v=prompt('الفكرة (حتى لو غير مكتملة):');if(!v)return;Store.push('ideas',{title:v.slice(0,100),problem:'',solution:'',audience:'',cost:'',risk:'',stage:'RAW'});draw()};
  draw();
}
