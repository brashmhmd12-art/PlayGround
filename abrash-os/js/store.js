import {uid,nowISO} from './core.js';
const P='abrashos.v1.';
const read=(k,f)=>{try{const v=localStorage.getItem(P+k);return v?JSON.parse(v):f}catch{return f}};
const write=(k,v)=>localStorage.setItem(P+k,JSON.stringify(v));
export const Store={
  get(k,f){return read(k,f)}, set(k,v){write(k,v)},
  col(k){return read(k,[])}, push(k,obj){const a=read(k,[]);a.unshift({id:uid(),createdAt:nowISO(),updatedAt:nowISO(),...obj});write(k,a);return a[0]},
  update(k,id,patch){const a=read(k,[]).map(x=>x.id===id?{...x,...patch,updatedAt:nowISO()}:x);write(k,a)},
  remove(k,id){write(k,read(k,[]).filter(x=>x.id!==id))},
  audit(action,meta={}){const a=read('audits',[]);a.unshift({id:uid(),action,meta,at:nowISO(),ua:navigator.userAgent.slice(0,120)});write('audits',a.slice(0,500))},
};
export const seedDefaults=()=>{if(!read('settings',null))write('settings',{lang:'ar',theme:'obsidian',aiSuggest:true,vaultLockMin:5,widgets:['tasks','projects','notes','files','goals','activity']});};
