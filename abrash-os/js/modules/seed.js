import {Store} from '../store.js';
// One-click Arabic demo dataset. Idempotent: runs only on empty workspace.
export function isEmpty(){return !Store.col('notes').length&&!Store.col('projects').length&&!Store.col('tasks').length}
export function seedDemo(){if(!isEmpty())return false;
  const p1=Store.push('projects',{name:'تطبيق محمد ابراش',desc:'نظام التشغيل الرقمي الشخصي',stage:'DEVELOPMENT',priority:'P0',deadline:new Date(Date.now()+45*864e5).toISOString().slice(0,10),budget:'—'});
  const p2=Store.push('projects',{name:'مشروع الأمن السيبراني',desc:'مختبر اختبار اختراق شخصي',stage:'PLANNING',priority:'P1'});
  ['تصميم الواجهة','بناء قاعدة البيانات','إضافة نظام الدخول','اختبار الأمان','إطلاق النسخة الأولى'].forEach((t,i)=>Store.push('tasks',{title:t,projectId:p1.id,priority:i<2?'P0':'P1',done:i<2,due:new Date(Date.now()+(i+1)*864e5).toISOString().slice(0,10)}));
  Store.push('tasks',{title:'مراجعة مشاريع الأسبوع',priority:'P1',done:false,recurring:'weekly'});
  Store.push('notes',{title:'مشروع التطبيق الجديد',body:'## الهدف\nبناء Command Center شخصي.\n\n- واجهة فخمة\n- أمان أولًا\n- يعمل offline',type:'فكرة',tags:['مشروع','تخطيط'],project:'تطبيق محمد ابراش',versions:[]});
  Store.push('notes',{title:'أساسيات Cybersecurity',body:'CIA triad: **Confidentiality**, Integrity, Availability\n- least privilege\n- defense in depth',type:'طويلة',tags:['sec','تعلم'],versions:[]});
  Store.push('knowledge',{title:'OWASP Top 10',body:'Broken Access Control, Cryptographic Failures, Injection…',cat:'Cybersecurity',tags:['sec'],src:'owasp.org'});
  Store.push('knowledge',{title:'Transformer attention',body:'QK^T/sqrt(d) — كلما زاد السياق زادت الكلفة تربيعيًا',cat:'AI',tags:['ml'],src:''});
  Store.push('goals',{title:'تعلم Cybersecurity',range:'شهري',progress:80});
  Store.push('goals',{title:'إطلاق النسخة الأولى',range:'سنوي',progress:35});
  Store.push('ideas',{title:'منصة مشاريع شخصية للجميع',problem:'الأدوات مشتتة',solution:'نظام موحد',audience:'المستقلون',stage:'RESEARCH'});
  Store.push('events',{title:'موعد إطلاق v1',date:new Date(Date.now()+45*864e5).toISOString().slice(0,10)});
  Store.push('files',{name:'خطة المشروع.pdf',kind:'application/pdf',size:12000,folder:'مشاريع',tags:['مشروع'],versions:[]});
  Store.audit('seed_demo',{});return true}
