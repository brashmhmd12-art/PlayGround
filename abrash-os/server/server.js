// ABRASH OS production server — ZERO dependencies, Node 18+.
// Serves the frontend + JSON API (auth, rate-limit, audit, AI proxy).
// Secrets live ONLY in env vars. Run: AI_KEY=... PORT=3001 node server/server.js
// API: /api/auth/signup|login|logout (+TOTP), /api/auth/totp/setup|verify,
//      /api/sync (opaque E2E blob + rev), /api/ai (proxy). Tokens expire in 24h.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newSecret,verifyTotp} from '../js/totp.js';
import {verifyRegistration,verifyAuthentication,b64u} from './webauthn.js';
const RP_ID=process.env.RP_ID||'localhost';
const ORIGIN=process.env.ORIGIN||('http://localhost:'+(process.env.PORT||3001));
const pendingWn={}; // key: user|reg , user|login-id
const issueToken=usr=>{const sid=crypto.randomBytes(16).toString('hex');
  const ss=db('sessions');ss.unshift({id:sid,user:usr.u,ip:'?',at:new Date().toISOString()});save('sessions',ss.slice(0,50));
  const tk=tokens();tk.push({id:sid,user:usr.u,at:new Date().toISOString()});saveTokens(tk.slice(-100));return sid};
const ROOT=path.dirname(fileURLToPath(import.meta.url));const PUB=path.join(ROOT,'..');const DATA=path.join(ROOT,'data');
fs.mkdirSync(DATA,{recursive:true});
const db=f=>{const p=path.join(DATA,f+'.json');try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return[]}};
const save=(f,v)=>fs.writeFileSync(path.join(DATA,f+'.json'),JSON.stringify(v));
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const HDR={'Content-Security-Policy':"default-src 'self';img-src 'self' data: blob:;media-src 'self' data: blob:;style-src 'self' 'unsafe-inline';script-src 'self';connect-src 'self' https://api.open-meteo.com;object-src 'none';base-uri 'self'","Strict-Transport-Security":'max-age=31536000','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};
// rate-limit: 5 auth tries / min / ip ; 30 ai calls / min / ip
const hits={};const limited=(ip,k,max)=>{const t=Date.now(),arr=(hits[ip+k]||=[]).filter(x=>t-x<60000);arr.push(t);hits[ip+k]=arr;return arr.length>max};
const body=req=>new Promise((res,rej)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)rej(new Error('too big'))});req.on('end',()=>{try{res(s?JSON.parse(s):{})}catch{rej(new Error('bad json'))}})});
function pbkdf2(pass,salt){return crypto.pbkdf2Sync(pass,salt,210000,32,'sha256').toString('base64')}
const tokens=()=>db('tokens');const saveTokens=t=>save('tokens',t);
const bearer=q=>{const h=q.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):null};
const TOKEN_MS=24*3600*1000;
const meFrom=tok=>{const t=tokens().find(t=>t.id===tok&&!t.revoked);if(!t)return null;
  if(Date.now()-new Date(t.at).getTime()>TOKEN_MS){t.revoked=true;saveTokens(tokens().map(x=>x.id===t.id?t:x));return null}return t};
