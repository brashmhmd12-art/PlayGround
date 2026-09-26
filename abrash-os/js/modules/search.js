import {Store} from '../store.js';import {escapeHTML} from '../core.js';
export function globalSearch(q){q=q.trim();if(!q)return [];const out=[];
  const push=(type,title,snip,hash)=>out.push({type,title,snip,hash});
  Store.col('notes').filter(n=>!n.deleted).forEach(n=>{if((n.title+n.body+(n.tags||[]).join(' ')).includes(q))push('📝 ملاحظة',n.title,(n.body||'').slice(0,80),'#/notes')});
  Store.col('projects').forEach(p=>{if((p.name+p.desc).includes(q))push('🚀 مشروع',p.name,p.desc||'', '#/projects')});
  Store.col('tasks').forEach(x=>{if(x.title.includes(q))push('⬜ مهمة',x.title,x.priority||'', '#/tasks')});
  Store.col('files').forEach(f=>{if((f.name+(f.tags||[]).join(' ')).includes(q))push('📎 ملف',f.name,f.folder||'', '#/files')});
  Store.col('knowledge').forEach(k=>{if((k.title+k.body).includes(q))push('📚 معرفة',k.title,k.cat||'', '#/knowledge')});
  Store.col('ideas').forEach(k=>{if((k.title+k.desc).includes(q))push('💡 فكرة',k.title,k.stage||'', '#/ideas')});
  return out.slice(0,30)}
export const COMMANDS=[['＋ ملاحظة','#/notes','create note'],['＋ مشروع','#/projects','create project'],['⇪ رفع ملف','#/files','upload'],['🔒 الخزنة','#/vault','vault'],['＋ مهمة','#/tasks','task'],['📅 التقويم','#/calendar','calendar'],['✨ اسأل AI','#/ai','ai'],['🛡 الأمان','#/security','security'],['⚙ الإعدادات','#/settings','settings'],['🕸 الذاكرة','#/graph','graph']];
export function parseNatural(qRaw){const q=qRaw.trim().replace(/[ً-ٟ]/g,'');
  let m=q.match(/أنشئ مشروع باسم (.+)/)||q.match(/create project (.+)/i);if(m){const p=Store.push('projects',{name:m[1].slice(0,80),stage:'IDEA',priority:'P2'});Store.audit('project_create',{via:'palette'});return {msg:'أُنشئ المشروع: '+m[1],go:'#/projects'}}
  m=q.match(/ذكرني غدا?ء? بـ?(.+)/)||q.match(/remind (.+)/i);if(m){Store.push('tasks',{title:m[1],due:new Date(Date.now()+864e5).toISOString().slice(0,10),priority:'P1',done:false});return {msg:'تذكير غدًا ✓',go:'#/tasks'}}
  m=q.match(/ابحث عن (.+)/)||q.match(/search (.+)/i);if(m)return {results:globalSearch(m[1])};
  return {results:globalSearch(q)}}
