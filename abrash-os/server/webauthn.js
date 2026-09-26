// WebAuthn verification (registration fmt:'none', authentication ES256).
// Zero-dep, Node 18+. COSE map keys arrive as strings ('-2') via cbor.js.
import crypto from 'node:crypto';
import {cborDecode} from './cbor.js';
export const b64u = {
  dec:s=>Buffer.from(String(s).replace(/-/g,'+').replace(/_/g,'/'), 'base64'),
  enc:b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
};
const sha256=b=>crypto.createHash('sha256').update(b).digest();
function rawToDer(raw){raw=Buffer.from(raw);if(raw.length!==64)throw new Error('bad sig len');
  const trim=b=>{let i=0;while(i<b.length-1&&b[i]===0)i++;let o=b.subarray(i);if(o[0]&0x80)o=Buffer.concat([Buffer.from([0]),o]);return o};
  const r=trim(raw.subarray(0,32)),s=trim(raw.subarray(32));
  return Buffer.concat([Buffer.from([0x30,2+r.length+2+s.length,0x02,r.length]),r,Buffer.from([0x02,s.length]),s])}
export function verifyRegistration({attObj,clientData},expected){
  const cd=JSON.parse(b64u.dec(clientData).toString('utf8'));
  if(cd.type!=='webauthn.create')throw new Error('bad type');
  if(cd.challenge!==expected.challenge)throw new Error('bad challenge');
  if(cd.origin!==expected.origin)throw new Error('bad origin');
  const ao=cborDecode(b64u.dec(attObj)).value;
  if(ao.fmt!=='none')throw new Error('only fmt=none accepted');
  const auth=Buffer.from(ao.authData);
  if(!auth.subarray(0,32).equals(sha256(Buffer.from(expected.rpId))))throw new Error('bad rpIdHash');
  const flags=auth[32];if(!(flags&0x01))throw new Error('UP missing');if(!(flags&0x40))throw new Error('AT missing');
  let off=37;off+=16;const idLen=auth.readUInt16BE(off);off+=2;
  const credId=auth.subarray(off,off+idLen);off+=idLen;
  const cose=cborDecode(auth.subarray(off)).value;
  if(cose['1']!==2||cose['3']!==-7||cose['-1']!==1)throw new Error('only ES256 P-256');
  const x=Buffer.from(cose['-2']),y=Buffer.from(cose['-3']);
  if(x.length!==32||y.length!==32)throw new Error('bad coords');
  return {credId:b64u.enc(credId),x:b64u.enc(x),y:b64u.enc(y)}}
export function verifyAuthentication(cred,{authData,clientData,signature},expected){
  const cd=JSON.parse(b64u.dec(clientData).toString('utf8'));
  if(cd.type!=='webauthn.get')throw new Error('bad type');
  if(cd.challenge!==expected.challenge)throw new Error('bad challenge');
  if(cd.origin!==expected.origin)throw new Error('bad origin');
  const auth=b64u.dec(authData);
  if(!auth.subarray(0,32).equals(sha256(Buffer.from(expected.rpId))))throw new Error('bad rpIdHash');
  if(!(auth[32]&0x01))throw new Error('UP missing');
  const counter=auth.readUInt32BE(33);
  if(counter!==0&&counter<=cred.counter)throw new Error('clone/replay: counter');
  const data=Buffer.concat([auth,sha256(b64u.dec(clientData))]);
  const key=crypto.createPublicKey({key:{kty:'EC',crv:'P-256',x:cred.x,y:cred.y},format:'jwk'});
  if(!crypto.verify('sha256',data,key,rawToDer(b64u.dec(signature))))throw new Error('bad signature');
  return counter}