const pendingTotp={};
const srv=http.createServer(async(q,r)=>{
  const u=new URL(q.url,'http://x');const ip=q.socket.remoteAddress||'?';
  const J=(c,o)=>{r.writeHead(c,{'Content-Type':'application/json',...HDR});r.end(JSON.stringify(o))};
  try{
    if(u.pathname==='/healthz')return J(200,{ok:true});
    if(u.pathname==='/api/auth/signup'&&q.method==='POST'){if(limited(ip,'a',5))return J(429,{err:'rate limit'});
      const {u:un,e,p}=await body(q);if(!un||!e||String(p||'').length<12)return J(400,{err:'12+ char password'});
      const users=db('users');if(users.some(x=>x.u===un||x.e===e))return J(409,{err:'exists'});
      const salt=crypto.randomBytes(16).toString('base64');users.push({u:un,e,hash:pbkdf2(p,salt),salt,at:new Date().toISOString()});save('users',users);
      const au=db('audits');au.unshift({action:'signup',meta:{u:un},ip,at:new Date().toISOString()});save('audits',au.slice(0,500));return J(200,{ok:true})}
    if(u.pathname==='/api/auth/login'&&q.method==='POST'){if(limited(ip,'a',5))return J(429,{err:'too many — wait 60s'});
      const {id,p,code}=await body(q);const users=db('users');const usr=users.find(x=>x.u===id||x.e===id);
      const okU=usr&&usr.hash.length===44&&crypto.timingSafeEqual(Buffer.from(pbkdf2(String(p||''),usr.salt)),Buffer.from(usr.hash));
      const lg=db('logins');lg.unshift({user:id,ok:!!okU,ip,at:new Date().toISOString()});save('logins',lg.slice(0,200));
      if(!okU)return J(401,{err:'bad credentials'});
      if(usr.totp&&!verifyTotp(usr.totp,String(code||''))){const l2=db('logins');l2.unshift({user:id,ok:false,totp:true,ip,at:new Date().toISOString()});save('logins',l2.slice(0,200));return J(401,{err:'totp required/invalid'})}
      const sid=crypto.randomBytes(16).toString('hex');const ss=db('sessions');ss.unshift({id:sid,user:usr.u,ip,at:new Date().toISOString()});save('sessions',ss.slice(0,50));
      const tk=tokens();tk.push({id:sid,user:usr.u,at:new Date().toISOString()});saveTokens(tk.slice(-100));
      return J(200,{token:sid,user:{u:usr.u,e:usr.e}})}
    if(u.pathname==='/api/auth/logout'&&q.method==='POST'){const t=bearer(q);saveTokens(tokens().map(x=>x.id===t?{...x,revoked:true}:x));return J(200,{ok:true})}
    if(u.pathname==='/api/auth/totp/setup'&&q.method==='POST'){const me=meFrom(bearer(q));if(!me)return J(401,{err:'auth'});
      const secret=newSecret();pendingTotp[me.user]=secret;
      return J(200,{secret,uri:`otpauth://totp/ABRASH-OS:${encodeURIComponent(me.user)}?secret=${secret}&issuer=ABRASH-OS&period=30&digits=6`})}
    if(u.pathname==='/api/auth/totp/verify'&&q.method==='POST'){const me=meFrom(bearer(q));if(!me)return J(401,{err:'auth'});
      const {code}=await body(q);const users=db('users');const usr=users.find(x=>x.u===me.user);
      if(usr.totp){return verifyTotp(usr.totp,String(code||''))?J(200,{ok:true,enabled:true}):J(401,{err:'invalid'})}
      const sec=pendingTotp[me.user];if(sec&&verifyTotp(sec,String(code||''))){usr.totp=sec;save('users',users);delete pendingTotp[me.user];return J(200,{ok:true,enabled:true})}
      return J(401,{err:'invalid'})}
    if(u.pathname==='/api/sync'&&q.method==='GET'){const me=meFrom(bearer(q));if(!me)return J(401,{err:'auth'});
      const all=db('sync');const rec=all.find(x=>x.user===me.user);return J(200,rec||{rev:0,blob:null})}
    if(u.pathname==='/api/sync'&&q.method==='POST'){const me=meFrom(bearer(q));if(!me)return J(401,{err:'auth'});
      if(limited(ip,'sync',30))return J(429,{err:'rate limit'});
      const {base,blob}=await body(q);if(!blob||!blob.salt||!blob.iv||!blob.ct||String(blob.ct).length>8e6)return J(400,{err:'bad blob'});
      const all=db('sync');let rec=all.find(x=>x.user===me.user);const rev=rec?rec.rev:0;
      if(Number(base)!==rev)return J(409,{rev,blob:rec?rec.blob:null,err:'conflict — pull, merge, retry'});
      rec={user:me.user,rev:rev+1,blob,at:new Date().toISOString()};
      save('sync',[...all.filter(x=>x.user!==me.user),rec]);return J(200,{rev:rev+1})}
    if(u.pathname==='/api/webauthn/register/begin'&&q.method==='POST'){const me=meFrom(bearer(q));if(!me)return J(401,{err:'auth'});
      if(limited(ip,'wn',10))return J(429,{err:'rate limit'});
      const ch=b64u.enc(crypto.randomBytes(32));pendingWn[me.user+'|reg']={challenge:ch,exp:Date.now()+300000};
      return J(200,{challenge:ch,rpId:RP_ID,user:me.user})}
    if(u.pathname==='/api/webauthn/register/finish'&&q.method==='POST'){const me=meFrom(bearer(q));if(!me)return J(401,{err:'auth'});
      try{const pend=pendingWn[me.user+'|reg'];if(!pend||pend.exp<Date.now())return J(400,{err:'stale challenge'});
        const {attestationObject,clientDataJSON}=await body(q);
        const cred=verifyRegistration({attObj:attestationObject,clientData:clientDataJSON},{challenge:pend.challenge,rpId:RP_ID,origin:ORIGIN});
        delete pendingWn[me.user+'|reg'];
        const users=db('users');const usr=users.find(x=>x.u===me.user);
        usr.webauthn=usr.webauthn||[];
        if(usr.webauthn.some(c=>c.id===cred.credId))return J(409,{err:'credential exists'});
        usr.webauthn.push({id:cred.credId,x:cred.x,y:cred.y,counter:0,at:new Date().toISOString()});
        save('users',users);return J(200,{ok:true,id:cred.credId})}
      catch(e){return J(400,{err:String(e.message).slice(0,120)})}}
    if(u.pathname==='/api/webauthn/login/begin'&&q.method==='POST'){
      if(limited(ip,'wn',10))return J(429,{err:'rate limit'});
      const {id}=await body(q);const usr=db('users').find(x=>x.u===id||x.e===id);
      if(!usr||!(usr.webauthn||[]).length)return J(404,{err:'no passkey'});
      const ch=b64u.enc(crypto.randomBytes(32));pendingWn[usr.u+'|login']={challenge:ch,exp:Date.now()+300000};
      return J(200,{challenge:ch,rpId:RP_ID,allow:usr.webauthn.map(c=>c.id)})}
    if(u.pathname==='/api/webauthn/login/finish'&&q.method==='POST'){
      try{const {id,credId,authenticatorData,clientDataJSON,signature}=await body(q);
        const users=db('users');const usr=users.find(x=>x.u===id||x.e===id);if(!usr)return J(401,{err:'auth'});
        const pend=pendingWn[usr.u+'|login'];if(!pend||pend.exp<Date.now())return J(400,{err:'stale challenge'});
        const cred=(usr.webauthn||[]).find(c=>c.id===credId);if(!cred)return J(401,{err:'unknown credential'});
        const n=verifyAuthentication(cred,{authData:authenticatorData,clientData:clientDataJSON,signature},{challenge:pend.challenge,rpId:RP_ID,origin:ORIGIN});
        delete pendingWn[usr.u+'|login'];cred.counter=n;save('users',users);
        const lg=db('logins');lg.unshift({user:usr.u,ok:true,passkey:true,ip,at:new Date().toISOString()});save('logins',lg.slice(0,200));
        return J(200,{token:issueToken(usr),user:{u:usr.u,e:usr.e}})}
      catch(e){return J(401,{err:String(e.message).slice(0,120)})}}
    if(u.pathname==='/api/ai'&&q.method==='POST'){if(limited(ip,'ai',30))return J(429,{err:'rate limit'});
      const key=process.env.AI_KEY;if(!key)return J(501,{err:'AI_KEY not set server-side'});
      const {prompt,context}=await body(q);if(!prompt||String(prompt).length>2000)return J(400,{err:'bad prompt'});
      const fr=await fetch(process.env.AI_URL||'https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:process.env.AI_MODEL||'gpt-4o-mini',messages:[{role:'system',content:'أجب بالعربية اعتمادًا على سياق بيانات المستخدم فقط.'},{role:'user',content:String(context||'').slice(0,4000)+'\n\nسؤال: '+prompt}],max_tokens:400})});
      const j=await fr.json();return J(200,{answer:j.choices?.[0]?.message?.content||'—'})}
    // static frontend (path-traversal safe)
    let f=path.normalize(path.join(PUB,u.pathname==='/'?'index.html':u.pathname.slice(1)));
    if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(PUB,'index.html');
    r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream',...HDR,'Cache-Control':f.endsWith('sw.js')?'no-cache':'public,max-age=3600'});
    fs.createReadStream(f).pipe(r);
  }catch(e){J(400,{err:String(e.message||e).slice(0,120)})}
});
srv.listen(process.env.PORT||3001,()=>console.log('abrash-os api :'+(process.env.PORT||3001)));
