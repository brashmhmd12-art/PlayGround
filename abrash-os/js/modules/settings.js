import {Store} from '../store.js';import {toast,confirmDlg} from '../ui.js';import {fullExport} from './backup.js';import {download,escapeHTML} from '../core.js';
export function render(el){const s=Store.get('settings',{lang:'ar',theme:'obsidian',aiSuggest:true,vaultLockMin:5});
  el.innerHTML=`<h2 style="margin:0">⚙ الإعدادات والخصوصية</h2><div class="grid g2" style="margin-top:12px">
  <div class="card"><h3>🌍 اللغة والثيم</h3><div class="row"><select id="sLang"><option value="ar" ${s.lang==='ar'?'selected':''}>العربية RTL</option><option value="en" ${s.lang==='en'?'selected':''}>English LTR</option></select><select id="sTheme"><option value="obsidian" ${s.theme==='obsidian'?'selected':''}>Obsidian</option><option value="aurora" ${s.theme==='aurora'?'selected':''}>Aurora</option><option value="sand" ${s.theme==='sand'?'selected':''}>Sand</option></select></div>
  <label style="margin-top:10px">قفل الخزنة بعد (دقائق)</label><input id="sVault" type="number" min="1" max="60" value="${s.vaultLockMin||5}">
  <label style="margin-top:10px">قفل الشاشة عند الخمول (دقائق — 0 للتعطيل)</label><input id="sIdle" type="number" min="0" max="120" value="${s.idleMin??15}">
  <label style="margin-top:10px">نقطة المزامنة (خادمك — مثال: http://localhost:3001/api/sync)</label><input id="sSync" placeholder="/api/sync" value="${escapeHTML(s.syncEndpoint||'/api/sync')}">
  <div class="grid g2" style="margin-top:10px"><div><label>حذف السلة بعد (يوم)</label><input id="sRT" type="number" min="0" max="365" value="${s.retTrash??30}"></div><div><label>حذف السجلات بعد (يوم)</label><input id="sRL" type="number" min="0" max="365" value="${s.retLogs??90}"></div></div>
  <div class="row" style="margin-top:8px"><button class="btn sm" id="sRet">تنظيف الآن 🧹</button></div>
  <label style="margin-top:10px;display:flex;gap:8px"><input type="checkbox" id="sWx" ${s.weather?.on?'checked':''} style="width:auto"> ودجت الطقس (Open-Meteo — يتطلب إنترنت)</label>
  <div class="row"><input id="sLat" placeholder="lat 24.7" value="${escapeHTML(s.weather?.lat||'')}"><input id="sLon" placeholder="lon 46.7" value="${escapeHTML(s.weather?.lon||'')}"><button class="btn sm" id="sGeo">📍 موقعي</button></div></div>
  <div class="card"><h3>🤖 الذكاء والخصوصية</h3><label style="display:flex;gap:8px"><input type="checkbox" id="sAI" ${s.aiSuggest!==false?'checked':''} style="width:auto"> تفعيل الاقتراحات الذكية (قابلة للتعطيل بالكامل)</label><label style="display:block;margin-top:8px">نقطة AI السحابية (اختياري — خادمك فقط، المفتاح يبقى في بيئة الخادم)</label><input id="sKey" placeholder="/api/ai" value="${escapeHTML(s.aiEndpoint||'/api/ai')}"><div class="row" style="margin-top:10px"><button class="btn sm" id="sExp">تصدير كل بياناتي</button><button class="btn sm" id="sSeed">✨ بيانات تجريبية</button><button class="btn sm danger" id="sDel">حذف حسابي وبياناتي</button></div><p class="fine">مالك بياناتك. لا استخدام خارجي دون إذن. مفاتيح AI تُحفظ محليًا فقط.</p></div></div>`;
  el.querySelector('#sLang').onchange=e=>{s.lang=e.target.value;Store.set('settings',s);location.reload()};
  el.querySelector('#sTheme').onchange=e=>{s.theme=e.target.value;Store.set('settings',s);document.documentElement.dataset.theme=s.theme;toast('✓')};
  el.querySelector('#sVault').onchange=e=>{s.vaultLockMin=+e.target.value;Store.set('settings',s)};
  el.querySelector('#sIdle').onchange=e=>{s.idleMin=+e.target.value;Store.set('settings',s);toast('حُفظ قفل الخمول ✓')};
  el.querySelector('#sSync').onchange=e=>{s.syncEndpoint=e.target.value.trim()||'/api/sync';Store.set('settings',s);toast('حُفظت نقطة المزامنة ✓')};
  el.querySelector('#sRT').onchange=e=>{s.retTrash=+e.target.value;Store.set('settings',s)};
  el.querySelector('#sRL').onchange=e=>{s.retLogs=+e.target.value;Store.set('settings',s)};
  el.querySelector('#sRet').onclick=async()=>{const {applyRetention}=await import('./retention.js');const o=applyRetention(Store.get('settings',{}));toast(`نُظف: سلة ${o.trash} · سجلات ${o.logs} 🧹`)};
  el.querySelector('#sWx').onchange=e=>{s.weather={...(s.weather||{}),on:e.target.checked};Store.set('settings',s)};
  el.querySelector('#sLat').onchange=e=>{s.weather={...(s.weather||{}),lat:e.target.value};Store.set('settings',s)};
  el.querySelector('#sLon').onchange=e=>{s.weather={...(s.weather||{}),lon:e.target.value};Store.set('settings',s)};
  el.querySelector('#sGeo').onclick=()=>navigator.geolocation?.getCurrentPosition(p=>{s.weather={on:true,lat:String(p.coords.latitude.toFixed(2)),lon:String(p.coords.longitude.toFixed(2))};Store.set('settings',s);toast('حُفظ الموقع ✓');render(el)},()=>toast('تعذر الموقع ⛔'));
  el.querySelector('#sAI').onchange=e=>{s.aiSuggest=e.target.checked;Store.set('settings',s);toast(s.aiSuggest?'الاقتراحات مفعّلة':'الاقتراحات معطّلة ✓')};
  el.querySelector('#sExp').onclick=()=>download('abrash-all.json',JSON.stringify(fullExport()));
  el.querySelector('#sKey').onchange=e=>{s.aiEndpoint=e.target.value.trim()||'/api/ai';Store.set('settings',s);toast('حُفظت نقطة AI ✓')};
  el.querySelector('#sSeed').onclick=async()=>{const {seedDemo,isEmpty}=await import('./seed.js');if(!isEmpty()&&!await confirmDlg('بيانات تجريبية','لديك بيانات — إضافة التجريبية فوقها؟'))return;seedDemo()?toast('أُضيفت البيانات التجريبية ✨'):toast('أُضيفت فوق بياناتك ✓');location.hash='#/dashboard'};
  el.querySelector('#sDel').onclick=async()=>{if(await confirmDlg('حذف الحساب','مسح نهائي لكل شيء؟')){localStorage.clear();location.reload()}};
}
