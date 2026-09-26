import {Store} from '../store.js';import {escapeHTML} from '../core.js';
export function render(el){el.innerHTML=`<div class="between"><h2 style="margin:0">🎯 GOALS</h2><button class="btn primary sm" id="gNew">＋ هدف</button></div><div class="grid g2" style="margin-top:12px" id="gL"></div>`;
  const draw=()=>{el.querySelector('#gL').innerHTML=Store.col('goals').map(g=>`<div class="card"><h3>${escapeHTML(g.title)} <span class="pill">${escapeHTML(g.range||'شهري')}</span></h3><div class="stat">${g.progress||0}%</div><div class="bar"><i style="width:${g.progress||0}%"></i></div><input type="range" min="0" max="100" value="${g.progress||0}" data-r="${g.id}"><div class="row"><button class="btn sm danger" data-d="${g.id}">حذف</button></div></div>`).join('')||'<div class="card">مثال: تعلم Cybersecurity ████████░░ 80%</div>';
    el.querySelectorAll('[data-r]').forEach(r=>r.oninput=()=>{Store.update('goals',r.dataset.r,{progress:+r.value});r.closest('.card').querySelector('.stat').textContent=r.value+'%';r.closest('.card').querySelector('.bar i').style.width=r.value+'%'});
    el.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{Store.remove('goals',b.dataset.d);draw()})};
  el.querySelector('#gNew').onclick=()=>{const v=prompt('الهدف: تعلم Cybersecurity');if(!v)return;Store.push('goals',{title:v,range:'شهري',progress:10});draw()};
  draw();
}
