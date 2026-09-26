import {Store} from '../store.js';import {escapeHTML,fmtD} from '../core.js';import {toast,empty,confirmDlg} from '../ui.js';import {can,myRole} from '../perms.js';
const BLOCK=['exe','bat','cmd','sh','msi','dll','ps1'];
export const toggleFileFav=id=>{const f=Store.col('files').find(x=>x.id===id);if(!f)return false;Store.update('files',id,{fav:!f.fav});return !f.fav};
export const moveFile=(id,folder)=>{Store.update('files',id,{folder:String(folder||'عام').slice(0,60)});Store.audit('file_move',{id,folder});return true};
export const copyFile=id=>{const f=Store.col('files').find(x=>x.id===id);if(!f||f.kind==='album')return null;
  const c=Store.push('files',{name:f.name.replace(/(\.[a-z0-9]+)?$/i,' نسخة$1'),kind:f.kind,size:f.size,folder:f.folder,tags:[...(f.tags||[])],fav:false,data:f.data,versions:[...(f.versions||[])]});
  Store.audit('file_copy',{id,to:c.id});return c};
export function render(el){let showFav=false;el.innerHTML=`<div class="between"><h2 style="margin:0">📎 مكتبة الوسائط + Albums</h2><label class="btn primary sm">⇪ رفع<input type="file" id="fUp" multiple hidden></label></div>
  <div class="toolbar"><input id="fS" placeholder="بحث ملفات / وسوم…"><select id="fF"><option value="">كل المجلدات</option></select><button class="btn sm" id="fFav">⭐</button><button class="btn sm" id="fAlb">＋ مجلد/ألبوم</button></div>
  <div class="list" id="fL"></div>`;
  const folders=()=>[...new Set(Store.col('files').map(f=>f.folder).filter(Boolean))];
  const draw=()=>{const s=el.querySelector('#fS').value.trim();const ff=el.querySelector('#fF').value;
    el.querySelector('#fF').innerHTML=`<option value="">كل المجلدات</option>`+folders().map(x=>`<option ${ff===x?'selected':''}>${escapeHTML(x)}</option>`).join('');
    let arr=Store.col('files');if(ff)arr=arr.filter(f=>f.folder===ff);if(showFav)arr=arr.filter(f=>f.fav);if(s)arr=arr.filter(f=>(f.name+(f.tags||[]).join(' ')).includes(s));
    el.querySelector('#fL').innerHTML=arr.map(f=>    `<div class="item">${f.fav?'★':'📄'} <b>${escapeHTML(f.name)}</b><span class="pill">${escapeHTML(f.kind||'file')} · ${(f.size||0)}B · v${(f.versions||[]).length+1}</span>${(f.tags||[]).map(x=>`<span class="tag">${escapeHTML(x)}</span>`).join('')}<span style="margin-inline-start:auto" class="row"><button class="btn sm" data-a="prev" data-id="${f.id}">معاينة</button><button class="btn sm" data-a="fav" data-id="${f.id}">${f.fav?'★':'☆'}</button><button class="btn sm" data-a="ren" data-id="${f.id}">تسمية</button><button class="btn sm" data-a="mv" data-id="${f.id}">نقل</button><button class="btn sm" data-a="cp" data-id="${f.id}">نسخ</button><button class="btn sm" data-a="ver" data-id="${f.id}">نسخ (${(f.versions||[]).length})</button><button class="btn sm" data-a="dl" data-id="${f.id}">تنزيل</button><button class="btn sm danger" data-a="del" data-id="${f.id}">حذف</button></span></div>`).join('')||empty('مكتبة فارغة — ارفع صور / فيديو / PDF / ZIP');
    el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a,b.dataset.id))};
  el.querySelector('#fFav').onclick=e=>{showFav=!showFav;e.target.classList.toggle('primary',showFav);draw()};
  const snapVer=f=>({at:new Date().toISOString(),size:f.size,data:(f.data||'').length<500000?f.data:''});
  const act=async(a,id)=>{const f=Store.col('files').find(x=>x.id===id);if(!f)return;
    if(a==='fav'){toggleFileFav(id);draw();return}
    if(a==='ren'){const v=prompt('اسم جديد',f.name);if(v)Store.update('files',id,{name:v.slice(0,120)})}
    if(a==='mv'){const v=prompt('مجلد الوجهة:',f.folder||'عام');if(v!=null){moveFile(id,v);toast('نُقل ✓')}}
    if(a==='cp'){if(!can(myRole(),'create'))return toast('صلاحية غير كافية ⛔');copyFile(id);toast('نُسخ ✓')}
    if(a==='ver'){const vs=f.versions||[];const {confirmDlg:cd}=await import('../ui.js');
      const box=document.createElement('div');box.innerHTML=vs.map((v,i)=>`<div class="item">🕓 ${v.at} · ${v.size}B ${v.data?'':'(بلا محتوى)'}<button class="btn sm" data-v="${i}" style="margin-inline-start:auto">استرجاع</button></div>`).join('')||'لا نسخ';
      box.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{const v=vs[+b.dataset.v];if(!v.data)return toast('لا محتوى محفوظ لهذه النسخة');Store.update('files',id,{versions:[snapVer(f),...vs].slice(0,5),data:v.data,size:v.size});toast('استُعيدت النسخة ✓');draw()});
      cd('نسخ الملف: '+f.name,box).then(()=>{})}
    if(a==='del'){if(!can(myRole(),'delete'))return toast('صلاحية غير كافية ⛔');if(await confirmDlg('حذف الملف','نقل إلى سجل التدقيق')){Store.remove('files',id);Store.audit('file_delete',{id})}}
    if(a==='dl'){const a2=document.createElement('a');a2.href=f.data||'#';a2.download=f.name;a2.click()}
    if(a==='prev'){const box=document.createElement('div');const k=f.kind||'';
      const safe=/^data:(image|audio|video)\/[a-z0-9.+-]+;base64,|^data:application\/pdf;base64,/.test(f.data||'');
      if(k.startsWith('image/')&&safe)box.innerHTML=`<img src="${f.data}" alt="" style="max-width:100%;border-radius:12px">`;
      else if(k.startsWith('audio/')&&safe)box.innerHTML=`<audio controls src="${f.data}" style="width:100%"></audio>`;
      else if(k.startsWith('video/')&&safe)box.innerHTML=`<video controls src="${f.data}" style="max-width:100%;border-radius:12px"></video>`;
      else if(k==='application/pdf'&&safe)box.innerHTML=`<embed src="${f.data}" type="application/pdf" style="width:100%;height:60vh">`;
      else{box.textContent=`${f.name} · ${k||'file'} · ${(f.size||0)}B — لا معاينة مباشرة، استخدم تنزيل`}
      confirmDlg('معاينة: '+f.name,box).then(()=>{})}
    draw()};
  el.querySelector('#fUp').onchange=e=>{[...e.target.files].forEach(file=>{const ext=(file.name.split('.').pop()||'').toLowerCase();if(BLOCK.includes(ext)){toast('نوع محظور أمنيًا ⛔');return}if(file.size>15*1024*1024){toast('الحد 15MB في نسخة المتصفح');return}
    const r=new FileReader();r.onload=()=>{const same=Store.col('files').find(x=>x.name===file.name&&x.kind!=='album');
      if(same){Store.update('files',same.id,{versions:[snapVer(same),...(same.versions||[])].slice(0,5),data:String(r.result).slice(0,2_000_000),size:file.size});Store.audit('file_reupload',{name:file.name})}
      else{Store.push('files',{name:file.name,kind:file.type||'file',size:file.size,folder:'عام',tags:[],data:String(r.result).slice(0,2_000_000),versions:[{at:new Date().toISOString(),size:file.size}]});Store.audit('file_upload',{name:file.name})}draw()};r.readAsDataURL(file)});toast('تم الرفع ✓')};
  el.querySelector('#fAlb').onclick=()=>{const v=prompt('اسم المجلد/الألبوم: مشاريع / مشروع 1');if(v){Store.push('files',{name:'— ألبوم: '+v,kind:'album',size:0,folder:v,tags:[]});draw()}};
  el.querySelector('#fS').oninput=draw;draw();
}
