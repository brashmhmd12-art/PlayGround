import {$} from './core.js';import {Store,seedDefaults} from './store.js';import {applyI18n,t} from './i18n.js';import {Auth} from './auth.js';import {toast} from './ui.js';import {COMMANDS,parseNatural} from './modules/search.js';import {escapeHTML} from './core.js';
const ROUTES={dashboard:'dashboard',notes:'notes',files:'files',projects:'projects',tasks:'tasks',vault:'vault',knowledge:'knowledge',calendar:'calendar',goals:'goals',ideas:'ideas',graph:'graph',ai:'ai',analytics:'analytics',backup:'backup',security:'security',settings:'settings',profile:'profile'};
const NAV=[['dashboard','◈'],['notes','🗒'],['tasks','⚙'],['projects','🚀'],['files','📎'],['vault','🔒'],['ai','✨'],['knowledge','📚'],['calendar','📅'],['goals','🎯'],['ideas','💡'],['graph','🕸'],['analytics','📊'],['backup','⇪'],['security','🛡'],['settings','⚙'],['profile','👤']];
async function load(route,el){const m=await import('./modules/'+route+'.js');m.render(el);$('#crumbTitle').textContent=t(route);$$_nav(route)}
function $$_nav(route){document.querySelectorAll('#nav .nav').forEach(a=>a.classList.toggle('active',a.dataset.r===route))}
function drawNav(){$('#nav').innerHTML=NAV.map(([r,i])=>`<button class="nav" data-r="${r}"><span>${i}</span><span>${t(r)}</span></button>`).join('');document.querySelectorAll('#nav .nav').forEach(b=>b.onclick=()=>{location.hash='#/'+b.dataset.r;$('#sidebar').classList.remove('open')})}
function route(){const h=(location.hash||'#/dashboard').replace('#/','');const r=ROUTES[h]?h:'dashboard';Auth.touch();load(r,$('#view'))}
// palette
let palIdx=0,palItems=[];
function openPal(){$('#palette').classList.remove('hidden');$('#palInput').value='';drawPal('');setTimeout(()=>$('#palInput').focus(),30)}
function closePal(){$('#palette').classList.add('hidden')}
function drawPal(q){const res=q?parseNatural(q).results||[]:[];const cmds=COMMANDS.filter(c=>!q||c[0].includes(q)||c[2].includes(q.toLowerCase()));
  palItems=[...cmds.map(c=>({label:c[0],go:c[1]})),...res.map(r=>({label:`${r.type} — ${r.title}`,go:r.hash}))];
  palIdx=0;paintPal()}
function paintPal(){$('#palList').innerHTML=palItems.map((x,i)=>`<div class="pal-it ${i===palIdx?'sel':''}" data-i="${i}">⚡ ${escapeHTML(x.label)}</div>`).join('')||'<div class="muted" style="padding:10px">لا نتائج — جرّب "أنشئ مشروع باسم X"</div>';
  document.querySelectorAll('.pal-it').forEach(d=>{d.onclick=()=>goPal(+d.dataset.i);d.onmousemove=()=>{palIdx=+d.dataset.i;paintPal()}});
  document.querySelector('.pal-it.sel')?.scrollIntoView({block:'nearest'})}
function goPal(i){const it=palItems[i];if(!it)return closePal();const q=$('#palInput').value.trim();
  if(q&&(it.label.startsWith('📝')||it.label.startsWith('🚀')||!it.go)){const r=parseNatural(q);if(r.msg){toast(r.msg);if(r.go)location.hash=r.go;closePal();return}}
  location.hash=it.go;closePal()}
