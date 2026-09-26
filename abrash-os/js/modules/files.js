import {Store} from '../store.js';import {escapeHTML,fmtD} from '../core.js';import {toast,empty,confirmDlg} from '../ui.js';
const BLOCK=['exe','bat','cmd','sh','msi','dll','ps1'];
export function render(el){el.innerHTML=`<div class="between"><h2 style="margin:0">📎 مكتبة الوسائط + Albums</h2><label class="btn primary sm">⇪ رفع<input type="file" id="fUp" multiple hidden></label></div>
  <div class="toolbar"><input id="fS" placeholder="بحث ملفات / وسوم…"><select id="fF"><option value="">كل المجلدات</option></select><button class="btn sm" id="fAlb">＋ مجلد/ألبوم</button></div>
  <div class="list" id="fL"></div>`;
  const folders=()=>[...new Set(Store.col('files').map(f=>f.folder).filter(Boolean))];
  const draw=()=>{const s=el.querySelector('#fS').value.trim();const ff=el.querySelector('#fF').value;
    el.querySelector('#fF').innerHTML=`<option value="">كل المجلدات</option>`+folders().map(x=>`<option ${ff===x?'selected':''}>${escapeHTML(x)}</option>`).join('');
    let arr=Store.col('files');if(ff)arr=arr.filter(f=>f.folder===ff);if(s)arr=arr.filter(f=>(f.name+(f.tags||[]).join(' ')).includes(s));
    el.querySelector('#fL').innerHTML=arr.map(f=>    `<div class="item">📄 <b>${escapeHTML(f.name)}</b><span class="pill">${escapeHTML(f.kind||'file')} · ${(f.size||0)}B · v${(f.versions||[]).length+1}</span>${(f.tags||[]).map(x=>`<span class="tag">${escapeHTML(x)}</span>`).join('')}<span style="margin-inline-start:auto" class="row"><button class="btn sm" data-a="prev" data-id="${f.id}">معاينة</button><button class="btn sm" data-a="ren" data-id="${f.id}">تسمية</button><button class="btn sm" data-a="ver" data-id="${f.id}">نسخ (${(f.versions||[]).length})</button><button class="btn sm" data-a="dl" data-id="${f.id}">تنزيل</button><button class="btn sm danger" data-a="del" data-id="${f.id}">حذف</button></span></div>`).join('')||empty('مكتبة فارغة — ارفع صور / فيديو / PDF / ZIP');
    el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a,b.dataset.id))};
  const snapVer=f=>({at:new Date().toISOString(),size:f.size,data:(f.data||'').length<500000?f.data:''});
  const act=async(a,id)=>{const f=Store.col('files').find(x=>x.id===id);
    if(a==='ren'){const v=prompt('اسم جديد',f.name);if(v)Store.update('files',id,{name:v.slice(0,120)})}
    if(a==='ver'){const vs=f.versions||[];const {confirmDlg:cd}=await import('../ui.js');
      const box=document.createElement('div');box.innerHTML=vs.map((v,i)=>`<div class="item">🕓 ${v.at} · ${v.size}B ${v.data?'':'(بلا محتوى)'}<button class="btn sm" data-v="${i}" style="margin-inline-start:auto">استرجاع</button></div>`).join('')||'لا نسخ';
      box.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{const v=vs[+b.dataset.v];if(!v.data)return toast('لا محتوى محفوظ لهذه النسخة');Store.update('files',id,{versions:[snapVer(f),...vs].slice(0,5),data:v.data,size:v.size});toast('استُعيدت النسخة ✓');draw()});
      cd('نسخ الملف: '+f.name,box).then(()=>{})}
    if(a==='del'){if(await confirmDlg('حذف الملف','نقل إلى سجل التدقيق')){Store.remove('files',id);Store.audit('file_delete',{id})}}
    if(a==='dl'){const a2=document.createElement('a');a2.href=f.data||'#';a2.download=f.name;a2.click()}
    if(a==='prev'){toast((f.kind||'').startsWith('image')?'معاينة صورة ✓':(f.kind||'')+' — '+f.name)}
    draw()};
  el.querySelector('#fUp').onchange=e=>{[...e.target.files].forEach(file=>{const ext=(file.name.split('.').pop()||'').toLowerCase();if(BLOCK.includes(ext)){toast('نوع محظور أمنيًا ⛔');return}if(file.size>15*1024*1024){toast('الحد 15MB في نسخة المتصفح');return}
    const r=new FileReader();r.onload=()=>{const same=Store.col('files').find(x=>x.name===file.name&&x.kind!=='album');
      if(same){Store.update('files',same.id,{versions:[snapVer(same),...(same.versions||[])].slice(0,5),data:String(r.result).slice(0,2_000_000),size:file.size});Store.audit('file_reupload',{name:file.name})}
      else{Store.push('files',{name:file.name,kind:file.type||'file',size:file.size,folder:'عام',tags:[],data:String(r.result).slice(0,2_000_000),versions:[{at:new Date().toISOString(),size:file.size}]});Store.audit('file_upload',{name:file.name})}draw()};r.readAsDataURL(file)});toast('تم الرفع ✓')};
  el.querySelector('#fAlb').onclick=()=>{const v=prompt('اسم المجلد/الألبوم: مشاريع / مشروع 1');if(v){Store.push('files',{name:'— ألبوم: '+v,kind:'album',size:0,folder:v,tags:[]});draw()}};
  el.querySelector('#fS').oninput=draw;draw();
}
