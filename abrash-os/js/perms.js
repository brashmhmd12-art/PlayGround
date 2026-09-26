// Roles: single-user now, multi-user ready. Owner > Admin > Editor > Viewer.
const RANK={viewer:0,editor:1,admin:2,owner:3};
const NEED={read:0,create:1,edit:1,upload:1,share:1,export:2,invite:2,delete:2,wipe:3,role:3,security:2};
export const can=(role,action)=>(RANK[role]??0)>=(NEED[action]??3);
export const myRole=()=>{try{const s=JSON.parse(localStorage.getItem('abrashos.v1.session')||'null');return s?.user?.role||'owner'}catch{return 'owner'}};
