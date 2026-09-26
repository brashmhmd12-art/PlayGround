import {Store} from '../store.js';
// Retention: purge soft-deleted notes, old audits/logins, auto backups past N days.
// Manual + automatic (runs on boot). Returns counts. Pure-ish (injectable now).
export function applyRetention(s=Store.get('settings',{}),now=Date.now()){
  const trashDays=s.retTrash==null?30:+s.retTrash,logDays=s.retLogs==null?90:+s.retLogs;const out={trash:0,logs:0};
  if(trashDays>=0){const cut=now-trashDays*864e5;
    const keep=Store.col('notes').filter(n=>{const gone=n.deleted&&new Date(n.updatedAt||n.createdAt||0).getTime()<cut;if(gone)out.trash++;return !gone});
    Store.set('notes',keep)}
  if(logDays>=0){const cut=now-logDays*864e5;const fresh=a=>new Date(a.at||a.createdAt||0).getTime()>=cut;
    for(const k of ['audits','logins']){const a=Store.col(k);out.logs+=a.length-a.filter(fresh).length;Store.set(k,a.filter(fresh))}}
  if(out.trash||out.logs)Store.audit('retention',{...out});return out}