async function boot(){if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
  seedDefaults();import('./modules/retention.js').then(m=>m.applyRetention()).catch(()=>{});const s=Store.get('settings',{lang:'ar',theme:'obsidian'});document.documentElement.dataset.theme=s.theme||'obsidian';applyI18n();drawNav();
  setInterval(()=>{const c=$('#clock');if(c)c.textContent=new Date().toLocaleString(s.lang==='ar'?'ar':'en',{timeStyle:'medium'})},1000);
  const on=()=>$('#netBadge').textContent=navigator.onLine?'● Online':'○ Offline';addEventListener('online',on);addEventListener('offline',on);on();
  const sess=Store.get('session',null);
  $('#boot').classList.add('hidden');
  if(sess&&sess.user){$('#app').classList.remove('hidden');const ph=Store.get('settings',{}).photo;if(ph)$('#avatar').src=ph;route()}
  else{$('#authView').classList.remove('hidden');
    $('#tabLogin').onclick=()=>{$('#tabLogin').classList.add('active');$('#tabSignup').classList.remove('active');$('#loginForm').classList.remove('hidden');$('#signupForm').classList.add('hidden')};
    $('#tabSignup').onclick=()=>{$('#tabSignup').classList.add('active');$('#tabLogin').classList.remove('active');$('#signupForm').classList.remove('hidden');$('#loginForm').classList.add('hidden')};
    $('#signupForm').onsubmit=async e=>{e.preventDefault();try{await Auth.signup($('#suUser').value,$('#suEmail').value,$('#suPass').value);$('#signupMsg').textContent='تم ✓ سجّل الدخول الآن';toast('هويتك جاهزة — سجّل الدخول')}catch(err){$('#signupMsg').textContent=err.message}};
    $('#loginForm').onsubmit=async e=>{e.preventDefault();try{await Auth.login($('#liUser').value,$('#liPass').value,$('#liOtp').value||null);location.reload()}catch(err){$('#loginMsg').textContent=err.message}}}
  addEventListener('hashchange',()=>{if(Auth.user())route()});
  $('#logoutBtn').onclick=()=>{Auth.logout();location.reload()};
  $('#collapseBtn').onclick=()=>$('#app').classList.toggle('folded');
  $('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
  $('#langBtn').onclick=()=>{const st=Store.get('settings',{});st.lang=st.lang==='ar'?'en':'ar';Store.set('settings',st);location.reload()};
  $('#themeBtn').onclick=()=>{const order=['obsidian','aurora','sand'];const st=Store.get('settings',{});st.theme=order[(order.indexOf(st.theme)+1)%3];Store.set('settings',st);document.documentElement.dataset.theme=st.theme};
  $('#vaultLockBtn').onclick=()=>{import('./modules/vault.js').then(m=>m.lockVault());location.hash='#/vault';toast('🔒')};
  $('#paletteBtn').onclick=openPal;$('#palette').onclick=e=>{if(e.target.id==='palette')closePal()};
  $('#palInput').oninput=e=>drawPal(e.target.value);
  // idle lock (whole app — session stays, screen locks)
  let lastAct=Date.now(),locked=false;
  ['click','keydown','touchstart'].forEach(e=>document.addEventListener(e,()=>{lastAct=Date.now()},{passive:true}));
  setInterval(()=>{const s=Store.get('settings',{});const mins=+s.idleMin||0;
    if(!Auth.user()||locked||!mins||Date.now()-lastAct<mins*60000)return;locked=true;
    const d=document.createElement('div');d.id='applock';d.innerHTML=`<div class="auth-card" style="text-align:center"><div class="logo lg">A</div><h1>مقفل 🔒</h1><p class="muted">قفل خمول — أدخل كلمة المرور للمتابعة</p><input type="password" id="lockP" placeholder="كلمة المرور"><button class="btn primary" id="lockGo" style="margin-top:10px;width:100%">فتح</button><p class="msg" id="lockM"></p></div>`;
    document.body.appendChild(d);
    const go=async()=>{if(await Auth.checkPass(d.querySelector('#lockP').value)){d.remove();locked=false;lastAct=Date.now();Store.audit('unlock',{})}else d.querySelector('#lockM').textContent='خاطئة ⛔'};
    d.querySelector('#lockGo').onclick=go;d.querySelector('#lockP').onkeydown=e=>{if(e.key==='Enter')go};setTimeout(()=>d.querySelector('#lockP').focus(),50)},15000);
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#palette').classList.contains('hidden')?openPal():closePal()}if(e.key==='Escape')closePal();
    if(!$('#palette').classList.contains('hidden')&&(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Enter')){e.preventDefault();if(e.key==='ArrowDown')palIdx=Math.min(palItems.length-1,palIdx+1);else if(e.key==='ArrowUp')palIdx=Math.max(0,palIdx-1);if(e.key==='Enter')goPal(palIdx);else paintPal()}
    if(e.key==='?'&&!/INPUT|TEXTAREA/.test(document.activeElement?.tagName||'')){showShortcuts()}});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
const SHORTCUTS=[['Ctrl/⌘ + K','فتح نافذة الأوامر والبحث الشامل'],['↑ / ↓ + Enter','التنقل بين نتائج Palette واختيارها'],['Esc','إغلاق النوافذ'],['?','عرض هذه القائمة'],['g ثم d/n/t/p/v','الذهاب: لوحة/ملاحظات/مهام/مشاريع/خزنة']];
let gPending=false;
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test(document.activeElement?.tagName||'')||e.ctrlKey||e.metaKey)return;
  if(gPending){gPending=false;const m={d:'dashboard',n:'notes',t:'tasks',p:'projects',v:'vault'};if(m[e.key])location.hash='#/'+m[e.key];return}
  if(e.key==='g'){gPending=true;setTimeout(()=>gPending=false,800)}});
function showShortcuts(){import('./ui.js').then(({confirmDlg})=>{const d=document.createElement('div');d.innerHTML='<table>'+SHORTCUTS.map(s=>`<tr><td><b>${s[0]}</b></td><td>${s[1]}</td></tr>`).join('')+'</table>';confirmDlg('⌨ اختصارات لوحة المفاتيح',d).then(()=>{})})}
