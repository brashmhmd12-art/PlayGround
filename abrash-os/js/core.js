export const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
export const uid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
export const nowISO=()=>new Date().toISOString();
export const fmtD=iso=>{try{return new Date(iso).toLocaleString(document.documentElement.lang==='ar'?'ar':'en',{dateStyle:'medium',timeStyle:'short'})}catch{return iso}};
export function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function mdLite(src){let h=escapeHTML(src);h=h.replace(/^### (.*)$/gm,'<h4>$1</h4>').replace(/^## (.*)$/gm,'<h3>$1</h3>').replace(/^# (.*)$/gm,'<h2>$1</h2>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/^- (.*)$/gm,'• $1').replace(/\n/g,'<br>');return h}
export function download(name,text,type='application/json'){const b=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
export const Bus={m:{},on(e,f){(this.m[e]??=[]).push(f)},emit(e,d){(this.m[e]||[]).forEach(f=>f(d))}};
export const deviceFP=()=>{const s=[navigator.userAgent,screen.width+'x'+screen.height,Intl.DateTimeFormat().resolvedOptions().timeZone,navigator.language].join('|');let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return 'dev-'+h.toString(36)};
export function noteToMarkdown(n){const tags=(n.tags||[]).map(x=>'#'+x).join(' ');return `# ${n.title||'بلا عنوان'}\n\n> type: ${n.type||'نصية'} · ${n.updatedAt||''} ${tags?'· '+tags:''}\n\n${n.body||''}\n`}
