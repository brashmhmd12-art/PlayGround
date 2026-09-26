// Smoke tests: node tests/smoke.mjs  (run from abrash-os/)
const mem={};global.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>mem[k]=String(v),removeItem:k=>delete mem[k],clear:()=>{for(const k in mem)delete mem[k]}};
Object.defineProperty(globalThis,'navigator',{value:{userAgent:'smoke',language:'ar'},configurable:true});global.screen={width:1,height:1};
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n)};
const core=await import('../js/core.js');
ok('escapeHTML blocks script',core.escapeHTML('<script>alert(1)</script>')==='&lt;script&gt;alert(1)&lt;/script&gt;');
ok('mdLite escapes + bolds',core.mdLite('**x** <b>').includes('<b>x</b>')&&!core.mdLite('<b>').includes('<b>'));
ok('uid unique',core.uid()!==core.uid());
const {Store,seedDefaults}=await import('../js/store.js');seedDefaults();
const n=Store.push('notes',{title:'مشروع الأمن السيبراني',body:'خطة',tags:['sec']});
ok('store push/get',Store.col('notes').some(x=>x.id===n.id));
Store.update('notes',n.id,{title:'معدل'});ok('store update',Store.col('notes').find(x=>x.id===n.id).title==='معدل');
const {globalSearch,parseNatural}=await import('../js/modules/search.js');
ok('globalSearch finds note',globalSearch('معدل').some(r=>r.title==='معدل'));
const r=parseNatural('أنشئ مشروع باسم X');ok('natural create-project',r.msg?.includes('X')&&Store.col('projects').some(p=>p.name==='X'));
const r2=parseNatural('ذكرني غدًا بمراجعة المشروع');ok('natural remind',Store.col('tasks').some(x=>x.title.includes('مراجعة المشروع')));
const {hashPass,verifyPass}=await import('../js/crypto.js');
const h=await hashPass('correct-horse-12+');ok('pbkdf2 verify ok',await verifyPass('correct-horse-12+',h.salt,h.hash));
ok('pbkdf2 wrong rejects',!(await verifyPass('wrong',h.salt,h.hash)));
ok('noteToMarkdown escapes nothing raw',core.noteToMarkdown({title:'<x>',body:'**b**',tags:['a']}).startsWith('# <x>'));
const seed=await import('../js/modules/seed.js');
['notes','projects','tasks','knowledge','goals','ideas','events','files'].forEach(k=>Store.set(k,[]));
ok('seed empty at first',seed.isEmpty());
ok('seedDemo fills workspace',seed.seedDemo()===true&&Store.col('projects').length>=2&&Store.col('tasks').length>=5);
ok('seedDemo idempotent',seed.seedDemo()===false);
const totp=await import('../js/totp.js');
const RS='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
ok('totp RFC vector',totp.totp(RS,59e3)==='287082');
ok('totp rejects wrong',!totp.verifyTotp(RS,'000000',59e3));
const {Auth}=await import('../js/auth.js');
await Auth.signup('u2','u2@x.io','long-password-123');
await Auth.login('u2','long-password-123',null);ok('login no-totp ok',!!Store.get('session',null));
const {secret}=Auth.totpSetup();ok('totp setup secret',secret.length>=16);
ok('totp enable rejects bad',Auth.totpEnable(secret,'000000')===false);
ok('totp enable accepts live',Auth.totpEnable(secret,totp.totp(secret))===true);
let needCode=false;try{await Auth.login('u2','long-password-123',null)}catch(e){needCode=/TOTP/.test(e.message)}
ok('login without code rejected',needCode);Auth.logout();
await Auth.login('u2','long-password-123',totp.totp(secret));ok('login with code ok',!!Store.get('session',null));Auth.logout();
ok('checkPass logged-out false',await Auth.checkPass('long-password-123')===false); // logged out → false
await Auth.login('u2','long-password-123',totp.totp(secret));
ok('checkPass live',await Auth.checkPass('long-password-123')===true);
ok('checkPass wrong',await Auth.checkPass('nope-nope-nope!')===false);Auth.logout();
const sync=await import('../js/modules/sync.js');
Store.set('notes',[{id:'c1',title:'A',body:'1',updatedAt:'2024-01-01T00:00:00.000Z'}]);
Store.set('syncBase',sync.snap());
Store.update('notes','c1',{title:'mine',updatedAt:'2024-02-01T00:00:00.000Z'});
const remote={notes:[{id:'c1',title:'theirs',body:'1',updatedAt:'2024-03-01T00:00:00.000Z'}]};
const conf=sync.findConflicts(remote);
ok('conflict detected',conf.length===1&&conf[0].title==='theirs');
sync.resolveConflict(conf[0],'mine');
ok('resolve keeps mine',Store.col('notes').find(x=>x.id==='c1').title==='mine');
ok('no conflict after resolve',sync.findConflicts(remote).length===0);
const n2=sync.mergeAll({notes:[{id:'c2',title:'new',updatedAt:'2024-05-01T00:00:00.000Z'}]});
ok('merge adds remote-only',n2===1&&Store.col('notes').some(x=>x.id==='c2'));
const rec=await import('../js/modules/recurring.js');
Store.set('tasks',[{id:'tpl',title:'رياضة',priority:'P1',recurring:'daily',nextDue:'2024-01-01',updatedAt:'2024-01-01T00:00:00.000Z'}]);
ok('recurring spawns missed days',rec.runRecurring('2024-01-03')===3);
ok('recurring advances nextDue',Store.col('tasks').find(x=>x.id==='tpl').nextDue==='2024-01-04');
ok('recurring idempotent same day',rec.runRecurring('2024-01-03')===0);
const ret=await import('../js/modules/retention.js');
Store.set('notes',[{id:'old',title:'x',deleted:true,updatedAt:'2020-01-01T00:00:00.000Z'},{id:'keep',title:'y',updatedAt:'2024-06-01T00:00:00.000Z'}]);
Store.set('audits',[{id:'a1',action:'x',at:'2020-01-01T00:00:00.000Z'}]);
const ro=ret.applyRetention({retTrash:30,retLogs:30},new Date('2024-06-15T00:00:00Z').getTime());
ok('retention purges trash+logs',ro.trash===1&&ro.logs===1&&!Store.col('notes').some(x=>x.id==='old'));
const {can}=await import('../js/perms.js');
ok('perms owner wipe',can('owner','wipe')===true);
ok('perms viewer read-only',can('viewer','read')===true&&can('viewer','delete')===false&&can('editor','delete')===false&&can('admin','delete')===true);
// field-level 3-way merge
Store.set('notes',[
  {id:'m1',title:'T',body:'B1',tags:['a'],updatedAt:'2024-01-02T00:00:00.000Z'},
  {id:'m2',title:'T2',body:'same',updatedAt:'2024-01-02T00:00:00.000Z'}]);
