// Browser WebAuthn ceremony (requires HTTPS or localhost).
// Server holds challenges + public keys; browser never sees secrets.
const b64u={dec:s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)),
  enc:b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const ep=()=>{try{return (JSON.parse(localStorage.getItem('abrashos.v1.settings')||'{}').syncEndpoint||'/api/sync').replace(/\/sync\/?$/,'')}catch{return ''}};
export const wnOK=()=>!!(navigator.credentials&&window.PublicKeyCredential);
export async function wnRegister(token){if(!wnOK())throw new Error('no-webauthn');
  const base=ep();const H={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const b=await (await fetch(base+'/webauthn/register/begin',{method:'POST',headers:H})).json();
  if(!b.challenge)throw new Error(b.err||'begin failed');
  const cred=await navigator.credentials.create({publicKey:{challenge:b64u.dec(b.challenge),
    rp:{name:'ABRASH OS',id:b.rpId},user:{id:new TextEncoder().encode(b.user),name:b.user,displayName:b.user},
    pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:60000,attestation:'none'}});
  const r=await fetch(base+'/webauthn/register/finish',{method:'POST',headers:H,body:JSON.stringify({
    attestationObject:b64u.enc(cred.response.attestationObject),clientDataJSON:b64u.enc(cred.response.clientDataJSON)})});
  const j=await r.json();if(!r.ok)throw new Error(j.err||'finish failed');return j}
export async function wnLogin(base,id,credId,challenge){if(!wnOK())throw new Error('no-webauthn');
  const as=await navigator.credentials.get({publicKey:{challenge:b64u.dec(challenge),rpId:undefined,
    allowCredentials:credId?[{type:'public-key',id:b64u.dec(credId)}]:undefined,timeout:60000,userVerification:'preferred'}});
  const r=await fetch(base+'/webauthn/login/finish',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id,credId:b64u.enc(as.rawId),authenticatorData:b64u.enc(as.response.authenticatorData),
      clientDataJSON:b64u.enc(as.response.clientDataJSON),signature:b64u.enc(as.response.signature)})});
  const j=await r.json();if(!r.ok)throw new Error(j.err||'login failed');return j}
