import {Store} from '../store.js';import {escapeHTML,fmtD} from '../core.js';import {toast,confirmDlg} from '../ui.js';import {Auth} from '../auth.js';
export function render(el){const logins=Store.col('logins').slice(0,20),sess=Store.col('sessions'),devs=Store.col('devices'),fails=logins.filter(l=>!l.ok);
  el.innerHTML=`<h2 style="margin:0">🛡 Security Center</h2><p class="muted">الأجهزة · الجلسات · محاولات الدخول · التنبيهات — إلغاء أي جلسة عن بعد</p>
  <div class="grid g3"><div class="card"><h3>🔑 2FA / TOTP ${Auth.totpOn()?'✅ مفعّل':'⚠ معطّل'}</h3>
    ${Auth.totpOn()?'<button class="btn sm danger" id="sTotpOff">تعطيل 2FA</button>':'<button class="btn sm primary" id="sTotp">تفعيل TOTP</button><div id="sTotpBox" class="muted" style="word-break:break-all"></div>'}
    <p class="fine">TOTP حقيقي (RFC 6238) — امسح السر في Google Authenticator إدخالًا يدويًا.</p></div>
  <div class="card"><h3>🪪 Passkey <span class="pill">خادم فقط</span></h3><div class="muted" id="wnMsg">مفتاح مرور (بصمة/جهاز) — دخول بلا كلمة مرور عبر خادمك. يتطلب HTTPS أو localhost.</div>
    <div class="row" style="margin-top:8px"><button class="btn sm primary" id="wnReg">＋ تسجيل Passkey</button></div></div>
  <div class="card"><h3>📱 الأجهزة الموثوقة (${devs.length})</h3>${devs.map(d=>`<div class="item">💻 ${escapeHTML(d.fp)} <span class="pill">${d.trusted?'موثوق':'جديد ⚠'}</span><button class="btn sm" data-tr="${d.fp}">${d.trusted?'إلغاء':'توثيق'}</button></div>`).join('')||'—'}</div>
  <div class="card"><h3>⚠ التنبيهات</h3>${fails.slice(0,4).map(f=>`<div class="item">⛔ فشل دخول: ${escapeHTML(f.user)} · ${fmtD(f.at||f.createdAt)}</div>`).join('')||'<div class="muted">لا تنبيهات — الوضع هادئ ✅</div>'}<button class="btn sm danger" id="sAll" style="margin-top:8px">تسجيل الخروج من كل الأجهزة</button></div></div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><h3>🟢 الجلسات النشطة (${sess.length})</h3><div class="list">${sess.map(s=>`<div class="item">🌐 ${escapeHTML(s.dev||'')} · ${escapeHTML((s.ua||'').slice(0,40))} · IP:${escapeHTML(s.ip||'local')}<span style="margin-inline-start:auto"><button class="btn sm danger" data-rv="${s.id}">إلغاء</button></span></div>`).join('')||'—'}</div></div>
  <div class="card"><h3>📜 آخر عمليات الدخول + IP/جهاز/متصفح</h3><table><tr><th>المستخدم</th><th>النتيجة</th><th>الجهاز</th><th>الوقت</th></tr>${logins.map(l=>`<tr><td>${escapeHTML(l.user)}</td><td>${l.ok?'✅':'⛔'}</td><td class="muted">${escapeHTML(l.dev||'')} · ${(escapeHTML(l.ua||'')).slice(0,30)}</td><td>${fmtD(l.at||l.createdAt)}</td></tr>`).join('')}</table></div></div>
  <div class="card" style="margin-top:12px"><h3>📋 Audit Log (آخر 30)</h3><table><tr><th>الحدث</th><th>التفاصيل</th><th>الوقت</th></tr>${Store.col('audits').slice(0,30).map(a=>`<tr><td><span class="tag">${escapeHTML(a.action)}</span></td><td class="muted">${escapeHTML(JSON.stringify(a.meta||{}).slice(0,80))}</td><td>${fmtD(a.at)}</td></tr>`).join('')}</table></div>`;
  const off=el.querySelector('#sTotpOff');if(off)off.onclick=async()=>{if(await confirmDlg('تعطيل 2FA','سيصبح الدخول بكلمة المرور فقط')){Auth.totpDisable();toast('عُطّل 2FA');render(el)}};
  const on=el.querySelector('#sTotp');if(on)on.onclick=()=>{const {secret,uri}=Auth.totpSetup();const box=el.querySelector('#sTotpBox');
    box.innerHTML=`<div class="muted">السر (أدخله يدويًا في تطبيق المصادقة):</div><b>${secret}</b><div class="muted" style="font-size:11px">${uri}</div><div class="row" style="margin-top:8px"><input id="sTotpCode" placeholder="رمز من التطبيق" maxlength="6" inputmode="numeric" style="flex:1"><button class="btn sm primary" id="sTotpOk">تحقق وتفعيل</button></div>`;
    box.querySelector('#sTotpOk').onclick=()=>{Auth.totpEnable(secret,box.querySelector('#sTotpCode').value)?(toast('فُعّل 2FA ✅'),render(el)):toast('رمز خاطئ ⛔')}};
  el.querySelectorAll('[data-tr]').forEach(b=>b.onclick=()=>{const ds=Store.col('devices');const d=ds.find(x=>x.fp===b.dataset.tr);d.trusted=!d.trusted;Store.set('devices',ds);Store.audit('device_trust',{fp:d.fp,t:d.trusted});render(el)});
  el.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>{Store.set('sessions',Store.col('sessions').filter(s=>s.id!==b.dataset.rv));Store.audit('session_revoke',{id:b.dataset.rv});toast('أُلغيت الجلسة');render(el)});
  el.querySelector('#sAll').onclick=async()=>{if(await confirmDlg('خروج شامل','إلغاء كل الجلسات؟')){Auth.logout(true);location.reload()}};
  el.querySelector('#wnReg').onclick=async()=>{const m=el.querySelector('#wnMsg');
    try{const {wnOK,wnRegister}=await import('../webauthn.js');
      if(!wnOK())return m.textContent='متصفحك لا يدعم WebAuthn ⛔';
      let tok=null;try{tok=sessionStorage.getItem('abrash-sync-token')}catch{}
      if(!tok)tok=prompt('الصق توكن الخادم (اتصل أولًا من صفحة النسخ الاحتياطي):');if(!tok)return;
      m.textContent='المس مستشعر البصمة/المفتاح…';
      const j=await wnRegister(tok);m.textContent='سُجل Passkey ✓ id:'+String(j.id).slice(0,16)+'…';Store.audit('passkey_reg',{})}
    catch(e){m.textContent='فشل: '+e.message}};
}