Store.set('syncBaseV2',sync.snapV2());
Store.update('notes','m1',{body:'B-local',updatedAt:'2024-02-01T00:00:00.000Z'}); // local touches body only
const frem={notes:[
  {id:'m1',title:'T',body:'B-remote',tags:['a'],updatedAt:'2024-03-01T00:00:00.000Z'}, // both touched body → field conflict
  {id:'m2',title:'T2-remote',body:'same',updatedAt:'2024-03-01T00:00:00.000Z'},        // only remote touched title → auto
  {id:'m3',title:'brand-new',body:'x',updatedAt:'2024-03-01T00:00:00.000Z'}]};          // remote-only → added
const fr=sync.mergeFields(frem);
ok('field auto-merge remote title',Store.col('notes').find(x=>x.id==='m2').title==='T2-remote');
ok('field remote-only added',Store.col('notes').some(x=>x.id==='m3'));
ok('field conflict isolated to body',fr.conflicts.length===1&&fr.conflicts[0].field==='body'&&fr.conflicts[0].mine==='B-local'&&fr.conflicts[0].theirs==='B-remote');
ok('conflicted field keeps local pending choice',Store.col('notes').find(x=>x.id==='m1').body==='B-local');
sync.resolveField(fr.conflicts[0],'theirs');
ok('field resolve theirs',Store.col('notes').find(x=>x.id==='m1').body==='B-remote');
ok('no conflict after resolve',sync.mergeFields(frem).conflicts.length===0);
// array fields merge atomically, not element-wise
Store.set('notes',[{id:'a1',title:'T',tags:['x'],updatedAt:'2024-01-02T00:00:00.000Z'}]);
Store.set('syncBaseV2',sync.snapV2());
Store.update('notes','a1',{tags:['x','mine'],updatedAt:'2024-02-01T00:00:00.000Z'});
const ar=sync.mergeFields({notes:[{id:'a1',title:'T',tags:['x','theirs'],updatedAt:'2024-03-01T00:00:00.000Z'}]});
ok('array conflict atomic',ar.conflicts.length===1&&ar.conflicts[0].field==='tags');
// password change
await Auth.signup('u3','u3@x.io','long-password-123');
await Auth.login('u3','long-password-123',null);
let badOld=false;try{await Auth.changePassword('wrong-old-pass!','new-long-password-456')}catch{badOld=true}
ok('changePassword rejects bad old',badOld);
let shortNew=false;try{await Auth.changePassword('long-password-123','short')}catch{shortNew=true}
ok('changePassword rejects short',shortNew);
ok('changePassword ok',await Auth.changePassword('long-password-123','new-long-password-456')===true);
Auth.logout();
let oldFails=false;try{await Auth.login('u3','long-password-123',null)}catch{oldFails=true}
ok('old password dead',oldFails);Auth.logout();
await Auth.login('u3','new-long-password-456',null);ok('new password works',!!Store.get('session',null));Auth.logout();
// notes folders + wikilinks
const nts=await import('../js/modules/notes.js');
Store.set('notes',[{id:'n1',title:'Alpha',body:'see [[Beta]]',updatedAt:'2024-01-01T00:00:00.000Z'},{id:'n2',title:'Beta',body:'hello',folder:'work',updatedAt:'2024-01-01T00:00:00.000Z'}]);
ok('parseLinks',JSON.stringify(nts.parseLinks('a [[Beta]] and [[Beta]]'))===JSON.stringify(['Beta']));
ok('findBacklinks',nts.findBacklinks('n2').length===1&&nts.findBacklinks('n2')[0].id==='n1');
ok('noteFolders',nts.noteFolders().includes('work'));
const pv=nts.renderNotePreview('<script> [[Beta]]');
ok('preview escapes + links',pv.includes('&lt;script&gt;')&&pv.includes('data-link="Beta"')&&!pv.includes('<script>'));
// files fav/move/copy
const fl=await import('../js/modules/files.js');
Store.set('files',[{id:'f1',name:'a.png',kind:'image/png',size:10,folder:'A',tags:[],data:'data:image/png;base64,xx',versions:[]}]);
ok('file fav toggle',fl.toggleFileFav('f1')===true&&Store.col('files')[0].fav===true);
ok('file move',fl.moveFile('f1','B')&&Store.col('files')[0].folder==='B');
const cp=fl.copyFile('f1');ok('file copy',!!cp&&cp.id!=='f1'&&cp.data==='data:image/png;base64,xx'&&Store.col('files').length===2);
// tasks cats + reminders
const tk=await import('../js/modules/tasks.js');
Store.set('tasks',[{id:'t1',title:'x',due:'2024-01-02',done:false,cat:'home',updatedAt:'2024-01-01T00:00:00.000Z'},{id:'t2',title:'y',due:'2024-02-01',done:false,updatedAt:'2024-01-01T00:00:00.000Z'},{id:'t3',title:'z',due:'2024-01-01',done:true,updatedAt:'2024-01-01T00:00:00.000Z'}]);
ok('dueSoon window',tk.dueSoon(2,'2024-01-01').map(x=>x.id).join(',')==='t1');
ok('taskCats',tk.taskCats().includes('home'));
// projects custom stages
const pj=await import('../js/modules/projects.js');
Store.set('settings',{});ok('stages default',pj.stages()[0]==='IDEA'&&pj.moveStage('IDEA',1)==='PLANNING'&&pj.moveStage('IDEA',-1)==='IDEA');
Store.set('settings',{stages:['A','B']});ok('stages custom',pj.stages().length===2&&pj.moveStage('A',1)==='B'&&pj.moveStage('B',9)==='B');Store.set('settings',{});
// dashboard widgets + duplicates + autobackup
const db=await import('../js/modules/dashboard.js');
Store.set('settings',{widgets:['tasks','notes']});ok('widget reorder',JSON.stringify(db.moveWidget('notes',-1))===JSON.stringify(['notes','tasks']));
Store.set('notes',[{id:'d1',title:'Same',body:'xxx'},{id:'d2',title:'same',body:'xxx'},{id:'d3',title:'other',body:'yyy'}]);
ok('findDuplicates',db.findDuplicates().length===1);
const bk=await import('../js/modules/backup.js');
ok('autobackup due',bk.shouldAutoBackup(null)===true&&bk.shouldAutoBackup('2020-01-01T00:00:00.000Z',new Date('2024-06-01T00:00:00Z').getTime())===true&&bk.shouldAutoBackup(new Date().toISOString())===false);
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);