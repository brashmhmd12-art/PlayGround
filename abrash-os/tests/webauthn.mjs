// WebAuthn E2E with a SIMULATED authenticator (real P-256 crypto via node:crypto).
// Proves server verification: registration, login, replay rejection, tamper rejection.
import {spawn} from 'node:child_process';import crypto from 'node:crypto';import fs from 'node:fs';
import {cborEncode,cborDecode} from '../server/cbor.js';
const PORT=3103,B=`http://localhost:${PORT}`,ORIGIN=B;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n)};
// cbor round-trip incl. negative int keys (COSE)
const rt=cborDecode(cborEncode({1:2,3:-7,'-1':1,'-2':Buffer.from([9]),t:'x',a:[1,2],b:true,n:null})).value;
ok('cbor round-trip',rt['1']===2&&rt['3']===-7&&rt['-1']===1&&rt.t==='x'&&rt.b===true&&rt.n===null);
const srv=spawn('node',['server/server.js'],{env:{...process.env,PORT,RP_ID:'localhost',ORIGIN},cwd:new URL('..',import.meta.url).pathname});
await delay(900);
const b64u={enc:b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  dec:s=>Buffer.from(String(s).replace(/-/g,'+').replace(/_/g,'/'),'base64')};
const derToRaw=der=>{let o=2;if(der[o]!==2)throw 0;o++;const rl=der[o++];const r=der.subarray(o,o+rl);o+=rl;const sl=der[o+1];const s=der.subarray(o+2,o+2+sl);
  const pad=b=>b.length>32?b.subarray(b.length-32):Buffer.concat([Buffer.alloc(32-b.length),b]);return Buffer.concat([pad(r),pad(s)])};
const post=async(p,b,t)=>{const h={'Content-Type':'application/json'};if(t)h.Authorization='Bearer '+t;return fetch(B+p,{method:'POST',headers:h,body:JSON.stringify(b)})};
try{
  await (await post('/api/auth/signup',{u:'wn',e:'w@x.io',p:'long-password-123'}));
  const tok=(await (await post('/api/auth/login',{id:'wn',p:'long-password-123'})).json()).token;
  ok('setup token',!!tok);
  // --- registration ceremony ---
  const beg=await (await post('/api/webauthn/register/begin',{},tok)).json();
  ok('reg begin challenge',!!beg.challenge&&beg.rpId==='localhost');
  const kp=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
  const jwk=kp.publicKey.export({format:'jwk'});
  const credId=crypto.randomBytes(32);
  const rpHash=crypto.createHash('sha256').update('localhost').digest();
  const cose=cborEncode({1:2,3:-7,'-1':1,'-2':b64u.dec(jwk.x),'-3':b64u.dec(jwk.y)});
  const authData=Buffer.concat([rpHash,Buffer.from([0x41,0,0,0,0]),Buffer.alloc(16),Buffer.from([(credId.length>>8)&255,credId.length&255]),credId,cose]);
  const attObj=cborEncode({fmt:'none',authData,attStmt:{}});
  const cdReg={type:'webauthn.create',challenge:beg.challenge,origin:ORIGIN};
  const fin=await post('/api/webauthn/register/finish',{attestationObject:b64u.enc(attObj),clientDataJSON:b64u.enc(JSON.stringify(cdReg))},tok);
  const fj=await fin.json();ok('reg finish ok',fin.status===200&&fj.id===b64u.enc(credId));
  // duplicate credential rejected
  const dup=await post('/api/webauthn/register/finish',{attestationObject:b64u.enc(attObj),clientDataJSON:b64u.enc(JSON.stringify(cdReg))},tok);
  ok('reg duplicate/stale rejected',dup.status!==200);
  // --- authentication ceremony ---
  const lb=await (await post('/api/webauthn/login/begin',{id:'wn'})).json();
  ok('login begin allow',lb.allow?.includes(b64u.enc(credId)));
  const sign=(counter,chal)=>{const ad=Buffer.concat([rpHash,Buffer.from([1,(counter>>>24)&255,(counter>>>16)&255,(counter>>>8)&255,counter&255])]);
    const cd={type:'webauthn.get',challenge:chal,origin:ORIGIN};const cdb=Buffer.from(JSON.stringify(cd));
    const sig=derToRaw(crypto.sign('sha256',Buffer.concat([ad,crypto.createHash('sha256').update(cdb).digest()]),kp.privateKey));
    return {ad: b64u.enc(ad),cdb: b64u.enc(cdb),sig: b64u.enc(sig)}};
  const a1=sign(1,lb.challenge);
  const lf=await post('/api/webauthn/login/finish',{id:'wn',credId:b64u.enc(credId),authenticatorData:a1.ad,clientDataJSON:a1.cdb,signature:a1.sig});
  const lj=await lf.json();ok('login finish token',lf.status===200&&!!lj.token);
  // replay: fresh challenge but stale counter (cloned authenticator) must fail 401
  const lbR=await (await post('/api/webauthn/login/begin',{id:'wn'})).json();
  const aR=sign(1,lbR.challenge);
  const rp=await post('/api/webauthn/login/finish',{id:'wn',credId:b64u.enc(credId),authenticatorData:aR.ad,clientDataJSON:aR.cdb,signature:aR.sig});
  ok('stale counter rejected',rp.status===401);
  // tampered challenge must fail
  const lb2=await (await post('/api/webauthn/login/begin',{id:'wn'})).json();
  const a2=sign(2,'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  const tp=await post('/api/webauthn/login/finish',{id:'wn',credId:b64u.enc(credId),authenticatorData:a2.ad,clientDataJSON:a2.cdb,signature:a2.sig});
  ok('bad challenge rejected',tp.status!==200);
  // wrong-key signature must fail
  const evil=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
  const ad3=Buffer.concat([rpHash,Buffer.from([1,0,0,0,3])]);const cd3b=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:lb2.challenge,origin:ORIGIN}));
  const esig=derToRaw(crypto.sign('sha256',Buffer.concat([ad3,crypto.createHash('sha256').update(cd3b).digest()]),evil.privateKey));
  const ep=await post('/api/webauthn/login/finish',{id:'wn',credId:b64u.enc(credId),authenticatorData:b64u.enc(ad3),clientDataJSON:b64u.enc(cd3b),signature:b64u.enc(esig)});
  ok('wrong key rejected',ep.status===401);
  // unknown user
  const uu=await post('/api/webauthn/login/begin',{id:'ghost'});
  ok('unknown user 404',uu.status===404);
}catch(e){ok('no exception: '+e.message,false)}
srv.kill();fs.rmSync(new URL('../server/data',import.meta.url).pathname,{recursive:true,force:true});
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
