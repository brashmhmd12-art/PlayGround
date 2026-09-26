import {Store} from '../store.js';import {escapeHTML} from '../core.js';
export function render(el){el.innerHTML=`<h2 style="margin:0">🕸 ABRASH MEMORY GRAPH</h2><p class="muted">مشروع ↔ ملاحظات ↔ ملفات ↔ مهام ↔ أهداف — اسحب العقدة ذهنيًا عبر التكبير هنا (عرض ثابت تفاعلي)</p><canvas id="graphCanvas"></canvas><div id="gInfo" class="card" style="margin-top:10px">انقر أي عقدة لرؤية روابطها</div>`;
  const nodes=[],edges=[];const add=(id,label,kind)=>{if(!nodes.some(n=>n.id===id))nodes.push({id,label,kind,x:Math.random(),y:Math.random()})};
  Store.col('projects').slice(0,8).forEach(p=>add('p:'+p.id,p.name,'proj'));
  Store.col('notes').filter(n=>!n.deleted).slice(0,12).forEach(n=>{add('n:'+n.id,n.title||'note','note');if(n.project){const p=Store.col('projects').find(x=>x.name===n.project);if(p)edges.push(['n:'+n.id,'p:'+p.id])}});
  Store.col('tasks').slice(0,12).forEach(x=>{add('t:'+x.id,x.title,'task');if(x.projectId)edges.push(['t:'+x.id,'p:'+x.projectId])});
  Store.col('goals').slice(0,6).forEach(g=>add('g:'+g.id,g.title,'goal'));
  Store.col('ideas').slice(0,6).forEach(g=>add('i:'+g.id,g.title,'idea'));
  const cv=el.querySelector('#graphCanvas'),cx=cv.getContext('2d');
  const draw=()=>{cv.width=cv.offsetWidth*2;cv.height=840;const W=cv.width,H=cv.height;cx.clearRect(0,0,W,H);
    cx.strokeStyle='#243056';cx.lineWidth=2;edges.forEach(([a,b])=>{const A=nodes.find(n=>n.id===a),B=nodes.find(n=>n.id===b);if(!A||!B)return;cx.beginPath();cx.moveTo(A.x*W,A.y*H);cx.lineTo(B.x*W,B.y*H);cx.stroke()});
    nodes.forEach(n=>{const X=n.x*W,Y=n.y*H;cx.fillStyle=n.kind==='proj'?'#7c5cff':n.kind==='note'?'#22d3ee':n.kind==='task'?'#34d399':n.kind==='goal'?'#f59e0b':'#ec4899';cx.beginPath();cx.arc(X,Y,n.kind==='proj'?26:18,0,7);cx.fill();cx.fillStyle='#fff';cx.font='20px sans-serif';cx.textAlign='center';cx.fillText((n.label||'').slice(0,10),X,Y+40);n._X=X;n._Y=Y})};
  draw();addEventListener('resize',draw);
  cv.onclick=e=>{const r=cv.getBoundingClientRect(),mx=(e.clientX-r.left)*2,my=(e.clientY-r.top)*2;const n=nodes.find(n=>Math.hypot(n._X-mx,n._Y-my)<60);
    el.querySelector('#gInfo').innerHTML=n?`<b>${escapeHTML(n.label)}</b> — روابط: ${edges.filter(x=>x.includes(n.id)).length} · النوع ${n.kind}`:'انقر عقدة'};
}
