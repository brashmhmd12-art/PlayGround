import {Store} from '../store.js';
// Recurring engine: template tasks carry {recurring:'daily'|'weekly'|'monthly', nextDue:'YYYY-MM-DD'}.
// runRecurring() spawns open instances for every missed period, then advances nextDue. Pure-ish (injectable today).
const STEP={daily:1,weekly:7,monthly:30};
const dstr=d=>d.toISOString().slice(0,10);
export function runRecurring(today=dstr(new Date())){let made=0;
  for(const t of Store.col('tasks')){if(!t.recurring||!STEP[t.recurring]||t.isTemplate===false)continue;
    if(t.isInstance)continue; // instances never spawn
    let next=t.nextDue||t.due||today;let guard=0;
    while(next<=today&&guard++<60){
      const open=Store.col('tasks').some(x=>x.isInstance&&x.tplId===t.id&&x.due===next&&!x.done);
      if(!open){Store.push('tasks',{title:t.title,priority:t.priority||'P2',done:false,due:next,projectId:t.projectId||'',isInstance:true,tplId:t.id});made++}
      const d=new Date(next+'T12:00:00');d.setDate(d.getDate()+STEP[t.recurring]);next=dstr(d)}
    if(next!==(t.nextDue||''))Store.update('tasks',t.id,{nextDue:next})}
  if(made)Store.audit('recurring_spawn',{made});return made}
